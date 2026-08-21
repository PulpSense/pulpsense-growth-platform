import type { AiSeoCampaignConfig, AiSeoCampaignInput } from "./types";

export const defineAiSeoCampaign = (
  campaign: AiSeoCampaignInput,
): AiSeoCampaignConfig => ({
  ...campaign,
  landingPath: `/${campaign.identity.slug}/`,
  qualificationPath: `/${campaign.identity.slug}/apply/`,
  thankYouPath: `/${campaign.identity.slug}/thank-you/`,
});
