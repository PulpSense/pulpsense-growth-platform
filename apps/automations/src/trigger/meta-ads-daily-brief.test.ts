import { describe, expect, it } from "vitest";

import {
  classifyConfidence,
  evaluateAlerts,
  parseMetaInsight,
} from "./meta-ads-daily-brief.js";

describe("parseMetaInsight", () => {
  it("parses numeric metrics and deduplicates overlapping action aliases", () => {
    expect(
      parseMetaInsight({
        campaign_id: "campaign-1",
        campaign_name: "Prospecting",
        spend: "250.50",
        clicks: "75",
        impressions: "10000",
        reach: "8000",
        actions: [
          { action_type: "lead", value: "9" },
          { action_type: "offsite_conversion.fb_pixel_lead", value: "9" },
          { action_type: "schedule", value: "4" },
          { action_type: "offsite_conversion.fb_pixel_schedule", value: "4" },
        ],
      }),
    ).toMatchObject({
      campaignId: "campaign-1",
      campaignName: "Prospecting",
      spend: 250.5,
      clicks: 75,
      impressions: 10000,
      reach: 8000,
      leads: 9,
      metaBookings: 4,
      cpl: 27.83,
      metaCpb: 62.63,
      ctr: 0.75,
      cpc: 3.34,
      cpm: 25.05,
      frequency: 1.25,
    });
  });
});

describe("decision confidence", () => {
  it.each([
    [99.99, 9, "insufficient"],
    [100, 9, "directional"],
    [299.99, 9, "directional"],
    [300, 2, "directional"],
    [300, 3, "decision-ready"],
  ] as const)(
    "classifies $%s spend and %s bookings as %s",
    (spend, bookings, expected) => {
      expect(classifyConfidence(spend, bookings)).toBe(expected);
    },
  );
});

describe("evaluateAlerts", () => {
  it("gates zero-booking and actual CPB severities at the approved thresholds", () => {
    expect(
      evaluateAlerts({
        spend: 199.99,
        verifiedBookings: 0,
        metaBookings: 0,
        attributionReadyVerifiedBookings: 0,
      }),
    ).toEqual([]);
    expect(
      evaluateAlerts({
        spend: 200,
        verifiedBookings: 0,
        metaBookings: 0,
        attributionReadyVerifiedBookings: 0,
      }),
    ).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "zero_verified_bookings",
      }),
    );
    expect(
      evaluateAlerts({
        spend: 300,
        verifiedBookings: 0,
        metaBookings: 0,
        attributionReadyVerifiedBookings: 0,
      }),
    ).toContainEqual(
      expect.objectContaining({
        severity: "critical",
        code: "zero_verified_bookings",
      }),
    );
    expect(
      evaluateAlerts({
        spend: 300,
        verifiedBookings: 2,
        metaBookings: 2,
        attributionReadyVerifiedBookings: 0,
      }),
    ).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "high_actual_cpb" }),
    );
    expect(
      evaluateAlerts({
        spend: 301,
        verifiedBookings: 2,
        metaBookings: 2,
        attributionReadyVerifiedBookings: 0,
      }),
    ).toContainEqual(
      expect.objectContaining({
        severity: "critical",
        code: "high_actual_cpb",
      }),
    );
  });

  it("only compares bookings whose 48-hour attribution grace has elapsed", () => {
    const input = { spend: 50, verifiedBookings: 2, metaBookings: 1 };
    expect(
      evaluateAlerts({ ...input, attributionReadyVerifiedBookings: 1 }),
    ).toEqual([]);
    expect(
      evaluateAlerts({ ...input, attributionReadyVerifiedBookings: 2 }),
    ).toContainEqual(expect.objectContaining({ code: "tracking_discrepancy" }));
  });
});
