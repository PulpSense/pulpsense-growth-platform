import { describe, expect, it, vi } from "vitest";

import { createFunnelAnalyticsClient } from "./funnelAnalytics";

describe("createFunnelAnalyticsClient", () => {
  it("sends only the allowlisted CRO properties", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const client = createFunnelAnalyticsClient(
      {
        apiKey: "phc_preview",
        host: "https://eu.i.posthog.com/",
        analyticsId: "311de7bf-a46f-49f9-a107-5cc030e960c3",
        funnelId: "creative-multiplier-sprint",
      },
      { fetch: fetchMock, now: () => new Date("2026-08-09T12:00:00.000Z") },
    );

    await client.capture("funnel_validation_failed", {
      step: "contact",
      fields: ["email", "phone"],
      email: "maya@brand.com",
      rawApplicationAnswers: { paidSocialSpend: "$150k+/month" },
    } as never);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://eu.i.posthog.com/i/v0/e/");
    expect(JSON.parse(String(init?.body))).toEqual({
      api_key: "phc_preview",
      event: "funnel_validation_failed",
      timestamp: "2026-08-09T12:00:00.000Z",
      properties: {
        distinct_id: "311de7bf-a46f-49f9-a107-5cc030e960c3",
        funnel_id: "creative-multiplier-sprint",
        step: "contact",
        fields: ["email", "phone"],
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
  });

  it("reports delivery failures without rejecting the user-facing call", async () => {
    const reportFailure = vi.fn();
    const client = createFunnelAnalyticsClient(
      {
        apiKey: "phc_preview",
        host: "https://eu.i.posthog.com",
        analyticsId: "311de7bf-a46f-49f9-a107-5cc030e960c3",
        funnelId: "creative-multiplier-sprint",
      },
      {
        fetch: vi.fn().mockRejectedValue(new Error("network failure")),
        reportFailure,
      },
    );

    await expect(
      client.capture("cta_clicked", { placement: "hero" }),
    ).resolves.toBe(false);
    expect(reportFailure).toHaveBeenCalledWith({
      code: "posthog_delivery_failed",
      event: "cta_clicked",
    });
  });
});
