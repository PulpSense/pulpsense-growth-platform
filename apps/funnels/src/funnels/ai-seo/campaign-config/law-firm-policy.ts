import type { AiSeoCampaignConfig } from "./types";

export const RETIRED_LAW_FIRM_COPY = ["legal inquiries"] as const;

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
    !campaign.application.guaranteeTerms
  ) {
    throw new Error("Law-firm campaign must show its guarantee terms");
  }

  return campaign;
};
