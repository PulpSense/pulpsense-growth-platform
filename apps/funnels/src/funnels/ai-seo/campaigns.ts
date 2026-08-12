import type { FunnelId } from "@pulpsense/contracts";

export type AiSeoCampaignKey =
  | "lawyers"
  | "dentists"
  | "dental-implants"
  | "plastic-surgery"
  | "hair-restoration"
  | "med-spas";
export type AiSeoFunnelId = Extract<
  FunnelId,
  | "ai-seo"
  | "ai-seo-dentists"
  | "ai-seo-dental-implants"
  | "ai-seo-plastic-surgery"
  | "ai-seo-hair-restoration"
  | "ai-seo-med-spas"
>;

export type AiSeoCampaign = {
  key: AiSeoCampaignKey;
  slug: string;
  funnelId: AiSeoFunnelId;
  browserPixelEnvKey: `PUBLIC_${string}`;
  serverMetaDestination:
    | "AI_SEO_L"
    | "AI_SEO_D"
    | "AI_SEO_DI"
    | "AI_SEO_PS"
    | "AI_SEO_HR"
    | "AI_SEO_MS";
  landingPath: string;
  thankYouPath: string;
  landingTitle: string;
  landingDescription: string;
  thankYouTitle: string;
  thankYouDescription: string;
  qualificationCallout: string;
};

export const DEFAULT_AI_SEO_QUALIFICATION_CALLOUT =
  "Many established businesses have no idea their next customer just went to a competitor that Google or ChatGPT recommended first. On the call, you'll see exactly who's getting picked ahead of you, and what it's costing you.";

const defineCampaign = (
  campaign: Omit<
    AiSeoCampaign,
    "landingPath" | "thankYouPath" | "qualificationCallout"
  > &
    Partial<Pick<AiSeoCampaign, "qualificationCallout">>,
): AiSeoCampaign => ({
  ...campaign,
  landingPath: `/${campaign.slug}/`,
  thankYouPath: `/${campaign.slug}/thank-you/`,
  qualificationCallout:
    campaign.qualificationCallout ?? DEFAULT_AI_SEO_QUALIFICATION_CALLOUT,
});

export const AI_SEO_CAMPAIGNS = [
  defineCampaign({
    key: "lawyers",
    slug: "regional-visibility-audit/law-firms",
    funnelId: "ai-seo",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_L",
    serverMetaDestination: "AI_SEO_L",
    landingTitle: "45 More Calls in 90 Days for Law Firms | PulpSense",
    landingDescription:
      "Help your law firm earn more direct calls by improving visibility across Google and AI search.",
    thankYouTitle: "Your Law Firm Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense law firm visibility audit.",
  }),
  defineCampaign({
    key: "dentists",
    slug: "regional-visibility-audit/dental-practices",
    funnelId: "ai-seo-dentists",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_D",
    serverMetaDestination: "AI_SEO_D",
    landingTitle: "45 More Calls in 90 Days for Dental Practices | PulpSense",
    landingDescription:
      "Help more local patients find and call your dental practice through Google and AI search.",
    thankYouTitle: "Your Dental Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense dental visibility audit.",
    qualificationCallout:
      "Many dental practices have no idea their next patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  }),
  defineCampaign({
    key: "dental-implants",
    slug: "regional-visibility-audit/dental-implants",
    funnelId: "ai-seo-dental-implants",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_DI",
    serverMetaDestination: "AI_SEO_DI",
    landingTitle: "45 More Implant Calls in 90 Days | PulpSense",
    landingDescription:
      "Help more implant patients find and call your practice through Google and AI search.",
    thankYouTitle: "Your Dental Implant Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense dental implant visibility audit.",
    qualificationCallout:
      "Many implant practices have no idea their next high-value patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  }),
  defineCampaign({
    key: "plastic-surgery",
    slug: "regional-visibility-audit/plastic-surgery",
    funnelId: "ai-seo-plastic-surgery",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_PS",
    serverMetaDestination: "AI_SEO_PS",
    landingTitle: "45 More Calls in 90 Days for Plastic Surgeons | PulpSense",
    landingDescription:
      "Help more prospective patients find and call your plastic surgery practice through Google and AI search.",
    thankYouTitle:
      "Your Plastic Surgery Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense plastic surgery visibility audit.",
    qualificationCallout:
      "Many plastic surgery practices have no idea their next patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  }),
  defineCampaign({
    key: "hair-restoration",
    slug: "regional-visibility-audit/hair-restoration",
    funnelId: "ai-seo-hair-restoration",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_HR",
    serverMetaDestination: "AI_SEO_HR",
    landingTitle: "45 More Hair Restoration Calls in 90 Days | PulpSense",
    landingDescription:
      "Help more hair restoration patients find and call your practice through Google and AI search.",
    thankYouTitle:
      "Your Hair Restoration Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense hair restoration visibility audit.",
    qualificationCallout:
      "Many hair restoration practices have no idea their next patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  }),
  defineCampaign({
    key: "med-spas",
    slug: "regional-visibility-audit/med-spas",
    funnelId: "ai-seo-med-spas",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_MS",
    serverMetaDestination: "AI_SEO_MS",
    landingTitle: "45 More Calls in 90 Days for Med Spas | PulpSense",
    landingDescription:
      "Help more local clients find and call your med spa through Google and AI search.",
    thankYouTitle: "Your Med Spa Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense med spa visibility audit.",
    qualificationCallout:
      "Many med spas have no idea their next client just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  }),
] as const satisfies readonly AiSeoCampaign[];

const campaignsBySlug = new Map(
  AI_SEO_CAMPAIGNS.map((campaign) => [campaign.slug, campaign]),
);

export function getAiSeoCampaignStaticPaths() {
  return AI_SEO_CAMPAIGNS.map((campaign) => ({
    params: { campaign: campaign.slug },
    props: { campaign },
  }));
}

export function resolveAiSeoCampaign(slug: string) {
  return campaignsBySlug.get(slug);
}

export function resolveAiSeoBrowserPixelId(
  campaign: AiSeoCampaign,
  environment: Readonly<Record<string, string | undefined>>,
) {
  return environment[campaign.browserPixelEnvKey];
}
