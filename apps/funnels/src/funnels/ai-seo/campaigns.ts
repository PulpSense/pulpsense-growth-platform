import type { FunnelId } from "@pulpsense/contracts";

export type AiSeoCampaignKey = "lawyers" | "dentists";
export type AiSeoFunnelId = Extract<FunnelId, "ai-seo" | "ai-seo-dentists">;

export type AiSeoCampaign = {
  key: AiSeoCampaignKey;
  slug: string;
  funnelId: AiSeoFunnelId;
  landingPath: string;
  thankYouPath: string;
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
    slug: "regional-visibility-audit/law-firms",
    funnelId: "ai-seo",
  }),
  defineCampaign({
    key: "dentists",
    slug: "regional-visibility-audit/dental-practices",
    funnelId: "ai-seo-dentists",
  }),
] as const satisfies readonly AiSeoCampaign[];

export function resolveAiSeoBrowserPixelId(
  campaign: AiSeoCampaign,
  pixels: Partial<Record<AiSeoCampaignKey, string | undefined>>,
) {
  return pixels[campaign.key];
}
