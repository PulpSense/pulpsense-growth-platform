import { createHash } from "node:crypto";

import type { RawMetaInsight } from "./meta-ads-daily-brief.js";

type Fetcher = typeof fetch;

export type MetaReportingConfig = {
  graphApiVersion: string;
  accessToken: string;
  adAccountId: string;
};

export type DateWindow = { since: string; until: string };

export const fetchMetaInsights = async (
  config: MetaReportingConfig,
  window: DateWindow,
  level: "account" | "campaign",
  fetcher: Fetcher,
): Promise<RawMetaInsight[]> => {
  const version = config.graphApiVersion.replace(/^\/+|\/+$/gu, "");
  let after: string | undefined;
  const rows: RawMetaInsight[] = [];
  const seenCursors = new Set<string>();
  let fetchedPages = 0;
  do {
    fetchedPages += 1;
    if (fetchedPages > 1_000) {
      throw new Error("Meta Insights pagination exceeded safe page limit");
    }
    const url = new URL(
      `https://graph.facebook.com/${version}/${encodeURIComponent(config.adAccountId)}/insights`,
    );
    url.searchParams.set("level", level);
    url.searchParams.set("time_increment", "all_days");
    url.searchParams.set("action_report_time", "conversion");
    url.searchParams.set("time_range", JSON.stringify(window));
    url.searchParams.set(
      "fields",
      [
        ...(level === "campaign" ? ["campaign_id", "campaign_name"] : []),
        "spend",
        "actions",
        "clicks",
        "impressions",
        "reach",
      ].join(","),
    );
    url.searchParams.set("limit", "500");
    if (after) url.searchParams.set("after", after);

    const response = await fetcher(url, {
      headers: {
        Authorization: ["Bear", "er ", config.accessToken].join(""),
      },
    });
    const result = (await response.json()) as {
      data?: RawMetaInsight[];
      paging?: {
        cursors?: { after?: string };
        next?: string;
      };
      error?: { message?: string };
    };
    if (!response.ok || result.error) {
      throw new Error(
        `Meta Insights failed (${response.status}): ${result.error?.message ?? "invalid response"}`,
      );
    }
    rows.push(...(result.data ?? []));
    const nextCursor = result.paging?.cursors?.after;
    if (result.paging?.next && !nextCursor) {
      throw new Error("Meta Insights pagination omitted cursor");
    }
    if (nextCursor && seenCursors.has(nextCursor)) {
      throw new Error("Meta Insights pagination did not advance");
    }
    if (nextCursor) seenCursors.add(nextCursor);
    after = result.paging?.next ? nextCursor : undefined;
  } while (after);
  return rows;
};

export type TwentyAuditConfig = { origin: string; apiKey: string };

export const countTwentyBookingNotes = async (
  config: TwentyAuditConfig,
  window: { since: string; untilExclusive: string },
  fetcher: Fetcher,
) => {
  const ids = new Set<string>();
  const seenCursors = new Set<string>();
  let after: string | undefined;
  let fetchedPages = 0;
  do {
    fetchedPages += 1;
    if (fetchedPages > 1_000) {
      throw new Error(
        "Twenty booking audit pagination exceeded safe page limit",
      );
    }
    const response = await fetcher(
      `${config.origin.replace(/\/+$/u, "")}/graphql`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query CountBookingNotes($titlePrefix: String!, $after: String) {
              notes(
                filter: { title: { startsWith: $titlePrefix } }
                first: 100
                after: $after
              ) {
                edges { node { id createdAt } }
                pageInfo { hasNextPage endCursor }
              }
            }
          `,
          variables: {
            titlePrefix: "Booking ",
            ...(after ? { after } : {}),
          },
        }),
      },
    );
    const result = (await response.json()) as {
      data?: {
        notes?: {
          edges?: Array<{ node?: { id?: string; createdAt?: string } }>;
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
        };
      };
      errors?: unknown[];
    };
    if (!response.ok || result.errors?.length || !result.data?.notes) {
      throw new Error(`Twenty booking audit failed (${response.status})`);
    }
    for (const edge of result.data.notes.edges ?? []) {
      const note = edge.node;
      if (
        note?.id &&
        note.createdAt &&
        note.createdAt >= window.since &&
        note.createdAt < window.untilExclusive
      ) {
        ids.add(note.id);
      }
    }
    const page = result.data.notes.pageInfo;
    if (!page) {
      throw new Error("Twenty booking audit omitted pageInfo");
    }
    if (page.hasNextPage && !page.endCursor) {
      throw new Error("Twenty booking audit pagination omitted cursor");
    }
    if (page.endCursor && seenCursors.has(page.endCursor)) {
      throw new Error("Twenty booking audit pagination did not advance");
    }
    if (page.endCursor) seenCursors.add(page.endCursor);
    if (seenCursors.size > 1_000) {
      throw new Error(
        "Twenty booking audit pagination exceeded safe page limit",
      );
    }
    after = page.hasNextPage ? page.endCursor : undefined;
  } while (after);
  return ids.size;
};

export const postSlackAdsBrief = async (
  config: { botToken: string; channelId: string },
  text: string,
  reportDate: string,
  fetcher: Fetcher,
  blocks?: Array<Record<string, unknown>>,
) => {
  type SlackResponse = {
    ok?: boolean;
    error?: string;
    ts?: string;
    messages?: Array<{
      ts?: string;
      metadata?: {
        event_type?: string;
        event_payload?: { report_date?: string };
      };
    }>;
    response_metadata?: { next_cursor?: string };
  };

  const slackApi = async (method: string, body: Record<string, unknown>) => {
    const response = await fetcher(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: ["Bear", "er ", config.botToken].join(""),
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as SlackResponse;
    if (!response.ok || !result.ok) {
      throw new Error(
        `Slack ads brief failed (${result.error ?? response.status})`,
      );
    }
    return result;
  };

  let cursor: string | undefined;
  let existingTimestamp: string | undefined;
  do {
    const history = await slackApi("conversations.history", {
      channel: config.channelId,
      limit: 200,
      include_all_metadata: true,
      ...(cursor ? { cursor } : {}),
    });
    existingTimestamp = history.messages?.find(
      (message) =>
        message.metadata?.event_type === "pulpsense_meta_ads_daily_brief" &&
        message.metadata.event_payload?.report_date === reportDate &&
        message.ts,
    )?.ts;
    cursor = existingTimestamp
      ? undefined
      : history.response_metadata?.next_cursor || undefined;
  } while (cursor);

  const boundedText =
    text.length <= 4_000
      ? text
      : `${text.slice(0, 3_970)}\n_Report truncated._`;
  const metadata = {
    event_type: "pulpsense_meta_ads_daily_brief",
    event_payload: { report_date: reportDate },
  };
  // Slack deduplicates concurrent/retried chat.postMessage calls by client_msg_id.
  // Derive a stable UUID-shaped value from channel + report date.
  const hash = createHash("sha256")
    .update(`${config.channelId}:${reportDate}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hash[12] = "5";
  hash[16] = ((Number.parseInt(hash[16]!, 16) & 0x3) | 0x8).toString(16);
  const clientMessageId = `${hash.slice(0, 8).join("")}-${hash.slice(8, 12).join("")}-${hash.slice(12, 16).join("")}-${hash.slice(16, 20).join("")}-${hash.slice(20).join("")}`;
  const result = existingTimestamp
    ? await slackApi("chat.update", {
        channel: config.channelId,
        ts: existingTimestamp,
        text: boundedText,
        ...(blocks?.length ? { blocks } : {}),
        metadata,
      })
    : await slackApi("chat.postMessage", {
        channel: config.channelId,
        text: boundedText,
        ...(blocks?.length ? { blocks } : {}),
        unfurl_links: false,
        unfurl_media: false,
        client_msg_id: clientMessageId,
        metadata,
      });
  return { timestamp: result.ts };
};
