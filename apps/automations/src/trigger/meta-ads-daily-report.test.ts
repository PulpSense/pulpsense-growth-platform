import { describe, expect, it, vi } from "vitest";

import {
  buildReportingWindows,
  formatDailyBrief,
  runMetaAdsDailyBrief,
  type BriefWindowResult,
} from "./meta-ads-daily-report.js";

const total = {
  spend: 80,
  leads: 4,
  metaBookings: 1,
  clicks: 20,
  impressions: 2000,
  reach: 1500,
  cpl: 20,
  metaCpb: 80,
  ctr: 1,
  cpc: 4,
  cpm: 40,
  frequency: 1.33,
};

const result: BriefWindowResult = {
  key: "yesterday",
  label: "Yesterday",
  dateWindow: { since: "2026-08-14", until: "2026-08-14" },
  total,
  verifiedBookings: 1,
  attributionReadyVerifiedBookings: 0,
  attributionReadyMetaBookings: 0,
  hasCompletedDays: true,
  campaigns: [
    {
      ...total,
      campaignId: "c1",
      campaignName: "Prospecting",
      spend: 80,
      metaBookings: 1,
      metaCpb: 80,
      confidence: "insufficient",
    },
  ],
  alerts: [],
};

describe("buildReportingWindows", () => {
  it("builds yesterday, trailing 7d, and MTD in America/New_York with UTC audit bounds", () => {
    expect(buildReportingWindows(new Date("2026-08-15T13:00:00.000Z"))).toEqual(
      [
        expect.objectContaining({
          key: "yesterday",
          since: "2026-08-14",
          until: "2026-08-14",
          auditSince: "2026-08-14T04:00:00.000Z",
          auditUntilExclusive: "2026-08-15T04:00:00.000Z",
        }),
        expect.objectContaining({
          key: "trailing7d",
          since: "2026-08-08",
          until: "2026-08-14",
        }),
        expect.objectContaining({
          key: "mtd",
          since: "2026-08-01",
          until: "2026-08-14",
        }),
      ],
    );
  });

  it("represents first-of-month MTD as an empty completed-day interval", () => {
    const mtd = buildReportingWindows(
      new Date("2026-09-01T13:00:00.000Z"),
    ).find((window) => window.key === "mtd");
    expect(mtd).toMatchObject({
      since: "2026-09-01",
      until: "2026-08-31",
      auditSince: "2026-09-01T04:00:00.000Z",
      auditUntilExclusive: "2026-09-01T04:00:00.000Z",
      hasCompletedDays: false,
    });
  });
});

describe("formatDailyBrief", () => {
  it("is concise, exception-first, explicit about low-spend uncertainty and attribution limits", () => {
    const text = formatDailyBrief({
      generatedAt: "2026-08-15T13:00:00.000Z",
      monthlyBudget: 3000,
      targetCpb: 100,
      windows: [
        result,
        {
          ...result,
          key: "trailing7d",
          label: "Trailing 7 days",
          total: { ...total, spend: 320 },
          verifiedBookings: 0,
          alerts: [{ code: "zero_verified_bookings", severity: "critical" }],
        },
      ],
    });
    expect(text).toContain(":rotating_light: *Critical* — Trailing 7 days");
    expect(text).toContain("Verified bookings (Twenty): 1");
    expect(text).toContain("Meta Schedule: 1");
    expect(text).toContain("inconclusive — under $100 spend");
    expect(text).toContain("CAPI/Meta attribution");
    expect(text).toContain("MTD pacing");
    expect(text).not.toContain("Twenty campaign");
  });
});

describe("runMetaAdsDailyBrief", () => {
  it("audits Twenty only at total level and posts one report", async () => {
    const fetchMeta = vi.fn(async (_window, level: "account" | "campaign") =>
      level === "account"
        ? [total]
        : [{ ...total, campaignId: "c1", campaignName: "Prospecting" }],
    );
    const countVerifiedBookings = vi.fn(async () => 1);
    const postSlack = vi.fn(async (_text: string) => ({ timestamp: "1.2" }));
    await runMetaAdsDailyBrief(new Date("2026-08-15T13:00:00.000Z"), {
      fetchMeta,
      countVerifiedBookings,
      postSlack,
    });
    expect(fetchMeta).toHaveBeenCalledTimes(7);
    expect(countVerifiedBookings).toHaveBeenCalledTimes(4);
    expect(postSlack).toHaveBeenCalledTimes(1);
    expect(postSlack).toHaveBeenCalledWith(expect.any(String), "2026-08-14");
    expect(postSlack.mock.calls[0]?.[0]).toContain("Prospecting");
  });

  it("applies the actual-CPB guardrail only to the trailing 7-day window", async () => {
    const expensive = { ...total, spend: 301 };
    const brief = await runMetaAdsDailyBrief(
      new Date("2026-08-15T13:00:00.000Z"),
      {
        fetchMeta: async (_window, level) =>
          level === "account" ? [expensive] : [],
        countVerifiedBookings: async () => 2,
        postSlack: async () => undefined,
      },
    );
    expect(
      brief.windows
        .filter((window) =>
          window.alerts.some((alert) => alert.code === "high_actual_cpb"),
        )
        .map((window) => window.key),
    ).toEqual(["trailing7d"]);
  });

  it("compares equivalent mature Meta and Twenty windows after the 48-hour grace", async () => {
    const countVerifiedBookings = vi.fn(
      async (window: { untilExclusive: string }) =>
        window.untilExclusive === "2026-08-13T04:00:00.000Z" ? 1 : 2,
    );
    const brief = await runMetaAdsDailyBrief(
      new Date("2026-08-15T13:00:00.000Z"),
      {
        fetchMeta: async (window, level) => {
          if (level !== "account") return [];
          return [
            {
              ...total,
              metaBookings: window.until === "2026-08-12" ? 0 : 1,
            },
          ];
        },
        countVerifiedBookings,
        postSlack: async () => undefined,
      },
    );

    const trailing = brief.windows.find(
      (window) => window.key === "trailing7d",
    );
    expect(trailing?.verifiedBookings).toBe(2);
    expect(trailing?.attributionReadyVerifiedBookings).toBe(1);
    expect(trailing?.attributionReadyMetaBookings).toBe(0);
    expect(trailing?.alerts).toContainEqual(
      expect.objectContaining({ code: "tracking_discrepancy" }),
    );
  });

  it("skips invalid provider ranges when current-month MTD has no completed days", async () => {
    const fetchMeta = vi.fn(async (_window, level: "account" | "campaign") =>
      level === "account" ? [total] : [],
    );
    const countVerifiedBookings = vi.fn(async () => 1);
    const postSlack = vi.fn(
      async (_text: string, _reportDate: string) => undefined,
    );

    const brief = await runMetaAdsDailyBrief(
      new Date("2026-09-01T13:00:00.000Z"),
      { fetchMeta, countVerifiedBookings, postSlack },
    );

    expect(fetchMeta).toHaveBeenCalledTimes(5);
    expect(countVerifiedBookings).toHaveBeenCalledTimes(3);
    expect(fetchMeta).not.toHaveBeenCalledWith(
      { since: "2026-09-01", until: "2026-08-31" },
      expect.anything(),
    );
    expect(brief.windows.find((window) => window.key === "mtd")).toMatchObject({
      hasCompletedDays: false,
      total: { spend: 0 },
      verifiedBookings: 0,
    });
    expect(postSlack.mock.calls[0]?.[0]).toContain(
      "MTD pacing: no completed days yet",
    );
  });

  it("sorts campaign rows by spend and limits each window to five", async () => {
    const campaigns = Array.from({ length: 7 }, (_, index) => ({
      ...total,
      campaignId: `c${index}`,
      campaignName: `Campaign ${index}`,
      spend: index * 10,
    }));
    const brief = await runMetaAdsDailyBrief(
      new Date("2026-08-15T13:00:00.000Z"),
      {
        fetchMeta: async (_window, level) =>
          level === "account" ? [total] : campaigns,
        countVerifiedBookings: async () => 0,
        postSlack: async () => undefined,
      },
    );

    expect(
      brief.windows[0]?.campaigns.map((campaign) => campaign.spend),
    ).toEqual([60, 50, 40, 30, 20]);
  });
});
