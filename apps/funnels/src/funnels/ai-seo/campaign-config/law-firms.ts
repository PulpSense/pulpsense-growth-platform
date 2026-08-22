import { LAW_FIRM_GROWTH_CONSTRAINTS } from "@pulpsense/contracts";

import { defineAiSeoCampaign } from "./define";
import { validateLawFirmCampaignPresentation } from "./law-firm-policy";
import {
  sharedApplicationContent,
  sharedLandingContent,
  sharedThankYouContent,
} from "./shared-content";
import type { GuaranteeTermsContent } from "./types";

const lawFirmGuaranteeTerms = {
  heading: "Material guarantee terms",
  items: [
    "Available only to approved applicants with agreed spend or growth capacity, source-system access, and decision-maker or operational-owner participation.",
    "A qualified inquiry is one unique prospective client in the agreed practice area and geography who meets the written case-type, timing, and payment or case-value screen.",
    "The inquiry must be attributable through call tracking, a tracked form, recorded attribution, or prospect self-report. Spam, vendors, duplicates, misdials, directions or general-information requests, and known disqualifying conflicts where reasonably determinable are excluded.",
    "The firm must provide required access and approvals, maintain agreed intake coverage, return missed inquiries within 15 minutes during declared coverage hours, and record dispositions within two business days.",
    "The guarantee does not promise retainers, case outcomes, collected fees, revenue, ROI, or rankings in Google, maps, LSAs, AI assistants, or any other third-party system.",
  ],
} as const satisfies GuaranteeTermsContent;

const lawFirmsCampaignConfig = defineAiSeoCampaign({
  identity: {
    key: "lawyers",
    slug: "visibility-audit/law-firms",
    funnelId: "ai-seo",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_L",
    serverMetaDestination: "AI_SEO_L",
  },
  metadata: {
    landingTitle:
      "45 Qualified New-Client Inquiries in 90 Days for Law Firms | PulpSense",
    landingDescription:
      "Help your law firm generate qualified new-client inquiries by improving visibility across Google and AI search.",
    thankYouTitle: "Your Law-Firm Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense law-firm visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "⚖️ Proudly serving law firms nationwide",
      promise: "45 Qualified New-Client Inquiries",
      lead: "Get found when potential clients in your market are ready to call. No ad spend. No shared leads. Results guaranteed, or you get fully refunded and keep everything we build.",
    },
    guarantee: {
      promise: "45 Qualified New-Client Inquiries",
      promiseSeparator: " ",
      timeframe: "in 90 Days",
      titleSeparator: "—",
      titleSuffix: "or Get Fully Refunded and Keep Everything We Build.",
      body: "If an approved firm receives fewer than 45 qualified new-client inquiries during the initial 90-day program, PulpSense refunds the service fees paid for that program. The firm keeps the transferable content, profiles, schema, citations, and tracking assets we built.",
      pills: [
        "One agreed practice area + market",
        "90 days after tracking and baseline approval",
        "Full refund of initial program service fees",
        "Transferable assets stay with your firm",
      ],
      terms: lawFirmGuaranteeTerms,
    },
    faq: {
      heading: "Frequently Asked Questions",
      items: [
        {
          question: "How much time does my team need to put in?",
          answer:
            "About 30 minutes during onboarding, then about 30 minutes each month to review results and align on strategy. We handle implementation between calls.",
        },
        {
          question: "How do you measure Google and AI visibility?",
          answer:
            "We benchmark your firm's presence across Google, organic search, AI Overviews, ChatGPT, and the sources those systems use for recommendations.",
        },
        {
          question: "What counts as a qualified new-client inquiry?",
          answer:
            "One unique prospective client in the agreed primary practice area and geography who meets the written case-type, timing, and payment or case-value screen established before the program begins.",
        },
        {
          question: "What if we already have an SEO agency?",
          answer:
            "We can complement existing SEO work by focusing on AI recommendations, business profiles, citations, reputation signals, and attribution.",
        },
        {
          question: "Does this work across multiple offices or locations?",
          answer:
            "Yes. The scope is built around the practice area, markets, offices, and competition that matter to your firm.",
        },
        {
          question: "How is this different from traditional paid advertising?",
          answer:
            "Paid ads stop when the budget stops. This system builds visibility across Google and AI that keeps sending prospective clients directly to your firm.",
        },
        {
          question: "How quickly should we expect movement?",
          answer:
            "We establish your baseline first, then prioritize the changes most likely to improve visibility. Early movement can happen within weeks, but stronger results depend on your starting point, market, competition, and the work required.",
        },
        {
          question:
            "What happens if we receive fewer than 45 qualified inquiries?",
          answer:
            "For an approved applicant that meets the agreed access, approval, intake, response, and disposition requirements, PulpSense refunds the service fees paid for the initial 90-day program. The firm keeps the transferable assets we built.",
        },
        {
          question: "Can you work with our website, CRM, and intake systems?",
          answer:
            "Yes. We review your website, CRM, intake, and existing marketing systems during onboarding, then coordinate implementation around the access and information available to us.",
        },
        {
          question: "Do you work with competing firms in the same market?",
          answer:
            "We work with one firm per agreed practice area in each market.",
        },
      ],
    },
  },
  application: {
    ...sharedApplicationContent,
    pageTitle: "Get Your Law-Firm Visibility Audit | PulpSense",
    pageDescription:
      "Share your details and one quick answer before booking a law-firm visibility audit.",
    promise: "45 Qualified New-Client Inquiries",
    titleSeparator: "—",
    titleSuffix: "or Get Fully Refunded and Keep Everything We Build.",
    intro:
      "Enter your details, then answer one quick question to see if your law firm qualifies for the guarantee.",
    guaranteeTerms: lawFirmGuaranteeTerms,
    qualification: {
      kind: "single-select",
      question:
        "What is currently stopping your firm from signing more matters?",
      analyticsField: "growth_constraint",
      submissionField: "growthConstraint",
      formVersion: "2026-08-22",
      options: LAW_FIRM_GROWTH_CONSTRAINTS,
    },
  },
  thankYou: {
    ...sharedThankYouContent,
    confirmation: {
      ...sharedThankYouContent.confirmation,
      intro:
        "Review this quick briefing before your Law-Firm Visibility Audit. 45 qualified new-client inquiries in 90 days, or you get fully refunded and keep everything we build.",
    },
  },
});

export const lawFirmsCampaign = validateLawFirmCampaignPresentation(
  lawFirmsCampaignConfig,
);
