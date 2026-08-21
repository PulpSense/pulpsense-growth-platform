import type { AiSeoCampaignConfig } from "./types";

const requireUnique = (
  campaigns: readonly AiSeoCampaignConfig[],
  label: string,
  value: (campaign: AiSeoCampaignConfig) => string,
) => {
  const values = campaigns.map(value);
  if (new Set(values).size !== values.length) {
    throw new Error(`AI SEO campaigns must have unique ${label}`);
  }
};

export const validateAiSeoCampaigns = <
  const Campaigns extends readonly AiSeoCampaignConfig[],
>(
  campaigns: Campaigns,
): Campaigns => {
  if (campaigns.length !== 6) {
    throw new Error(
      "AI SEO campaign registry must contain exactly six campaigns",
    );
  }

  requireUnique(campaigns, "keys", (campaign) => campaign.identity.key);
  requireUnique(campaigns, "slugs", (campaign) => campaign.identity.slug);
  requireUnique(
    campaigns,
    "funnel IDs",
    (campaign) => campaign.identity.funnelId,
  );
  requireUnique(
    campaigns,
    "browser pixel keys",
    (campaign) => campaign.identity.browserPixelEnvKey,
  );
  requireUnique(
    campaigns,
    "server destinations",
    (campaign) => campaign.identity.serverMetaDestination,
  );

  for (const campaign of campaigns) {
    const root = `/${campaign.identity.slug}/`;
    if (
      campaign.landingPath !== root ||
      campaign.qualificationPath !== `${root}apply/` ||
      campaign.thankYouPath !== `${root}thank-you/`
    ) {
      throw new Error(
        `AI SEO campaign paths do not match slug: ${campaign.identity.key}`,
      );
    }
    if (!campaign.landing.hero.callout || !campaign.landing.hero.ctaLabel) {
      throw new Error(
        `AI SEO campaign hero is incomplete: ${campaign.identity.key}`,
      );
    }

    if (campaign.identity.key === "lawyers") {
      const serialized = JSON.stringify(campaign);
      for (const retiredCopy of [
        "45 New Calls",
        "45 additional calls",
        "Ranking #1 Google",
        "Top 3",
        "14 Days",
        "4.9/5",
        "Twin Oaks Dental",
        "Wesley Glen",
        "legal inquiries",
      ]) {
        if (serialized.includes(retiredCopy)) {
          throw new Error(
            `Law-firm campaign contains retired copy: ${retiredCopy}`,
          );
        }
      }
      if (
        !campaign.landing.guarantee.terms ||
        campaign.landing.results ||
        campaign.landing.reviews ||
        campaign.thankYou.videos ||
        campaign.thankYou.reviews
      ) {
        throw new Error(
          "Law-firm campaign must show its guarantee terms without cross-industry proof",
        );
      }
    }
  }

  return campaigns;
};
