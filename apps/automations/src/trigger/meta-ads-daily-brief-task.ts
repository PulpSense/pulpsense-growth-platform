import { logger, schedules } from "@trigger.dev/sdk";

import { parseMetaInsight } from "./meta-ads-daily-brief.js";
import { runMetaAdsDailyBrief } from "./meta-ads-daily-report.js";
import {
  countTwentyBookingNotes,
  fetchMetaInsights,
  postSlackAdsBrief,
  type MetaReportingConfig,
  type TwentyAuditConfig,
} from "./meta-ads-reporting-clients.js";

type ReportingEnvironment = Record<string, string | undefined> & {
  META_GRAPH_API_VERSION?: string;
  META_ADS_REPORTING_ACCESS_TOKEN?: string;
  META_ADS_AD_ACCOUNT_ID?: string;
  TWENTY_API_ORIGIN?: string;
  TWENTY_API_KEY?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_ADS_REPORT_CHANNEL_ID?: string;
};

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

export const resolveMetaAdsReportingEnvironment = (
  environment: ReportingEnvironment,
): {
  meta: MetaReportingConfig;
  twenty: TwentyAuditConfig;
  slack: { botToken: string; channelId: string };
} => ({
  meta: {
    graphApiVersion: required(
      environment.META_GRAPH_API_VERSION,
      "META_GRAPH_API_VERSION",
    ),
    accessToken: required(
      environment.META_ADS_REPORTING_ACCESS_TOKEN,
      "META_ADS_REPORTING_ACCESS_TOKEN",
    ),
    adAccountId: required(
      environment.META_ADS_AD_ACCOUNT_ID,
      "META_ADS_AD_ACCOUNT_ID",
    ),
  },
  twenty: {
    origin: required(
      environment.TWENTY_API_ORIGIN,
      "TWENTY_API_ORIGIN",
    ).replace(/\/+$/u, ""),
    apiKey: required(environment.TWENTY_API_KEY, "TWENTY_API_KEY"),
  },
  slack: {
    botToken: required(environment.SLACK_BOT_TOKEN, "SLACK_BOT_TOKEN"),
    channelId: required(
      environment.SLACK_ADS_REPORT_CHANNEL_ID,
      "SLACK_ADS_REPORT_CHANNEL_ID",
    ),
  },
});

export const metaAdsDailyBriefTask = schedules.task({
  id: "meta-ads-daily-brief",
  cron: { pattern: "0 9 * * *", timezone: "America/New_York" },
  queue: { concurrencyLimit: 1 },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (payload) => {
    const config = resolveMetaAdsReportingEnvironment(process.env);
    const generatedAt = new Date(payload.timestamp);
    const brief = await runMetaAdsDailyBrief(generatedAt, {
      fetchMeta: async (window, level) =>
        (await fetchMetaInsights(config.meta, window, level, fetch)).map(
          parseMetaInsight,
        ),
      countVerifiedBookings: (window) =>
        countTwentyBookingNotes(config.twenty, window, fetch),
      postSlack: (text, reportDate) =>
        postSlackAdsBrief(config.slack, text, reportDate, fetch),
    });
    logger.info("Posted Meta Ads daily brief", {
      generatedAt: brief.generatedAt,
      windows: brief.windows.map((window) => ({
        key: window.key,
        spend: window.total.spend,
        verifiedBookings: window.verifiedBookings,
        metaBookings: window.total.metaBookings,
        alerts: window.alerts.length,
      })),
    });
    return {
      generatedAt: brief.generatedAt,
      alertCount: brief.windows.reduce(
        (count, window) => count + window.alerts.length,
        0,
      ),
    };
  },
});
