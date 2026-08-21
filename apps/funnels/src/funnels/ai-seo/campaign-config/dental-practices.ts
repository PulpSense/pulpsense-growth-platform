import { defineAiSeoCampaign } from "./define";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";

export const dentalPracticesCampaign = defineAiSeoCampaign({
  identity: {
    key: "dentists",
    slug: "visibility-audit/dental-practices",
    funnelId: "ai-seo-dentists",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_D",
    serverMetaDestination: "AI_SEO_D",
  },
  metadata: {
    landingTitle: "45 More Calls in 90 Days for Dental Practices | PulpSense",
    landingDescription:
      "Help more local patients find and call your dental practice through Google and AI search.",
    thankYouTitle: "Your Dental Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense dental visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "🦷 Proudly serving dental practices nationwide",
    },
  },
  application: {
    ...sharedApplicationContent,
    callout:
      "Many dental practices have no idea their next patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  },
  thankYou: sharedThankYouContent,
});
