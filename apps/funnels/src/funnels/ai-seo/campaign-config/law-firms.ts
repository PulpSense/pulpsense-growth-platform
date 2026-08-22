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
    "If an approved firm receives fewer than 45 qualified new-client inquiries in the initial 90-day program while meeting the agreed requirements, PulpSense continues the agreed services at no service fee until the target is reached.",
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
      lead: "Get found when potential clients in your market are ready to call. No ad spend. No shared leads. Results guaranteed, or we work free until you get them.",
    },
    benefits: {
      heading: "Why Law Firms Are Moving Beyond Traditional Marketing",
      intro:
        "Potential clients aren't navigating through ten search results anymore. They ask, and they call the firm they're given.",
      cards: [
        {
          icon: "📞",
          title: "More High-Intent Inquiries",
          body: "Appear when potential clients in your market are actively comparing law firms and ready to speak with one.",
        },
        sharedLandingContent.benefits.cards[1],
        {
          icon: "🎯",
          title: "New-Client Demand You Own",
          body: "These are direct inquiries to your firm, not shared leads sold to several competing firms as with traditional agencies.",
        },
      ],
    },
    marketShift: {
      heading:
        "Your Next Client Is Asking Google and AI Which Law Firm to Trust",
      intro:
        "They search, compare a short list, and contact the most credible firm. If you're missing from that list, they call another firm.",
      stats: [
        {
          value: "200M+",
          label:
            "People use ChatGPT every week to decide which providers to trust",
        },
        {
          value: "Top 3",
          label: "The positions that receive most Google & AI inquiries",
        },
        {
          value: "14 Days",
          label: "To start climbing in Google & AI search",
        },
      ],
      note: "Establish your firm's authority early before AI recommendations get more competitive.",
    },
    comparison: {
      ...sharedLandingContent.comparison,
      rows: sharedLandingContent.comparison.rows.map((row) =>
        row.feature === "Guarantee"
          ? {
              ...row,
              pulpsense: "45 qualified inquiries or we work free",
            }
          : row,
      ),
    },
    education: {
      heading: "This Isn't Traditional Law-Firm SEO. This Isn't Ads.",
      intro:
        "Getting your firm recommended by AI is a different game, and most firms in your market aren't playing it yet.",
      items: [
        {
          title: "AI Pulls From Sources Most Agencies Ignore",
          body: "ChatGPT and AI Overviews don't just read your website. They pull from map data, legal directories, citations, and review profiles, the exact sources most SEO shops never touch.",
        },
        {
          title: "It's About Trust Signals, Not Keywords",
          body: "The law firms AI recommends have consistent listings, strong review profiles, structured data, and clean citations across the web. We build every one of those signals for you.",
        },
        {
          title: "Being a Large Firm Doesn't Make You Visible",
          body: "Plenty of established firms are completely invisible in AI search because nobody optimized for it. This isn't about firm size, it's about whether you've been set up for AI specifically.",
        },
      ],
    },
    results: sharedLandingContent.results
      ? {
          ...sharedLandingContent.results,
          heading: "Real Google and AI Visibility Results",
          intro:
            "These examples come from other local-service businesses and show what happened when they put our visibility system to work.",
        }
      : null,
    process: {
      heading: "How It Works for Your Firm",
      intro:
        "Your roadmap from invisible to recommended. Your team invests about 30 minutes, we handle the rest.",
      steps: [
        {
          title: "We Audit Your Firm's Visibility (Day 1)",
          body: "We check where your firm stands on Google Maps, AI Overviews, and ChatGPT, live, on a 15-minute call. You'll see exactly what's costing you inquiries.",
        },
        {
          title: "We Build Your Foundation (Weeks 1–3)",
          body: "Structured data so AI can read your firm, listings on the map and legal-directory sources AI pulls from, Google Business Profile optimization, and content that matches what potential clients ask.",
        },
        {
          title: "We Keep Your Firm Visible (Ongoing)",
          body: "Monthly re-audits, citation monitoring, profile management, and a simple report showing exactly what moved and how many qualified inquiries you're getting.",
        },
      ],
    },
    offer: {
      heading: "Everything Your Firm Needs to Rank Across Google and AI",
      intro:
        "The scope is built around your practice areas, markets, current visibility, and competition. We handle the implementation.",
      items: [
        {
          emphasis: "Google Business Profile optimization",
          after:
            ', built around the exact "money keywords" potential clients search',
        },
        {
          emphasis: "Listings on 50+ directories AI cross-checks",
          after:
            ", including the trust signals ChatGPT and AI Overviews pull from",
        },
        {
          emphasis: "Review system built for your firm",
          after:
            ", turns your 5-star reviews into ranking fuel, not just stars",
        },
        {
          emphasis: "Ongoing profile activity & management",
          after:
            ", so Google never marks your firm inactive while competitors post",
        },
        {
          emphasis: "AI-ready practice-area content",
          after:
            ", structured so Google and AI can understand and recommend your firm",
        },
        {
          emphasis: "Monthly re-audits + a simple report",
          after:
            ", what moved, where you rank, and how many qualified inquiries came in",
        },
      ],
      ctaLabel: sharedLandingContent.offer.ctaLabel,
      note: "We work with one firm per agreed practice area in each market.",
    },
    guarantee: {
      promise: "45 Qualified New-Client Inquiries",
      promiseSeparator: " ",
      timeframe: "in 90 Days",
      titleSeparator: ". ",
      titleSuffix: "Or We Work Free Until You Do.",
      body: "We build the system that gets your firm recommended across Google Maps, organic search, AI Overviews, and ChatGPT. If you do not receive 45 qualified new-client inquiries in 90 days, we work free until you do.",
      pills: [
        "✅ 45 qualified new-client inquiries in 90 days",
        "✅ We continue free if we miss the target",
        "✅ No paid advertising required",
        "✅ Baseline agreed during onboarding",
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
            "For an approved applicant that meets the agreed access, approval, intake, response, and disposition requirements, we continue the agreed services at no service fee until the firm receives 45 qualified new-client inquiries.",
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
    reviews: sharedLandingContent.reviews
      ? {
          heading: "What Clients Say About Working With Us",
        }
      : null,
  },
  application: {
    ...sharedApplicationContent,
    pageTitle: "Get Your Law-Firm Visibility Audit | PulpSense",
    pageDescription:
      "Share your details and two quick answers before booking a law-firm visibility audit.",
    promise: "45 Qualified New-Client Inquiries",
    titleSeparator: ". ",
    titleSuffix: "Or We Work Free Until You Do.",
    intro:
      "Enter your details, then answer two quick questions to see if your law firm qualifies for the guarantee.",
    expectations: [
      sharedApplicationContent.expectations[0],
      {
        before: "We ",
        emphasis: "pull up your firm's live rankings",
        after:
          " on the call and show you exactly where you stand against the firms ranking above you in Google Maps, AI Overviews, and ChatGPT.",
      },
      {
        before: "We estimate ",
        emphasis: "how many inquiries you're losing every month",
        after: " to the firms potential clients are finding first.",
      },
      {
        before:
          "We map the exact 3 signals (Google Business Profile, Maps & AI search citations) that move your firm into the ",
        emphasis: "Top 3",
        after: ".",
      },
    ],
    callout:
      "Many established firms have no idea their next client just went to a competitor that Google or ChatGPT recommended first. On the call, you'll see exactly who's getting picked ahead of you, and what it's costing your firm.",
    guaranteeTerms: lawFirmGuaranteeTerms,
    qualification: {
      kind: "owner-budget",
      ownerQuestion:
        "Are you the owner or primary decision-maker for the firm?",
      budgetQuestion:
        "What monthly marketing budget have you set aside to generate more qualified new-client inquiries?",
    },
  },
  thankYou: {
    ...sharedThankYouContent,
    confirmation: {
      ...sharedThankYouContent.confirmation,
      intro:
        "Review this quick briefing before your Law-Firm Visibility Audit. 45 qualified new-client inquiries in 90 days. No ad spend. No shared leads. Results guaranteed, or we work free until you get them.",
    },
    calendar: {
      ...sharedThankYouContent.calendar,
      beforeConfirmation:
        "Search your inbox and spam for your Law-Firm Visibility Audit invitation. Open it and click ",
    },
    videos: sharedThankYouContent.videos
      ? {
          ...sharedThankYouContent.videos,
          heading: "Step 2: Hear From Businesses We've Helped",
        }
      : null,
    reviews: sharedThankYouContent.reviews
      ? {
          heading: "What Clients Say About Working With Us",
        }
      : null,
  },
});

export const lawFirmsCampaign = validateLawFirmCampaignPresentation(
  lawFirmsCampaignConfig,
);
