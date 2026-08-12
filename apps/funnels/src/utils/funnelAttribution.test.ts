import { describe, expect, it } from "vitest";

import { captureFunnelAttribution } from "./funnelAttribution";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("captureFunnelAttribution", () => {
  it("preserves the first touch while refreshing the last touch and anonymous ID", () => {
    const storage = memoryStorage();
    const first = captureFunnelAttribution({
      funnelId: "ai-seo",
      href: "https://preview.pulpsense.com/ai-seo/?utm_source=meta&utm_campaign=launch&fbclid=fb-click&email=private%40example.com",
      referrer: "https://partner.example/review?email=private%40example.com",
      storage,
      createAnalyticsId: () => "311de7bf-a46f-49f9-a107-5cc030e960c3",
    });
    const returning = captureFunnelAttribution({
      funnelId: "ai-seo",
      href: "https://preview.pulpsense.com/ai-seo/?utm_source=newsletter&gclid=google-click",
      referrer: "https://newsletter.example/archive?subscriber=private",
      storage,
      createAnalyticsId: () => "different-id",
    });

    expect(first.analyticsId).toBe("311de7bf-a46f-49f9-a107-5cc030e960c3");
    expect(returning.analyticsId).toBe(first.analyticsId);
    expect(returning.attribution.firstTouch).toEqual({
      utmSource: "meta",
      utmCampaign: "launch",
      fbclid: "fb-click",
      landingPage: "https://preview.pulpsense.com/ai-seo/",
      referrer: "https://partner.example/review",
    });
    expect(returning.attribution.lastTouch).toEqual({
      utmSource: "newsletter",
      gclid: "google-click",
      landingPage: "https://preview.pulpsense.com/ai-seo/",
      referrer: "https://newsletter.example/archive",
    });
    expect(JSON.stringify(returning)).not.toContain("private");
  });

  it("keeps capture best-effort when storage is unavailable", () => {
    const result = captureFunnelAttribution({
      funnelId: "ai-seo",
      href: "https://preview.pulpsense.com/ai-seo/",
      referrer: "",
      storage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
      createAnalyticsId: () => "311de7bf-a46f-49f9-a107-5cc030e960c3",
    });

    expect(result.analyticsId).toBe("311de7bf-a46f-49f9-a107-5cc030e960c3");
    expect(result.attribution.firstTouch).toEqual(result.attribution.lastTouch);
  });
});
