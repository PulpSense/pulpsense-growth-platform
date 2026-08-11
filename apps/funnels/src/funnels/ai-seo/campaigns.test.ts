import { describe, expect, it } from "vitest";

import { AI_SEO_CAMPAIGNS, resolveAiSeoBrowserPixelId } from "./campaigns";

describe("AI SEO campaigns", () => {
  it("gives every campaign a distinct descriptive route and thank-you route", () => {
    expect(AI_SEO_CAMPAIGNS).toHaveLength(2);
    expect(new Set(AI_SEO_CAMPAIGNS.map(({ slug }) => slug))).toHaveLength(2);

    for (const campaign of AI_SEO_CAMPAIGNS) {
      expect(campaign.slug).toMatch(
        /^regional-visibility-audit\/(law-firms|dental-practices)$/u,
      );
      expect(campaign.landingPath).toBe(`/${campaign.slug}/`);
      expect(campaign.thankYouPath).toBe(`/${campaign.slug}/thank-you/`);
    }
  });

  it("assigns a distinct internal identity to each campaign", () => {
    expect(
      AI_SEO_CAMPAIGNS.map(({ key, funnelId }) => [key, funnelId]),
    ).toEqual([
      ["lawyers", "ai-seo"],
      ["dentists", "ai-seo-dentists"],
    ]);
  });

  it("selects browser pixels from the route-local campaign", () => {
    const pixels = { lawyers: "11111", dentists: "22222" };

    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[0], pixels)).toBe(
      "11111",
    );
    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[1], pixels)).toBe(
      "22222",
    );
  });

  it("never falls back to another campaign's browser pixel", () => {
    expect(
      resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[1], {
        lawyers: "11111",
      }),
    ).toBeUndefined();
  });
});
