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
    landingTitle:
      "45 Qualified Treatment Inquiries in 90 Days for Med Spas | PulpSense",
    landingDescription:
      "Help your med spa generate qualified local treatment inquiries through Google and AI search.",
    thankYouTitle: "Your Med Spa Visibility Audit Is Booked | PulpSense",
    thankYouDescription:
      "Confirm your appointment and prepare for your PulpSense med spa visibility audit.",
  },
  landing: {
    ...sharedLandingContent,
    hero: {
      ...sharedLandingContent.hero,
      callout: "💉 Proudly serving med spas nationwide",
      promise: "45 Qualified Treatment Inquiries",
      lead: "Get found when local patients are ready to call. No ad spend. No shared leads. Results guaranteed, or we work free until you get them.",
    },
    benefits: {
      heading: "Why Med Spas Are Moving Beyond Traditional Marketing",
      intro:
        "Prospective patients aren't navigating through ten search results anymore. They ask, compare, and call the practice they trust.",
      cards: [
        {
          icon: "📞",
          title: "More High-Intent Treatment Inquiries",
          body: "Appear when prospective patients are comparing local providers and ready to ask about a treatment.",
        },
        sharedLandingContent.benefits.cards[1],
        {
          icon: "🎯",
          title: "Patient Demand You Own",
          body: "These are direct inquiries to your practice, not shared leads sold to several local competitors as with traditional agencies.",
        },
      ],
    },
    marketShift: {
      ...sharedLandingContent.marketShift,
      heading: "Your Next Patient Is Asking Google and AI Who to Trust",
      intro:
        "They search, compare a short list, and contact the provider that feels most credible. If you're missing from that list, they choose another practice.",
    },
    education: {
      heading: "This Isn't Traditional SEO. This Isn't Ads.",
      intro:
        "Getting recommended by AI requires a different set of signals than traditional SEO or ads.",
      items: [
        {
          title: "AI Pulls From Sources Most Agencies Ignore",
          body: "ChatGPT and AI Overviews don't just read your website. They pull from map data, industry directories, citations, and review profiles, the sources many traditional SEO programs overlook.",
        },
        {
          title: "It's About Trust Signals, Not Keywords",
          body: "The practices AI can confidently surface have consistent listings, strong review profiles, structured data, and clean citations across the web. We build those visibility signals for you.",
        },
        {
          title: "Being Established Doesn't Make You Visible",
          body: "An established practice can still be hard to find in AI search. Visibility depends less on practice size than on whether the right local signals are in place.",
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
      heading: "How It Works for Your Practice",
      intro:
        "Your roadmap from hard to find to recommended. Your team invests about 30 minutes; we handle the rest.",
      steps: [
        {
          title: "We Audit Your Visibility (Day 1)",
          body: "We check where you stand on Google Maps, AI Overviews, and ChatGPT, live on a 15-minute call. You'll see where local treatment inquiries may be going instead.",
        },
        {
          title: "We Build Your Foundation (Weeks 1–3)",
          body: "Structured data so AI can read your practice, listings on the map and directory sources AI pulls from, Google Business Profile optimization, and content that matches what prospective patients ask about treatments.",
        },
        {
          title: "We Keep Your Practice Visible (Ongoing)",
          body: "Monthly re-audits, citation monitoring, profile management, and a simple report showing what moved and how many qualified treatment inquiries came in.",
        },
      ],
    },
    offer: {
      ...sharedLandingContent.offer,
      heading: "Everything You Need to Rank Across Google and AI",
      intro:
        "The scope is built around your treatments, market, current visibility, and local competition. We handle the implementation.",
      note: "We work with one med spa per agreed treatment category in each market.",
    },
    guarantee: {
      ...sharedLandingContent.guarantee,
      promise: "45 Qualified Treatment Inquiries",
      promiseSeparator: " ",
      body: "We build the system that gets your practice recommended across Google Maps, organic search, AI Overviews, and ChatGPT. If you do not receive 45 qualified treatment inquiries in 90 days, we work free until you do.",
      pills: [
        "✅ 45 qualified treatment inquiries in 90 days",
        sharedLandingContent.guarantee.pills[1],
        sharedLandingContent.guarantee.pills[2],
        sharedLandingContent.guarantee.pills[3],
      ],
    },
    faq: {
      ...sharedLandingContent.faq,
      items: [
        sharedLandingContent.faq.items[0],
        sharedLandingContent.faq.items[1],
        {
          question: "What counts as a qualified treatment inquiry?",
          answer:
            "We agree on the treatments, service area, inquiry criteria, baseline, and reporting process during onboarding, then review attributable qualified inquiries against that baseline over the 90-day period.",
        },
        sharedLandingContent.faq.items[3],
        {
          question: "Does this work across multiple locations?",
          answer:
            "Yes. The scope is built around the treatments, markets, locations, and local competition that matter to your practice.",
        },
        sharedLandingContent.faq.items[5],
        sharedLandingContent.faq.items[6],
        {
          question:
            "What happens if we do not receive 45 qualified treatment inquiries?",
          answer:
            "We continue working at no management fee until your practice receives the agreed result, consistent with the guarantee.",
        },
        sharedLandingContent.faq.items[8],
        {
          question: "Do you work with competing med spas in the same market?",
          answer:
            "We work with one med spa per agreed treatment category in each market.",
        },
      ],
    },
    reviews: sharedLandingContent.reviews
      ? {
          heading: "What Businesses We've Helped Say About Us",
        }
      : null,
  },
  application: {
    ...sharedApplicationContent,
    pageTitle: "Get Your Med-Spa Visibility Audit | PulpSense",
    pageDescription:
      "Share your details and two quick answers before booking a med-spa visibility audit.",
    promise: "45 Qualified Treatment Inquiries",
    intro:
      "Enter your details, then answer two quick questions to see if your established practice qualifies for the guarantee.",
    expectations: [
      sharedApplicationContent.expectations[0],
      {
        before: "We ",
        emphasis: "pull up your live rankings",
        after:
          " on the call and show you where you stand against local competitors appearing above you in Google Maps, AI Overviews, and ChatGPT.",
      },
      {
        before: "We estimate ",
        emphasis: "how many treatment inquiries you may be missing",
        after: " to the providers prospective patients are finding first.",
      },
      {
        before:
          "We map the exact 3 signals (Google Business Profile, Maps & AI search citations) that move your practice into the ",
        emphasis: "Top 3",
        after: ".",
      },
    ],
    callout:
      "Many practices do not know which local competitors Google or ChatGPT surfaces first. On the call, you'll see who is appearing ahead of you and which visibility gaps may be costing you treatment inquiries.",
    qualification: {
      kind: "owner-budget",
      ownerQuestion:
        "Are you the owner or primary decision-maker for the med spa?",
      budgetQuestion:
        "What monthly marketing budget have you set aside to generate more qualified treatment inquiries?",
    },
  },
  thankYou: {
    ...sharedThankYouContent,
    confirmation: {
      ...sharedThankYouContent.confirmation,
      intro:
        "Review this quick briefing before your Med-Spa Visibility Audit. 45 qualified treatment inquiries in 90 days. No ad spend. No shared leads. Results guaranteed, or we work free until you get them.",
    },
    calendar: {
      ...sharedThankYouContent.calendar,
      beforeConfirmation:
        "Search your inbox and spam for your Med-Spa Visibility Audit invitation. Open it and click ",
    },
    videos: sharedThankYouContent.videos
      ? {
          ...sharedThankYouContent.videos,
          heading: "Step 2: Hear From Businesses We've Helped",
        }
      : null,
    reviews: sharedThankYouContent.reviews
      ? {
          heading: "What Businesses We've Helped Say About Us",
        }
      : null,
  },
});
