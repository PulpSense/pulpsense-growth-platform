import type { AiSeoCampaignConfig } from "./types";

export const RETIRED_LAW_FIRM_COPY = [
  "45 New Calls",
  "45 additional calls",
  "Ranking #1 Google",
  "Top 3",
  "14 Days",
  "4.9/5",
  "Twin Oaks Dental",
  "Wesley Glen",
  "legal inquiries",
] as const;

export const validateLawFirmCampaignPresentation = <
  const Campaign extends AiSeoCampaignConfig,
>(
  campaign: Campaign,
): Campaign => {
  const serialized = JSON.stringify(campaign);
  for (const retiredCopy of RETIRED_LAW_FIRM_COPY) {
    if (serialized.includes(retiredCopy)) {
      throw new Error(
        `Law-firm campaign contains retired copy: ${retiredCopy}`,
      );
    }
  }

  if (
    !campaign.landing.guarantee.terms ||
    !campaign.application.guaranteeTerms ||
    campaign.landing.results ||
    campaign.landing.reviews ||
    campaign.thankYou.videos ||
    campaign.thankYou.reviews
  ) {
    throw new Error(
      "Law-firm campaign must show its guarantee terms without cross-industry proof",
    );
  }

  return campaign;
};
