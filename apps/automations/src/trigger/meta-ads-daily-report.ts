import {
  classifyConfidence,
  evaluateAlerts,
  TARGET_CPB,
  type BriefAlert,
  type Confidence,
  type MetaMetrics,
} from "./meta-ads-daily-brief.js";

const TIME_ZONE = "America/New_York";
const ATTRIBUTION_GRACE_DAYS = 2;
const MONTHLY_BUDGET = 3000;

export type ReportingWindow = {
  key: "yesterday" | "trailing7d" | "mtd";
  label: string;
  since: string;
  until: string;
  auditSince: string;
  auditUntilExclusive: string;
  hasCompletedDays: boolean;
};

const ymdInTimeZone = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const shiftYmd = (ymd: string, days: number) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10);
};

const zonedMidnight = (ymd: string) => {
  const [year, month, day] = ymd.split("-").map(Number);
  const desired = Date.UTC(year!, month! - 1, day!);
  let instant = desired;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    instant += desired - represented;
  }
  return new Date(instant).toISOString();
};

export const buildReportingWindows = (now: Date): ReportingWindow[] => {
  const today = ymdInTimeZone(now);
  const yesterday = shiftYmd(today, -1);
  const monthStart = `${today.slice(0, 8)}01`;
  const make = (
    key: ReportingWindow["key"],
    label: string,
    since: string,
  ): ReportingWindow => ({
    key,
    label,
    since,
    until: yesterday,
    auditSince: zonedMidnight(since),
    auditUntilExclusive: zonedMidnight(today),
    hasCompletedDays: since <= yesterday,
  });
  return [
    make("yesterday", "Yesterday", yesterday),
    make("trailing7d", "Trailing 7 days", shiftYmd(yesterday, -6)),
    make("mtd", "Month to date", monthStart),
  ];
};

export type CampaignBriefMetrics = MetaMetrics & { confidence: Confidence };

export type BriefWindowResult = {
  key: ReportingWindow["key"];
  label: string;
  dateWindow: { since: string; until: string };
  total: MetaMetrics;
  verifiedBookings: number;
  attributionReadyVerifiedBookings: number;
  attributionReadyMetaBookings: number;
  hasCompletedDays: boolean;
  campaigns: CampaignBriefMetrics[];
  alerts: BriefAlert[];
};

export type DailyBrief = {
  generatedAt: string;
  monthlyBudget: number;
  targetCpb: number;
  windows: BriefWindowResult[];
};

const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(value);
const integer = (value: number) => Math.round(value).toLocaleString("en-US");
const confidenceText = (campaign: CampaignBriefMetrics) =>
  campaign.confidence === "insufficient"
    ? "inconclusive — under $100 spend"
    : campaign.confidence;
const shortDate = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${ymd}T00:00:00.000Z`));
const dateRange = (window: BriefWindowResult) =>
  window.hasCompletedDays
    ? `${shortDate(window.dateWindow.since)}–${shortDate(window.dateWindow.until)}`
    : "No completed days";
const actualCpb = (window: BriefWindowResult) =>
  window.verifiedBookings ? window.total.spend / window.verifiedBookings : null;
const escapeMrkdwn = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const alertText = (window: BriefWindowResult, alert: BriefAlert) =>
  ({
    zero_verified_bookings: `${money(window.total.spend)} spent with no verified bookings`,
    high_actual_cpb: `verified CPB ${money(actualCpb(window))} is above the target guardrail`,
    tracking_discrepancy: `${window.attributionReadyVerifiedBookings} verified bookings vs ${window.attributionReadyMetaBookings} Meta Schedule after 48h`,
  })[alert.code];

const mtdPacing = (brief: DailyBrief, mtd: BriefWindowResult | undefined) => {
  if (!mtd) return { label: "Unavailable", percent: null };
  if (!mtd.hasCompletedDays)
    return { label: "No completed days", percent: null };
  const [year, month, day] = mtd.dateWindow.until.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const expectedSpend = (brief.monthlyBudget * day!) / daysInMonth;
  const percent = expectedSpend
    ? Math.round((mtd.total.spend / expectedSpend) * 100)
    : 0;
  return { label: `${percent}% of expected pace`, percent };
};

const campaignLines = (window: BriefWindowResult | undefined) =>
  window?.campaigns.length
    ? window.campaigns
        .map(
          (campaign) =>
            `• *${escapeMrkdwn(campaign.campaignName ?? campaign.campaignId ?? "Campaign")}* — ${money(campaign.spend)} spend · ${campaign.metaBookings} Meta bookings · ${confidenceText(campaign)}`,
        )
        .join("\n")
    : "No campaign delivery";

type DailyBriefPresentation = {
  reportThrough: string;
  yesterday?: BriefWindowResult;
  trailing?: BriefWindowResult;
  mtd?: BriefWindowResult;
  pacing: ReturnType<typeof mtdPacing>;
  alerts: Array<{
    severity: BriefAlert["severity"];
    windowLabel: string;
    text: string;
  }>;
};

const presentDailyBrief = (brief: DailyBrief): DailyBriefPresentation => {
  const yesterday = brief.windows.find((window) => window.key === "yesterday");
  const trailing = brief.windows.find((window) => window.key === "trailing7d");
  const mtd = brief.windows.find((window) => window.key === "mtd");
  return {
    reportThrough: yesterday
      ? shortDate(yesterday.dateWindow.until)
      : brief.generatedAt.slice(0, 10),
    ...(yesterday ? { yesterday } : {}),
    ...(trailing ? { trailing } : {}),
    ...(mtd ? { mtd } : {}),
    pacing: mtdPacing(brief, mtd),
    alerts: brief.windows.flatMap((window) =>
      window.alerts.map((alert) => ({
        severity: alert.severity,
        windowLabel: window.label,
        text: alertText(window, alert),
      })),
    ),
  };
};

export type SlackBriefBlock = Record<string, unknown>;

export const formatDailyBriefBlocks = (
  brief: DailyBrief,
): SlackBriefBlock[] => {
  const presentation = presentDailyBrief(brief);
  const alertCopy = presentation.alerts.length
    ? presentation.alerts
        .map(
          (alert) =>
            `${alert.severity === "critical" ? ":rotating_light: *Critical*" : ":warning: *Attention*"} · ${alert.text}`,
        )
        .join("\n")
    : ":large_green_circle: *No threshold exceptions*";
  const { yesterday, trailing, mtd, pacing } = presentation;

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Meta Ads · Daily brief", emoji: true },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Through *${presentation.reportThrough}*  ·  ${money(brief.monthlyBudget)}/mo budget  ·  ${money(brief.targetCpb)} target booking`,
        },
      ],
    },
    { type: "section", text: { type: "mrkdwn", text: alertCopy } },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*7-day decision window*  _${trailing ? dateRange(trailing) : "Unavailable"}_`,
      },
      fields: trailing
        ? [
            { type: "mrkdwn", text: `*Spend*\n${money(trailing.total.spend)}` },
            {
              type: "mrkdwn",
              text: `*Verified bookings*\n${trailing.verifiedBookings}`,
            },
            {
              type: "mrkdwn",
              text: `*Actual CPB*\n${money(actualCpb(trailing))}`,
            },
            {
              type: "mrkdwn",
              text: `*Leads / CPL*\n${trailing.total.leads} / ${money(trailing.total.cpl)}`,
            },
          ]
        : [],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Campaign signal*  _Meta-attributed_\n${campaignLines(trailing)}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: yesterday
            ? `*Yesterday*  _${dateRange(yesterday)}_\n${money(yesterday.total.spend)} spend · ${yesterday.total.leads} leads · ${yesterday.verifiedBookings} bookings · ${money(actualCpb(yesterday))} CPB`
            : "*Yesterday*\nUnavailable",
        },
        {
          type: "mrkdwn",
          text: mtd
            ? `*Month to date*  _${dateRange(mtd)}_\n${money(mtd.total.spend)} spend · ${mtd.verifiedBookings} bookings · ${money(actualCpb(mtd))} CPB · ${pacing.label}`
            : "*Month to date*\nUnavailable",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: trailing
            ? `*7-day delivery*  ${integer(trailing.total.impressions)} impressions · ${integer(trailing.total.clicks)} clicks · ${trailing.total.ctr.toFixed(2)}% CTR · ${money(trailing.total.cpc)} CPC · ${money(trailing.total.cpm)} CPM · ${trailing.total.frequency?.toFixed(2) ?? "—"}× frequency`
            : "7-day delivery unavailable",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_CRM bookings are account-level. Campaign signal uses Meta attribution; directional results are not causal proof._",
        },
      ],
    },
  ];
};

export const formatDailyBrief = (brief: DailyBrief) => {
  const presentation = presentDailyBrief(brief);
  const { yesterday, trailing, mtd, pacing } = presentation;
  const alerts = presentation.alerts.map(
    (alert) =>
      `${alert.severity === "critical" ? ":rotating_light: *Critical*" : ":warning: *Attention*"} · ${alert.windowLabel}: ${alert.text}`,
  );
  return [
    `*Meta Ads · Daily brief* · through ${presentation.reportThrough}`,
    ...(alerts.length
      ? alerts
      : [":large_green_circle: No threshold exceptions"]),
    trailing
      ? `\n*7-day decision window* · ${dateRange(trailing)}\nSpend ${money(trailing.total.spend)} · Verified ${trailing.verifiedBookings} · Actual CPB ${money(actualCpb(trailing))} · Leads ${trailing.total.leads} · Meta ${trailing.total.metaBookings}\n${campaignLines(trailing)}`
      : "\n*7-day decision window* · unavailable",
    yesterday
      ? `\n*Yesterday* · ${money(yesterday.total.spend)} spend · ${yesterday.total.leads} leads · ${yesterday.verifiedBookings} bookings · ${money(actualCpb(yesterday))} CPB`
      : "",
    mtd
      ? `*Month to date* · ${money(mtd.total.spend)} spend · ${mtd.verifiedBookings} bookings · ${money(actualCpb(mtd))} CPB · ${pacing.label}`
      : "",
    "_CRM bookings are account-level. Campaign signal uses Meta attribution; directional results are not causal proof._",
  ]
    .filter(Boolean)
    .join("\n");
};

const emptyMetrics: MetaMetrics = {
  spend: 0,
  leads: 0,
  metaBookings: 0,
  clicks: 0,
  impressions: 0,
  reach: 0,
  cpl: null,
  metaCpb: null,
  ctr: 0,
  cpc: null,
  cpm: 0,
  frequency: null,
};

export type DailyBriefDependencies = {
  fetchMeta(
    window: { since: string; until: string },
    level: "account" | "campaign",
  ): Promise<MetaMetrics[]>;
  countVerifiedBookings(window: {
    since: string;
    untilExclusive: string;
  }): Promise<number>;
  postSlack(
    text: string,
    reportDate: string,
    blocks: SlackBriefBlock[],
  ): Promise<unknown>;
};

export const runMetaAdsDailyBrief = async (
  now: Date,
  dependencies: DailyBriefDependencies,
) => {
  const windows: BriefWindowResult[] = [];
  for (const window of buildReportingWindows(now)) {
    const dateWindow = { since: window.since, until: window.until };
    // Compare only fully elapsed calendar days on both sides. At 09:00 ET,
    // yesterday minus two days is safely beyond the 48-hour attribution grace.
    const attributionReadyUntilDate = shiftYmd(
      window.until,
      -ATTRIBUTION_GRACE_DAYS,
    );
    const attributionReadyUntilExclusive = zonedMidnight(
      shiftYmd(attributionReadyUntilDate, 1),
    );
    const shouldAuditAttributionReady =
      window.key === "trailing7d" && attributionReadyUntilDate >= window.since;
    const [
      accountRows,
      campaignRows,
      verifiedBookings,
      attributionReadyVerifiedBookings,
      attributionReadyAccountRows,
    ] = await Promise.all([
      window.hasCompletedDays
        ? dependencies.fetchMeta(dateWindow, "account")
        : Promise.resolve([]),
      window.hasCompletedDays
        ? dependencies.fetchMeta(dateWindow, "campaign")
        : Promise.resolve([]),
      window.hasCompletedDays
        ? dependencies.countVerifiedBookings({
            since: window.auditSince,
            untilExclusive: window.auditUntilExclusive,
          })
        : Promise.resolve(0),
      shouldAuditAttributionReady
        ? dependencies.countVerifiedBookings({
            since: window.auditSince,
            untilExclusive: attributionReadyUntilExclusive,
          })
        : Promise.resolve(0),
      shouldAuditAttributionReady
        ? dependencies.fetchMeta(
            { since: window.since, until: attributionReadyUntilDate },
            "account",
          )
        : Promise.resolve([]),
    ]);
    const total = accountRows[0] ?? emptyMetrics;
    const attributionReadyMetaBookings =
      attributionReadyAccountRows[0]?.metaBookings ?? 0;
    const windowAlerts =
      window.key === "trailing7d"
        ? evaluateAlerts({
            spend: total.spend,
            verifiedBookings,
            metaBookings: attributionReadyMetaBookings,
            attributionReadyVerifiedBookings,
          })
        : [];
    windows.push({
      key: window.key,
      label: window.label,
      dateWindow,
      total,
      verifiedBookings,
      attributionReadyVerifiedBookings,
      attributionReadyMetaBookings,
      hasCompletedDays: window.hasCompletedDays,
      campaigns: campaignRows
        .map((campaign) => ({
          ...campaign,
          confidence: classifyConfidence(campaign.spend, campaign.metaBookings),
        }))
        .sort((left, right) => right.spend - left.spend)
        .slice(0, 5),
      alerts: windowAlerts,
    });
  }
  const brief: DailyBrief = {
    generatedAt: now.toISOString(),
    monthlyBudget: MONTHLY_BUDGET,
    targetCpb: TARGET_CPB,
    windows,
  };
  const text = formatDailyBrief(brief);
  const blocks = formatDailyBriefBlocks(brief);
  const reportDate =
    windows.find((window) => window.key === "yesterday")?.dateWindow.until ??
    brief.generatedAt.slice(0, 10);
  await dependencies.postSlack(text, reportDate, blocks);
  return brief;
};
