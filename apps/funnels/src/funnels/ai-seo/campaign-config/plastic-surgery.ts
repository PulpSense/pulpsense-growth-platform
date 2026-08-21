import { defineAiSeoCampaign } from "./define";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";

export const plasticSurgeryCampaign = defineAiSeoCampaign({
  identity: {
    key: "plastic-surgery",
    slug: "visibility-audit/plastic-surgery",
    funnelId: "ai-seo-plastic-surgery",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_PS",
    serverMetaDestination: "AI_SEO_PS",
  },
  metadata: {
    landingTitle: "45 More Calls in 90 Days for Plastic Surgeons | PulpSense",
    landingDescription:
      "Help more prospective patients find and call your plastic surgery practice through Google and AI search.",
    thankYouTitle:
      "Your Plastic Surgery Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense plastic surgery visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "✨ Proudly serving plastic surgery practices nationwide",
    },
  },
  application: {
    ...sharedApplicationContent,
    callout:
      "Many plastic surgery practices have no idea their next patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  },
  thankYou: sharedThankYouContent,
});
