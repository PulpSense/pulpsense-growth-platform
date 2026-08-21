import { dentalImplantsCampaign } from "./dental-implants";
import { dentalPracticesCampaign } from "./dental-practices";
import { hairRestorationCampaign } from "./hair-restoration";
import { lawFirmsCampaign } from "./law-firms";
import { medSpasCampaign } from "./med-spas";
import { plasticSurgeryCampaign } from "./plastic-surgery";
import type { AiSeoCampaignConfig } from "./types";
import { validateAiSeoCampaigns } from "./validate";

export const AI_SEO_CAMPAIGNS = validateAiSeoCampaigns([
  lawFirmsCampaign,
  dentalPracticesCampaign,
  dentalImplantsCampaign,
  plasticSurgeryCampaign,
  hairRestorationCampaign,
  medSpasCampaign,
] as const);

const campaignsBySlug = new Map(
  AI_SEO_CAMPAIGNS.map((campaign) => [campaign.identity.slug, campaign]),
);

export function getAiSeoCampaignStaticPaths() {
  return AI_SEO_CAMPAIGNS.map((campaign) => ({
    params: { campaign: campaign.identity.slug },
    props: { campaign },
  }));
}

export function resolveAiSeoCampaign(slug: string) {
  return campaignsBySlug.get(slug);
}

export function resolveAiSeoBrowserPixelId(
  campaign: AiSeoCampaignConfig,
  environment: Readonly<Record<string, string | undefined>>,
) {
  return environment[campaign.identity.browserPixelEnvKey];
}

export type {
  AiSeoCampaignConfig,
  AiSeoCampaignKey,
  AiSeoFunnelId,
  ApplicationPageContent,
  LandingContent,
  ThankYouContent,
} from "./types";
