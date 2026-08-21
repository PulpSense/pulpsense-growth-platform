import { describe, expect, it } from "vitest";

import {
  AI_SEO_CAMPAIGNS,
  getAiSeoCampaignStaticPaths,
  resolveAiSeoBrowserPixelId,
  resolveAiSeoCampaign,
} from "./campaigns";

describe("AI SEO campaigns", () => {
  it("gives every campaign distinct landing, application, and thank-you routes", () => {
    expect(AI_SEO_CAMPAIGNS).toHaveLength(6);
    expect(new Set(AI_SEO_CAMPAIGNS.map(({ slug }) => slug))).toHaveLength(6);

    expect(AI_SEO_CAMPAIGNS.map(({ slug }) => slug)).toEqual([
      "visibility-audit/law-firms",
      "visibility-audit/dental-practices",
      "visibility-audit/dental-implants",
      "visibility-audit/plastic-surgery",
      "visibility-audit/hair-restoration",
      "visibility-audit/med-spas",
    ]);

    for (const campaign of AI_SEO_CAMPAIGNS) {
      expect(campaign.landingPath).toBe(`/${campaign.slug}/`);
      expect(campaign.qualificationPath).toBe(`/${campaign.slug}/apply/`);
      expect(campaign.thankYouPath).toBe(`/${campaign.slug}/thank-you/`);
    }
  });

  it("assigns a distinct internal identity to each campaign", () => {
    expect(
      AI_SEO_CAMPAIGNS.map(({ key, funnelId }) => [key, funnelId]),
    ).toEqual([
      ["lawyers", "ai-seo"],
      ["dentists", "ai-seo-dentists"],
      ["dental-implants", "ai-seo-dental-implants"],
      ["plastic-surgery", "ai-seo-plastic-surgery"],
      ["hair-restoration", "ai-seo-hair-restoration"],
      ["med-spas", "ai-seo-med-spas"],
    ]);
    expect(
      new Set(AI_SEO_CAMPAIGNS.map(({ funnelId }) => funnelId)),
    ).toHaveLength(AI_SEO_CAMPAIGNS.length);
  });

  it("keeps browser and server Meta destinations in the campaign registry", () => {
    expect(
      AI_SEO_CAMPAIGNS.map(
        ({ key, browserPixelEnvKey, serverMetaDestination }) => [
          key,
          browserPixelEnvKey,
          serverMetaDestination,
        ],
      ),
    ).toEqual([
      ["lawyers", "PUBLIC_META_PIXEL_ID_AI_SEO_L", "AI_SEO_L"],
      ["dentists", "PUBLIC_META_PIXEL_ID_AI_SEO_D", "AI_SEO_D"],
      ["dental-implants", "PUBLIC_META_PIXEL_ID_AI_SEO_DI", "AI_SEO_DI"],
      ["plastic-surgery", "PUBLIC_META_PIXEL_ID_AI_SEO_PS", "AI_SEO_PS"],
      ["hair-restoration", "PUBLIC_META_PIXEL_ID_AI_SEO_HR", "AI_SEO_HR"],
      ["med-spas", "PUBLIC_META_PIXEL_ID_AI_SEO_MS", "AI_SEO_MS"],
    ]);
  });

  it("selects browser pixels from the campaign-owned environment key", () => {
    const environment = {
      PUBLIC_META_PIXEL_ID_AI_SEO_L: "11111",
      PUBLIC_META_PIXEL_ID_AI_SEO_D: "22222",
      PUBLIC_META_PIXEL_ID_AI_SEO_DI: "33333",
      PUBLIC_META_PIXEL_ID_AI_SEO_PS: "44444",
      PUBLIC_META_PIXEL_ID_AI_SEO_HR: "55555",
      PUBLIC_META_PIXEL_ID_AI_SEO_MS: "66666",
    };

    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[0], environment)).toBe(
      "11111",
    );
    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[1], environment)).toBe(
      "22222",
    );
    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[2], environment)).toBe(
      "33333",
    );
    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[3], environment)).toBe(
      "44444",
    );
    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[4], environment)).toBe(
      "55555",
    );
    expect(resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[5], environment)).toBe(
      "66666",
    );
  });

  it("never falls back to another campaign's browser pixel", () => {
    expect(
      resolveAiSeoBrowserPixelId(AI_SEO_CAMPAIGNS[1], {
        PUBLIC_META_PIXEL_ID_AI_SEO_L: "11111",
      }),
    ).toBeUndefined();
  });

  it("resolves the same campaign registry for route generation and lookup", () => {
    const paths = getAiSeoCampaignStaticPaths();

    expect(paths).toHaveLength(AI_SEO_CAMPAIGNS.length);
    for (const path of paths) {
      expect(resolveAiSeoCampaign(path.params.campaign)).toBe(
        path.props.campaign,
      );
    }
    expect(resolveAiSeoCampaign("missing-niche")).toBeUndefined();
  });

  it("provides niche-specific PulpSense page metadata", () => {
    expect(
      AI_SEO_CAMPAIGNS.map(({ key, landingTitle, thankYouTitle }) => [
        key,
        landingTitle,
        thankYouTitle,
      ]),
    ).toEqual([
      [
        "lawyers",
        "45 More Calls in 90 Days for Law Firms | PulpSense",
        "Your Law Firm Visibility Audit Is Booked | PulpSense",
      ],
      [
        "dentists",
        "45 More Calls in 90 Days for Dental Practices | PulpSense",
        "Your Dental Visibility Audit Is Booked | PulpSense",
      ],
      [
        "dental-implants",
        "45 More Implant Calls in 90 Days | PulpSense",
        "Your Dental Implant Visibility Audit Is Booked | PulpSense",
      ],
      [
        "plastic-surgery",
        "45 More Calls in 90 Days for Plastic Surgeons | PulpSense",
        "Your Plastic Surgery Visibility Audit Is Booked | PulpSense",
      ],
      [
        "hair-restoration",
        "45 More Hair Restoration Calls in 90 Days | PulpSense",
        "Your Hair Restoration Visibility Audit Is Booked | PulpSense",
      ],
      [
        "med-spas",
        "45 More Calls in 90 Days for Med Spas | PulpSense",
        "Your Med Spa Visibility Audit Is Booked | PulpSense",
      ],
    ]);

    for (const campaign of AI_SEO_CAMPAIGNS) {
      expect(campaign.landingDescription).toContain("Google and AI");
      expect(campaign.thankYouDescription).toContain("PulpSense");
      expect(JSON.stringify(campaign)).not.toContain("Lead Oracle");
    }
  });

  it("provides a relevant nationwide service callout for every niche", () => {
    expect(AI_SEO_CAMPAIGNS.map(({ heroCallout }) => heroCallout)).toEqual([
      "⚖️ Proudly serving law firms nationwide",
      "🦷 Proudly serving dental practices nationwide",
      "🦷 Proudly serving dental implant practices nationwide",
      "✨ Proudly serving plastic surgery practices nationwide",
      "💇 Proudly serving hair restoration practices nationwide",
      "💉 Proudly serving med spas nationwide",
    ]);
  });

  it("allows a niche to override only the qualification callout", () => {
    expect(AI_SEO_CAMPAIGNS[0].qualificationCallout).toContain(
      "established businesses",
    );
    expect(AI_SEO_CAMPAIGNS[1].qualificationCallout).toContain(
      "dental practices",
    );
    expect(AI_SEO_CAMPAIGNS[2].qualificationCallout).toContain(
      "implant practices",
    );
  });
});
