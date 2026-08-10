import type { FunnelId } from "@pulpsense/contracts";

export const AI_SEO_LAWYERS_PRODUCTION_PIXEL_ID = "2262354061181522";

export type AiSeoCampaignKey = "lawyers" | "dentists";
export type AiSeoFunnelId = Extract<FunnelId, "ai-seo" | "ai-seo-dentists">;

export type AiSeoCampaign = {
  key: AiSeoCampaignKey;
  slug: string;
  funnelId: AiSeoFunnelId;
  landingPath: string;
  thankYouPath: string;
  productionMetaPixelId?: string;
};

const defineCampaign = (
  campaign: Omit<AiSeoCampaign, "landingPath" | "thankYouPath">,
): AiSeoCampaign => ({
  ...campaign,
  landingPath: `/${campaign.slug}/`,
  thankYouPath: `/${campaign.slug}/thank-you/`,
});

export const AI_SEO_CAMPAIGNS = [
  defineCampaign({
    key: "lawyers",
    slug: "local-growth-6732ef498c",
    funnelId: "ai-seo",
    productionMetaPixelId: AI_SEO_LAWYERS_PRODUCTION_PIXEL_ID,
  }),
  defineCampaign({
    key: "dentists",
    slug: "local-growth-51d2a5f4f2",
    funnelId: "ai-seo-dentists",
  }),
] as const satisfies readonly AiSeoCampaign[];

export function resolveAiSeoBrowserPixelId(
  campaign: AiSeoCampaign,
  pixels: Partial<Record<AiSeoCampaignKey, string | undefined>>,
) {
  return pixels[campaign.key];
}
