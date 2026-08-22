import type { AiSeoCampaignConfig } from "./types";

export const RETIRED_LAW_FIRM_COPY = [
  "legal inquiries",
  "45 calls or free",
  "refund",
  "Why Regional Service Businesses Are Moving Beyond Traditional Marketing",
  "This Isn't Traditional Law-Firm SEO",
  "Which Law Firm to Trust",
  "Law-Firm Visibility Audit invitation",
  "Step 2: Hear From Businesses We've Helped",
] as const;

export const validateLawFirmCampaignPresentation = <
  const Campaign extends AiSeoCampaignConfig,
>(
  campaign: Campaign,
): Campaign => {
  const serialized = JSON.stringify(campaign);
  const normalized = serialized.toLowerCase();
  for (const retiredCopy of RETIRED_LAW_FIRM_COPY) {
    if (normalized.includes(retiredCopy.toLowerCase())) {
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
