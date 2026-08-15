import { describe, expect, it } from "vitest";

import {
  META_ADS_DAILY_BRIEF_CRON,
  resolveMetaAdsReportingEnvironment,
} from "./meta-ads-daily-brief-task.js";

describe("Meta Ads daily brief schedule", () => {
  it("runs at 9:00 AM Buenos Aires time year-round", () => {
    expect(META_ADS_DAILY_BRIEF_CRON).toEqual({
      pattern: "0 9 * * *",
      timezone: "America/Buenos_Aires",
    });
  });
});

describe("resolveMetaAdsReportingEnvironment", () => {
  it("requires the isolated read-only reporting and destination configuration", () => {
    expect(
      resolveMetaAdsReportingEnvironment({
        META_GRAPH_API_VERSION: "v26.0",
        META_ADS_REPORTING_ACCESS_TOKEN: "report-token",
        META_ADS_AD_ACCOUNT_ID: "act_123",
        TWENTY_API_ORIGIN: "https://api.twenty.com/",
        TWENTY_API_KEY: "twenty-key",
        SLACK_BOT_TOKEN: "xoxb",
        SLACK_ADS_REPORT_CHANNEL_ID: "CADS",
      }),
    ).toEqual({
      meta: {
        graphApiVersion: "v26.0",
        accessToken: "report-token",
        adAccountId: "act_123",
      },
      twenty: { origin: "https://api.twenty.com", apiKey: "twenty-key" },
      slack: { botToken: "xoxb", channelId: "CADS" },
    });
  });

  it("fails fast when the reporting token is absent", () => {
    expect(() =>
      resolveMetaAdsReportingEnvironment({
        META_GRAPH_API_VERSION: "v26.0",
        META_ADS_AD_ACCOUNT_ID: "act_123",
        TWENTY_API_ORIGIN: "https://api.twenty.com",
        TWENTY_API_KEY: "key",
        SLACK_BOT_TOKEN: "xoxb",
        SLACK_ADS_REPORT_CHANNEL_ID: "CADS",
      }),
    ).toThrow("META_ADS_REPORTING_ACCESS_TOKEN is not configured");
  });
});
