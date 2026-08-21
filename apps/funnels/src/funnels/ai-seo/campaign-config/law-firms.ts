import { defineAiSeoCampaign } from "./define";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";

export const lawFirmsCampaign = defineAiSeoCampaign({
  identity: {
    key: "lawyers",
    slug: "visibility-audit/law-firms",
    funnelId: "ai-seo",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_L",
    serverMetaDestination: "AI_SEO_L",
  },
  metadata: {
    landingTitle: "45 More Calls in 90 Days for Law Firms | PulpSense",
    landingDescription:
      "Help your law firm earn more direct calls by improving visibility across Google and AI search.",
    thankYouTitle: "Your Law Firm Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense law firm visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "⚖️ Proudly serving law firms nationwide",
    },
  },
  application: sharedApplicationContent,
  thankYou: sharedThankYouContent,
});
