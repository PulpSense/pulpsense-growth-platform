import {
  classifyConfidence,
  evaluateAlerts,
  type BriefAlert,
  type Confidence,
  type MetaMetrics,
} from "./meta-ads-daily-brief.js";

const TIME_ZONE = "America/New_York";
const DAY_MS = 86_400_000;

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
  value === null ? "—" : `$${value.toFixed(2)}`;
const integer = (value: number) => Math.round(value).toLocaleString("en-US");
const confidenceText = (campaign: CampaignBriefMetrics) =>
  campaign.confidence === "insufficient"
    ? "inconclusive — under $100 spend"
    : campaign.confidence;

const alertText = (alert: BriefAlert) =>
  ({
    zero_verified_bookings: "spend with zero verified bookings",
    high_actual_cpb: "verified CPB is above target guardrail",
    tracking_discrepancy:
      "Twenty verified bookings exceed Meta Schedule after the 48h grace period",
  })[alert.code];

export const formatDailyBrief = (brief: DailyBrief) => {
  const alerts = brief.windows.flatMap((window) =>
    window.alerts.map(
      (alert) =>
        `${alert.severity === "critical" ? ":rotating_light: *Critical*" : ":warning: *Warning*"} — ${window.label}: ${alertText(alert)}`,
    ),
  );
  const mtd = brief.windows.find((window) => window.key === "mtd");
  const mtdPacing = (() => {
    if (!mtd) return "MTD pacing: unavailable";
    if (!mtd.hasCompletedDays) return "MTD pacing: no completed days yet";
    const [year, month, day] = mtd.dateWindow.until.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    const expectedSpend = (brief.monthlyBudget * day!) / daysInMonth;
    const pacingPercent = expectedSpend
      ? Math.round((mtd.total.spend / expectedSpend) * 100)
      : 0;
    return `MTD pacing: ${money(mtd.total.spend)} vs ${money(expectedSpend)} expected through ${mtd.dateWindow.until} (${pacingPercent}%)`;
  })();
  const lines = [
    `*Meta Ads daily brief* · ${brief.generatedAt.slice(0, 10)}`,
    `Budget: ${money(brief.monthlyBudget)}/month · target verified CPB: ${money(brief.targetCpb)}`,
    mtdPacing,
    ...(alerts.length
      ? alerts
      : [":white_check_mark: No threshold exceptions"]),
    "_Verified bookings are a total-level Twenty audit and are not assigned to campaigns. Campaign rows use Meta attribution only. CAPI/Meta attribution can lag or differ from verified CRM bookings; do not treat directional data as causal proof._",
  ];
  for (const window of brief.windows) {
    const actualCpb = window.verifiedBookings
      ? window.total.spend / window.verifiedBookings
      : null;
    lines.push(
      "",
      `*${window.label}* (${window.hasCompletedDays ? `${window.dateWindow.since}–${window.dateWindow.until}` : "no completed days"})`,
      `Spend ${money(window.total.spend)} · Verified bookings (Twenty): ${window.verifiedBookings} · actual CPB ${money(actualCpb)}`,
      `Meta Schedule: ${window.total.metaBookings} · leads ${window.total.leads} · CPL ${money(window.total.cpl)}`,
      `Clicks ${integer(window.total.clicks)} · impressions ${integer(window.total.impressions)} · reach ${integer(window.total.reach)} · CTR ${window.total.ctr.toFixed(2)}% · CPC ${money(window.total.cpc)} · CPM ${money(window.total.cpm)} · frequency ${window.total.frequency?.toFixed(2) ?? "—"}`,
    );
    if (window.campaigns.length) {
      lines.push(
        ...window.campaigns.map(
          (campaign) =>
            `• ${campaign.campaignName ?? campaign.campaignId ?? "Campaign"}: ${money(campaign.spend)} · Meta Schedule ${campaign.metaBookings} · Meta CPB ${money(campaign.metaCpb)} · ${confidenceText(campaign)}`,
        ),
      );
    }
  }
  return lines.join("\n");
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
  postSlack(text: string, reportDate: string): Promise<unknown>;
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
    const attributionReadyUntilDate = shiftYmd(window.until, -2);
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
    monthlyBudget: 3000,
    targetCpb: 100,
    windows,
  };
  const text = formatDailyBrief(brief);
  const reportDate =
    windows.find((window) => window.key === "yesterday")?.dateWindow.until ??
    brief.generatedAt.slice(0, 10);
  await dependencies.postSlack(text, reportDate);
  return brief;
};

export const ATTRIBUTION_GRACE_MS = 48 * 60 * 60 * 1000;
export const MINIMUM_DECISION_SPEND = 300;
export const MONTHLY_BUDGET = 3000;
export const TARGET_CPB = 100;
export const ONE_DAY_MS = DAY_MS;
