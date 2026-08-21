import { defineAiSeoCampaign } from "./define";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";

export const hairRestorationCampaign = defineAiSeoCampaign({
  identity: {
    key: "hair-restoration",
    slug: "visibility-audit/hair-restoration",
    funnelId: "ai-seo-hair-restoration",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_HR",
    serverMetaDestination: "AI_SEO_HR",
  },
  metadata: {
    landingTitle: "45 More Hair Restoration Calls in 90 Days | PulpSense",
    landingDescription:
      "Help more hair restoration patients find and call your practice through Google and AI search.",
    thankYouTitle:
      "Your Hair Restoration Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense hair restoration visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "💇 Proudly serving hair restoration practices nationwide",
    },
  },
  application: {
    ...sharedApplicationContent,
    callout:
      "Many hair restoration practices have no idea their next patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  },
  thankYou: sharedThankYouContent,
});
