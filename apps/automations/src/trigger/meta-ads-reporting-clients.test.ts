import { describe, expect, it, vi } from "vitest";

import {
  countTwentyBookingNotes,
  fetchMetaInsights,
  postSlackAdsBrief,
} from "./meta-ads-reporting-clients.js";

const window = { since: "2026-08-08", until: "2026-08-14" };

describe("fetchMetaInsights", () => {
  it("uses the configured Graph version, reporting token, account, fields, and window", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: [{ campaign_id: "c1", spend: "10" }] }),
      );
    await expect(
      fetchMetaInsights(
        {
          graphApiVersion: "v26.0",
          accessToken: "report-token",
          adAccountId: "act_123",
        },
        window,
        "campaign",
        fetcher,
      ),
    ).resolves.toHaveLength(1);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v26.0/act_123/insights");
    expect(url.searchParams.has("access_token")).toBe(false);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: ["Bear", "er ", "report-token"].join(""),
      },
    });
    expect(url.searchParams.get("level")).toBe("campaign");
    expect(url.searchParams.get("time_range")).toBe(JSON.stringify(window));
    expect(url.searchParams.get("fields")).toContain("actions");
    expect(url.searchParams.get("action_report_time")).toBe("conversion");
  });

  it("paginates with the cursor without following token-bearing provider URLs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ campaign_id: "c1", spend: "10" }],
          paging: {
            cursors: { after: "cursor-2" },
            next: "https://graph.facebook.com/v26.0/act_123/insights?access_token=leaked",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: [{ campaign_id: "c2", spend: "20" }] }),
      );

    await expect(
      fetchMetaInsights(
        {
          graphApiVersion: "v26.0",
          accessToken: "report-token",
          adAccountId: "act_123",
        },
        window,
        "campaign",
        fetcher,
      ),
    ).resolves.toHaveLength(2);

    const secondUrl = new URL(String(fetcher.mock.calls[1]?.[0]));
    expect(secondUrl.searchParams.get("after")).toBe("cursor-2");
    expect(secondUrl.searchParams.has("access_token")).toBe(false);
    expect(String(fetcher.mock.calls[1]?.[0])).not.toContain("leaked");
  });

  it("rejects an incomplete Meta pagination cursor instead of returning partial totals", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: [{ campaign_id: "c1", spend: "10" }],
        paging: { next: "https://graph.facebook.com/next" },
      }),
    );
    await expect(
      fetchMetaInsights(
        {
          graphApiVersion: "v26.0",
          accessToken: "report-token",
          adAccountId: "act_123",
        },
        window,
        "campaign",
        fetcher,
      ),
    ).rejects.toThrow("Meta Insights pagination omitted cursor");
  });

  it("rejects a repeated Meta pagination cursor", async () => {
    const page = Response.json({
      data: [],
      paging: {
        next: "https://graph.facebook.com/next",
        cursors: { after: "same-cursor" },
      },
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(
        Response.json({
          data: [],
          paging: {
            next: "https://graph.facebook.com/next",
            cursors: { after: "same-cursor" },
          },
        }),
      );
    await expect(
      fetchMetaInsights(
        {
          graphApiVersion: "v26.0",
          accessToken: "report-token",
          adAccountId: "act_123",
        },
        window,
        "campaign",
        fetcher,
      ),
    ).rejects.toThrow("Meta Insights pagination did not advance");
  });

  it("accepts 1,000 Meta pages and rejects before fetching page 1,001", async () => {
    const makeFetcher = (totalPages: number) => {
      let page = 0;
      return vi.fn<typeof fetch>().mockImplementation(async () => {
        page += 1;
        const hasNextPage = page < totalPages;
        return Response.json({
          data: [],
          ...(hasNextPage
            ? {
                paging: {
                  next: "https://graph.facebook.com/next",
                  cursors: { after: `cursor-${page}` },
                },
              }
            : {}),
        });
      });
    };
    const config = {
      graphApiVersion: "v26.0",
      accessToken: "report-token",
      adAccountId: "act_123",
    };
    const accepted = makeFetcher(1_000);
    await expect(
      fetchMetaInsights(config, window, "campaign", accepted),
    ).resolves.toEqual([]);
    expect(accepted).toHaveBeenCalledTimes(1_000);

    const rejected = makeFetcher(1_001);
    await expect(
      fetchMetaInsights(config, window, "campaign", rejected),
    ).rejects.toThrow("Meta Insights pagination exceeded safe page limit");
    expect(rejected).toHaveBeenCalledTimes(1_000);
  });

  it("throws a bounded provider error without leaking the token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: { message: "bad request" } }, { status: 400 }),
      );
    await expect(
      fetchMetaInsights(
        {
          graphApiVersion: "v26.0",
          accessToken: "secret",
          adAccountId: "act_123",
        },
        window,
        "account",
        fetcher,
      ),
    ).rejects.toThrow("Meta Insights failed (400): bad request");
  });
});

describe("countTwentyBookingNotes", () => {
  it("queries booking-note titles, filters createdAt bounds, and follows pagination", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            notes: {
              edges: [
                {
                  node: { id: "1", createdAt: "2026-08-09T12:00:00.000Z" },
                },
              ],
              pageInfo: { hasNextPage: true, endCursor: "next" },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            notes: {
              edges: [
                {
                  node: { id: "2", createdAt: "2026-08-14T12:00:00.000Z" },
                },
                {
                  node: {
                    id: "outside",
                    createdAt: "2026-08-15T12:00:00.000Z",
                  },
                },
              ],
              pageInfo: { hasNextPage: false },
            },
          },
        }),
      );
    await expect(
      countTwentyBookingNotes(
        { origin: "https://api.twenty.com/", apiKey: "twenty-key" },
        {
          since: "2026-08-08T04:00:00.000Z",
          untilExclusive: "2026-08-15T04:00:00.000Z",
        },
        fetcher,
      ),
    ).resolves.toBe(2);
    const firstBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(firstBody.variables).toEqual({
      titlePrefix: "Booking ",
    });
    expect(firstBody.query).toContain("edges { node { id createdAt } }");
    expect(firstBody.query).not.toContain("createdAt: { gte:");
    const secondBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(secondBody.variables.after).toBe("next");
  });

  it("rejects GraphQL errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ errors: [{ message: "invalid filter" }] }),
      );
    await expect(
      countTwentyBookingNotes(
        { origin: "https://api.twenty.com", apiKey: "key" },
        { since: "a", untilExclusive: "b" },
        fetcher,
      ),
    ).rejects.toThrow("Twenty booking audit failed");
  });

  it("rejects incomplete Twenty pagination instead of returning a partial count", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          notes: {
            edges: [],
            pageInfo: { hasNextPage: true },
          },
        },
      }),
    );
    await expect(
      countTwentyBookingNotes(
        {
          origin: "https://api.twenty.com",
          apiKey: ["twenty", "key"].join("-"),
        },
        {
          since: "2026-08-08T04:00:00.000Z",
          untilExclusive: "2026-08-15T04:00:00.000Z",
        },
        fetcher,
      ),
    ).rejects.toThrow("Twenty booking audit pagination omitted cursor");
  });

  it("requires Twenty pageInfo and rejects repeated cursors", async () => {
    const missingPageInfo = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { notes: { edges: [] } } }));
    await expect(
      countTwentyBookingNotes(
        {
          origin: "https://api.twenty.com",
          apiKey: ["twenty", "key"].join("-"),
        },
        {
          since: "2026-08-08T04:00:00.000Z",
          untilExclusive: "2026-08-15T04:00:00.000Z",
        },
        missingPageInfo,
      ),
    ).rejects.toThrow("Twenty booking audit omitted pageInfo");

    const repeated = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        data: {
          notes: {
            edges: [],
            pageInfo: { hasNextPage: true, endCursor: "same-cursor" },
          },
        },
      }),
    );
    await expect(
      countTwentyBookingNotes(
        {
          origin: "https://api.twenty.com",
          apiKey: ["twenty", "key"].join("-"),
        },
        {
          since: "2026-08-08T04:00:00.000Z",
          untilExclusive: "2026-08-15T04:00:00.000Z",
        },
        repeated,
      ),
    ).rejects.toThrow("Twenty booking audit pagination did not advance");
  });

  it("accepts 1,000 Twenty pages and rejects before fetching page 1,001", async () => {
    const makeFetcher = (totalPages: number) => {
      let page = 0;
      return vi.fn<typeof fetch>().mockImplementation(async () => {
        page += 1;
        return Response.json({
          data: {
            notes: {
              edges: [],
              pageInfo: {
                hasNextPage: page < totalPages,
                ...(page < totalPages ? { endCursor: `cursor-${page}` } : {}),
              },
            },
          },
        });
      });
    };
    const config = {
      origin: "https://api.twenty.com",
      apiKey: ["twenty", "key"].join("-"),
    };
    const dateWindow = {
      since: "2026-08-08T04:00:00.000Z",
      untilExclusive: "2026-08-15T04:00:00.000Z",
    };
    const accepted = makeFetcher(1_000);
    await expect(
      countTwentyBookingNotes(config, dateWindow, accepted),
    ).resolves.toBe(0);
    expect(accepted).toHaveBeenCalledTimes(1_000);

    const rejected = makeFetcher(1_001);
    await expect(
      countTwentyBookingNotes(config, dateWindow, rejected),
    ).rejects.toThrow(
      "Twenty booking audit pagination exceeded safe page limit",
    );
    expect(rejected).toHaveBeenCalledTimes(1_000);
  });
});

describe("postSlackAdsBrief", () => {
  it("posts one metadata-keyed brief to the ads channel", async () => {
    const ok = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "1.2" }));
    await postSlackAdsBrief(
      { botToken: "xoxb", channelId: "CADS" },
      "brief",
      "2026-08-15",
      ok,
      [{ type: "header", text: { type: "plain_text", text: "Brief" } }],
    );
    expect(JSON.parse(String(ok.mock.calls[1]?.[1]?.body))).toMatchObject({
      channel: "CADS",
      text: "brief",
      client_msg_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      metadata: {
        event_type: "pulpsense_meta_ads_daily_brief",
        event_payload: { report_date: "2026-08-15" },
      },
      blocks: [{ type: "header", text: { type: "plain_text", text: "Brief" } }],
    });
  });

  it("updates the existing daily brief on retry instead of posting a duplicate", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [
            {
              ts: "1.2",
              metadata: {
                event_type: "pulpsense_meta_ads_daily_brief",
                event_payload: { report_date: "2026-08-15" },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "1.2" }));

    await postSlackAdsBrief(
      { botToken: "xoxb", channelId: "CADS" },
      "replacement",
      "2026-08-15",
      fetcher,
    );

    expect(String(fetcher.mock.calls[1]?.[0])).toContain("chat.update");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toMatchObject({
      channel: "CADS",
      ts: "1.2",
      text: "replacement",
    });
  });

  it("uses the same Slack idempotency key for concurrent publication attempts", async () => {
    const makeFetcher = () =>
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
        .mockResolvedValueOnce(Response.json({ ok: true, ts: "1.2" }));
    const first = makeFetcher();
    const second = makeFetcher();

    await Promise.all([
      postSlackAdsBrief(
        { botToken: "xoxb", channelId: "CADS" },
        "brief",
        "2026-08-15",
        first,
      ),
      postSlackAdsBrief(
        { botToken: "xoxb", channelId: "CADS" },
        "brief",
        "2026-08-15",
        second,
      ),
    ]);

    const firstBody = JSON.parse(String(first.mock.calls[1]?.[1]?.body));
    const secondBody = JSON.parse(String(second.mock.calls[1]?.[1]?.body));
    expect(firstBody.client_msg_id).toBe(secondBody.client_msg_id);
  });

  it("bounds Slack text and rejects API errors", async () => {
    const bounded = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "1.2" }));
    await postSlackAdsBrief(
      { botToken: "xoxb", channelId: "CADS" },
      "x".repeat(5000),
      "2026-08-15",
      bounded,
    );
    const boundedBody = JSON.parse(String(bounded.mock.calls[1]?.[1]?.body));
    expect(boundedBody.text.length).toBeLessThanOrEqual(4000);
    expect(boundedBody.text).toContain("Report truncated");

    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "channel_not_found" }),
      );
    await expect(
      postSlackAdsBrief(
        { botToken: "xoxb", channelId: "bad" },
        "brief",
        "2026-08-15",
        failed,
      ),
    ).rejects.toThrow("Slack ads brief failed (channel_not_found)");
  });
});
