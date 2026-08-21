import { defineAiSeoCampaign } from "./define";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";

export const dentalImplantsCampaign = defineAiSeoCampaign({
  identity: {
    key: "dental-implants",
    slug: "visibility-audit/dental-implants",
    funnelId: "ai-seo-dental-implants",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_DI",
    serverMetaDestination: "AI_SEO_DI",
  },
  metadata: {
    landingTitle: "45 More Implant Calls in 90 Days | PulpSense",
    landingDescription:
      "Help more implant patients find and call your practice through Google and AI search.",
    thankYouTitle: "Your Dental Implant Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense dental implant visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "🦷 Proudly serving dental implant practices nationwide",
    },
  },
  application: {
    ...sharedApplicationContent,
    callout:
      "Many implant practices have no idea their next high-value patient just called the practice Google or ChatGPT recommended first. On the call, you'll see exactly who is getting picked ahead of you, and what it's costing you.",
  },
  thankYou: sharedThankYouContent,
});
