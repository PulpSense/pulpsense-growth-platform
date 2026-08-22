import { describe, expect, it } from "vitest";

import {
  AI_SEO_CAMPAIGNS,
  getAiSeoCampaignStaticPaths,
  resolveAiSeoBrowserPixelId,
  resolveAiSeoCampaign,
} from "./campaigns";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./campaign-config/shared-content";
import { RETIRED_LAW_FIRM_COPY } from "./campaign-config/law-firm-policy";

describe("AI SEO campaigns", () => {
  it("gives every campaign distinct landing, application, and thank-you routes", () => {
    expect(AI_SEO_CAMPAIGNS).toHaveLength(6);
    expect(
      new Set(AI_SEO_CAMPAIGNS.map(({ identity }) => identity.slug)),
    ).toHaveLength(6);

    expect(AI_SEO_CAMPAIGNS.map(({ identity }) => identity.slug)).toEqual([
      "visibility-audit/law-firms",
      "visibility-audit/dental-practices",
      "visibility-audit/dental-implants",
      "visibility-audit/plastic-surgery",
      "visibility-audit/hair-restoration",
      "visibility-audit/med-spas",
    ]);

    for (const campaign of AI_SEO_CAMPAIGNS) {
      expect(campaign.landingPath).toBe(`/${campaign.identity.slug}/`);
      expect(campaign.qualificationPath).toBe(
        `/${campaign.identity.slug}/apply/`,
      );
      expect(campaign.thankYouPath).toBe(
        `/${campaign.identity.slug}/thank-you/`,
      );
    }
  });

  it("assigns a distinct internal identity to each campaign", () => {
    expect(
      AI_SEO_CAMPAIGNS.map(({ identity }) => [identity.key, identity.funnelId]),
    ).toEqual([
      ["lawyers", "ai-seo"],
      ["dentists", "ai-seo-dentists"],
      ["dental-implants", "ai-seo-dental-implants"],
      ["plastic-surgery", "ai-seo-plastic-surgery"],
      ["hair-restoration", "ai-seo-hair-restoration"],
      ["med-spas", "ai-seo-med-spas"],
    ]);
    expect(
      new Set(AI_SEO_CAMPAIGNS.map(({ identity }) => identity.funnelId)),
    ).toHaveLength(AI_SEO_CAMPAIGNS.length);
  });

  it("keeps browser and server Meta destinations in the campaign registry", () => {
    expect(
      AI_SEO_CAMPAIGNS.map(({ identity }) => [
        identity.key,
        identity.browserPixelEnvKey,
        identity.serverMetaDestination,
      ]),
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
      AI_SEO_CAMPAIGNS.map(({ identity, metadata }) => [
        identity.key,
        metadata.landingTitle,
        metadata.thankYouTitle,
      ]),
    ).toEqual([
      [
        "lawyers",
        "45 Qualified New-Client Inquiries in 90 Days for Law Firms | PulpSense",
        "Your Law-Firm Visibility Audit Is Booked | PulpSense",
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
      expect(campaign.metadata.landingDescription).toContain("Google and AI");
      expect(campaign.metadata.thankYouDescription).toContain("PulpSense");
      expect(JSON.stringify(campaign)).not.toContain("Lead Oracle");
    }
  });

  it("provides a relevant nationwide service callout for every niche", () => {
    expect(AI_SEO_CAMPAIGNS.map(({ landing }) => landing.hero.callout)).toEqual(
      [
        "⚖️ Proudly serving law firms nationwide",
        "🦷 Proudly serving dental practices nationwide",
        "🦷 Proudly serving dental implant practices nationwide",
        "✨ Proudly serving plastic surgery practices nationwide",
        "💇 Proudly serving hair restoration practices nationwide",
        "💉 Proudly serving med spas nationwide",
      ],
    );
  });

  it("keeps the law-firm offer aligned with the shared CRO presentation", () => {
    const [lawFirms, ...otherCampaigns] = AI_SEO_CAMPAIGNS;

    expect(lawFirms?.landing.hero.promise).toBe(
      "45 Qualified New-Client Inquiries",
    );
    expect(lawFirms?.landing.hero.ctaLabel).toBe(
      sharedLandingContent.hero.ctaLabel,
    );
    expect(lawFirms?.landing.benefits).toBe(sharedLandingContent.benefits);
    expect(lawFirms?.landing.results).toBe(sharedLandingContent.results);
    expect(lawFirms?.landing.reviews).toBe(sharedLandingContent.reviews);
    expect(lawFirms?.landing.offer).toBe(sharedLandingContent.offer);
    expect(lawFirms?.application.expectations).toBe(
      sharedApplicationContent.expectations,
    );
    expect(lawFirms?.thankYou.videos).toBe(sharedThankYouContent.videos);
    expect(lawFirms?.thankYou.reviews).toBe(sharedThankYouContent.reviews);
    expect(lawFirms?.landing.guarantee.terms).not.toBeNull();
    expect(lawFirms?.application.qualification).toEqual({
      kind: "owner-budget",
      ownerQuestion:
        "Are you the owner or primary decision-maker for the firm?",
      budgetQuestion:
        "What monthly marketing budget have you set aside to generate more qualified new-client inquiries?",
    });

    for (const campaign of otherCampaigns) {
      expect(campaign.landing.benefits).toBe(sharedLandingContent.benefits);
      expect(campaign.landing.results).toBe(sharedLandingContent.results);
      expect(campaign.landing.reviews).toBe(sharedLandingContent.reviews);
      expect(campaign.application.expectations).toBe(
        sharedApplicationContent.expectations,
      );
      expect(campaign.thankYou).toBe(sharedThankYouContent);
    }
  });

  it("keeps niche-specific qualification callouts", () => {
    expect(AI_SEO_CAMPAIGNS[1].application.callout).toContain(
      "dental practices",
    );
    expect(AI_SEO_CAMPAIGNS[2].application.callout).toContain(
      "implant practices",
    );
  });

  it("provides complete presentation content for every route shell", () => {
    for (const campaign of AI_SEO_CAMPAIGNS) {
      expect(campaign.landing.hero.ctaLabel.length).toBeGreaterThan(0);
      expect(campaign.landing.benefits.cards).toHaveLength(3);
      expect(campaign.landing.faq.items).toHaveLength(10);
      expect(campaign.application.expectations).toHaveLength(4);
      if (campaign.thankYou.videos) {
        expect(campaign.thankYou.videos.items).toHaveLength(5);
      }
    }
  });

  it("makes the law-firm guarantee terms conspicuous without removing standard proof", () => {
    const lawFirms = AI_SEO_CAMPAIGNS[0];
    if (!lawFirms) throw new Error("Law-firm campaign is missing");

    expect(lawFirms.landing.guarantee.terms?.items).toHaveLength(5);
    expect(lawFirms.application.guaranteeTerms).toBe(
      lawFirms.landing.guarantee.terms,
    );
    expect(JSON.stringify(lawFirms)).toContain(
      "return missed inquiries within 15 minutes",
    );
    expect(JSON.stringify(lawFirms)).toContain(
      "record dispositions within two business days",
    );

    const serialized = JSON.stringify(lawFirms);
    for (const retiredCopy of RETIRED_LAW_FIRM_COPY) {
      expect(serialized).not.toContain(retiredCopy);
    }
  });
});
