import { defineAiSeoCampaign } from "./define";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";

export const medSpasCampaign = defineAiSeoCampaign({
  identity: {
    key: "med-spas",
    slug: "visibility-audit/med-spas",
    funnelId: "ai-seo-med-spas",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_MS",
    serverMetaDestination: "AI_SEO_MS",
  },
  metadata: {
    landingTitle: "45 More Calls in 90 Days for Med Spas | PulpSense",
    landingDescription:
      "Help more local clients find and call your med spa through Google and AI search.",
    thankYouTitle: "Your Med Spa Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense med spa visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "💉 Proudly serving med spas nationwide",
    },
  },
  application: {
    ...sharedApplicationContent,
    callout:
      "Many med spas have no idea their next client just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  },
  thankYou: sharedThankYouContent,
});
