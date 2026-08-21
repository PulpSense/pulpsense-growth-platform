import type {
  ApplicationPageContent,
  LandingContent,
  ThankYouContent,
} from "./types";

export const sharedLandingContent = {
  hero: {
    callout: "",
    badge: "Rated 4.9/5 by 100+ Service Business Owners",
    promise: "45 New Calls",
    timeframePrefix: "in",
    timeframe: "90 Days",
    titleSeparator: " ",
    titleSuffix: "by Ranking #1 Google & ChatGPT",
    lead: "Get found when people in your market are ready to call. No ad spend. No shared leads. Results guaranteed, or we work free until you get them.",
    ctaLabel: "Get Your Visibility Audit",
    note: {
      emphasis: "Over 200M people",
      after:
        " use ChatGPT every week to decide which service businesses to trust.",
    },
    showDeck: true,
    logoLabel: "Trusted by Growing Businesses",
  },
  benefits: {
    heading:
      "Why Regional Service Businesses Are Moving Beyond Traditional Marketing",
    intro:
      "They aren't navigating through ten search results anymore. They ask, and they call the name they're given.",
    cards: [
      {
        icon: "📞",
        title: "More High-Intent Calls",
        body: "Appear when people in your market are actively comparing providers and ready to contact someone.",
      },
      {
        icon: "🤖",
        title: "Google + AI Visibility",
        body: "Build visibility across Google Maps, organic search, AI Overviews, and the sources AI assistants use to make recommendations.",
      },
      {
        icon: "🎯",
        title: "Demand You Own",
        body: "These are direct inquiries to your business, not shared leads sold to several competitors as with traditional agencies.",
      },
    ],
  },
  marketShift: {
    heading: "Your Next Customer Is Asking Google and AI Who They Should Trust",
    intro:
      "They search, compare a short list, and contact the most credible provider. If you're missing from that list, they call someone else.",
    stats: [
      {
        value: "200M+",
        label:
          "People use ChatGPT every week to decide which service company to trust",
      },
      {
        value: "Top 3",
        label: "The positions that receive most Google & AI calls",
      },
      {
        value: "14 Days",
        label: "To start climbing in Google & AI search",
      },
    ],
    note: "Establish authority early before AI recommendations get more competitive.",
  },
  comparison: {
    heading: "Traditional Paid Ads vs. AI Search",
    intro:
      "Paid ads stop when the budget stops. Our system builds visibility that keeps sending people directly to your business.",
    headings: ["Feature", "Traditional Paid Ads", "PulpSense"],
    rows: [
      {
        feature: "Google and AI visibility",
        alternative: "Stops outside ads",
        pulpsense: "Built into strategy",
      },
      {
        feature: "Lead ownership",
        alternative: "Routed through platforms",
        pulpsense: "Direct to your business",
      },
      {
        feature: "Competition",
        alternative: "Pay more to compete",
        pulpsense: "Build market authority",
      },
      {
        feature: "Ongoing ad spend",
        alternative: "Required for leads",
        pulpsense: "No ad spend required",
      },
      {
        feature: "Shared leads",
        alternative: "Often shared",
        pulpsense: "Never shared",
      },
      {
        feature: "Guarantee",
        alternative: "Usually none",
        pulpsense: "45 calls or free",
      },
    ],
  },
  education: {
    heading: "This Isn't SEO. This Isn't Ads.",
    intro:
      "Getting recommended by AI is a different game, and almost nobody in your market is playing it yet.",
    items: [
      {
        title: "AI Pulls From Sources Most Agencies Ignore",
        body: "ChatGPT and AI Overviews don't just read your website. They pull from map data, business directories, citations, and review profiles, the exact sources most SEO shops never touch.",
      },
      {
        title: "It's About Trust Signals, Not Keywords",
        body: "The service businesses AI recommends have consistent listings, strong review profiles, structured data, and clean citations across the web. We build every one of those signals for you.",
      },
      {
        title: "Being Big Doesn't Make You Visible",
        body: "Plenty of large companies are completely invisible in AI search because nobody optimized for it. This isn't about size, it's about whether you've been set up for AI specifically.",
      },
    ],
  },
  results: {
    heading: "Real Results from Regional Service Businesses",
    intro:
      "Don't take our word for it. See what happened when service businesses put our system to work.",
    items: [
      {
        badge: "✓ Client result",
        name: "Wesley Glen Retirement Community",
        metrics: [
          { label: "Google Maps & AI rank", value: "Not ranked → #2" },
          { label: "Time to rank", value: "2 weeks" },
        ],
        summary: "From scratch to #2 in Google & AI in just 2 weeks.",
      },
      {
        badge: "✓ Client result",
        name: "Twin Oaks Dental & Wellness",
        metrics: [
          { label: "Monthly calls", value: "10 → 48" },
          { label: "Increase", value: "+380%" },
        ],
        summary: "Nearly 5× more calls every month.",
      },
    ],
    rating: "4.9/5",
    ratingLabel: "from 100+ service business owners",
  },
  process: {
    heading: "How It Works",
    intro:
      "Your roadmap from invisible to recommended. You invest about 30 minutes, we handle the rest.",
    steps: [
      {
        title: "We Audit Your Visibility (Day 1)",
        body: "We check where you stand on Google Maps, AI Overviews, and ChatGPT, live, on a 15-minute call. You'll see exactly what's costing you calls.",
      },
      {
        title: "We Build Your Foundation (Weeks 1–3)",
        body: "Structured data so AI can read your business, listings on the map and directory sources AI actually pulls from, Google Business Profile optimization, and content that matches what customers ask.",
      },
      {
        title: "We Keep You Visible (Ongoing)",
        body: "Monthly re-audits, citation monitoring, profile management, and a simple report showing exactly what moved and how many calls you're getting.",
      },
    ],
  },
  offer: {
    heading: "Everything Needed to Rank Across Google and AI",
    intro:
      "The scope is built around your services, markets, current visibility, and competition. We handle the implementation.",
    items: [
      {
        emphasis: "Google Business Profile optimization",
        after: ', built around the exact "money keywords" customers search',
      },
      {
        emphasis: "Listings on 50+ directories AI cross-checks",
        after: ", the trust signals ChatGPT and AI Overviews pull from",
      },
      {
        emphasis: "Keyword-rich review system",
        after: ", turns your 5-star reviews into ranking fuel, not just stars",
      },
      {
        emphasis: "Ongoing profile activity & management",
        after: ", so Google never marks you inactive while competitors post",
      },
      {
        emphasis: "AI-ready service content",
        after:
          ", structured so Google and AI can understand and recommend your business",
      },
      {
        emphasis: "Monthly re-audits + a simple report",
        after: ", what moved, where you rank, and how many calls came in",
      },
    ],
    ctaLabel: "Get Your Visibility Audit",
    note: "We work with one business per service category in each market.",
  },
  guarantee: {
    promise: "45 New Calls",
    promiseSeparator: "",
    timeframe: "in 90 Days",
    titleSeparator: ". ",
    titleSuffix: "Or We Work Free Until You Do.",
    body: "We build the system that gets your business recommended across Google Maps, organic search, AI Overviews, and ChatGPT. If you do not receive 45 additional calls in 90 days, we work free until you do.",
    pills: [
      "✅ 45 additional calls in 90 days",
      "✅ We continue free if we miss the target",
      "✅ No paid advertising required",
      "✅ Baseline agreed during onboarding",
    ],
    terms: null,
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
          "We benchmark your presence across Google, organic search, AI Overviews, ChatGPT, and the sources those systems use for recommendations.",
      },
      {
        question:
          "How will we determine whether the 45-call target was reached?",
        answer:
          "We agree on the baseline and reporting process during onboarding, then review the call count against that baseline over the 90-day period.",
      },
      {
        question: "What if we already have an SEO agency?",
        answer:
          "We can complement existing SEO work by focusing on AI recommendations, business profiles, citations, and reputation signals.",
      },
      {
        question: "Does this work across multiple offices or locations?",
        answer:
          "Yes. The scope is built around the services, markets, locations, and competition that matter to your business.",
      },
      {
        question: "How is this different from traditional paid advertising?",
        answer:
          "Paid ads stop when the budget stops. This system builds visibility across Google and AI that keeps sending people directly to your business.",
      },
      {
        question: "How quickly should we expect movement?",
        answer:
          "We establish your baseline first, then prioritize the changes most likely to improve visibility. Early movement can happen within weeks, but stronger results depend on your starting point, market, competition, and the work required. We monitor progress and adjust strategy as we go.",
      },
      {
        question: "What happens if we do not receive 45 additional calls?",
        answer:
          "We continue working at no management fee until you receive the agreed result, consistent with the guarantee.",
      },
      {
        question:
          "Can you work with our website, CRM, and existing marketing systems?",
        answer:
          "Yes. We review your website, CRM, and existing marketing systems during onboarding, then coordinate implementation around the access and information available to us.",
      },
      {
        question: "Do you work with competing businesses in the same market?",
        answer:
          "No. We value our clients and work with one business per service category in each market.",
      },
    ],
  },
  reviews: {
    heading: "What Service Business Owners Say About Us",
  },
  stickyCta: { label: "Get Your Visibility Audit" },
} as const satisfies LandingContent;

export const sharedApplicationContent = {
  pageTitle: null,
  pageDescription: null,
  badge: "Rated 4.9/5 by 100+ Service Business Owners",
  promise: "45 New Calls",
  timeframe: "90 Days",
  titleSeparator: ". ",
  titleSuffix: "Or We Work Free Until You Do.",
  intro:
    "Enter your details, then answer a few quick questions to see if your established service business qualifies for the guarantee.",
  expectationHeading: "What to expect on our call",
  expectations: [
    {
      emphasis: "No pressure, ever.",
      after:
        " We run your Google & AI visibility audit live on the call, and you walk away with real findings whether we work together or not.",
    },
    {
      before: "We ",
      emphasis: "pull up your live rankings",
      after:
        " on the call and show you exactly where you stand against the businesses ranking above you in Google Maps, AI Overviews, and ChatGPT.",
    },
    {
      before: "We estimate ",
      emphasis: "how much revenue you're losing every month",
      after: " to the competitors your customers are calling first.",
    },
    {
      before:
        "We map the exact 3 signals (Google Business Profile, Maps & AI search citations) that move you into the ",
      emphasis: "Top 3",
      after: ".",
    },
  ],
  callout:
    "Many established businesses have no idea their next customer just went to a competitor that Google or ChatGPT recommended first. On the call, you'll see exactly who's getting picked ahead of you, and what it's costing you.",
  proofRating: "4.9/5",
  proofLabel: "from 100+ service business owners",
} as const satisfies ApplicationPageContent;

export const sharedThankYouContent = {
  confirmation: {
    heading: "ONE LAST THING: Complete these required steps ✅",
    intro:
      "Review this quick briefing before your Regional Visibility Audit. 45 calls in 90 days. No ad spend. No shared leads. Results guaranteed, or we work free until you get them.",
    showDeck: true,
  },
  calendar: {
    stepLabel: "Step 1",
    heading: "Confirm your calendar invite",
    beforeConfirmation:
      "Search your inbox and spam for your Regional Visibility Audit invitation. Open it and click ",
    confirmationLabel: '"Yes"',
    afterConfirmation: " so we know the time is locked into your calendar.",
    imageSrc: "/ai-seo/images/calendar-confirmation.webp",
    imageAlt:
      "Google Calendar invitation email: tap Yes to confirm your discovery call",
  },
  videos: {
    heading: "Step 2: Hear from business owners like you",
    items: [
      {
        title: "Nick Saraev — Founder at Leftclick.ai",
        mediaId: "tam0inpvqg",
        label: "Testimonial from Nick Saraev",
      },
      {
        title: "Eric von Schumann — Founder at Redomiciled",
        mediaId: "p8fr4xpew8",
        label: "Testimonial from Eric von Schumann",
      },
      {
        title: "Charlie Vicente — Co-Founder at Ares Projects",
        mediaId: "mg51fk3kah",
        label: "Testimonial from Charlie Vicente",
      },
      {
        title: "Chase Wicklund — CEO at StackEleven Marketing",
        mediaId: "nrehjvyz7s",
        label: "Testimonial from Chase Wicklund",
      },
      {
        title: "Frank van den Oever — CEO at YMF Global",
        mediaId: "ge2tc7bxu9",
        label: "Testimonial from Frank van den Oever",
      },
    ],
  },
  reviews: {
    heading: "What Local Businesses Say About Us",
  },
} as const satisfies ThankYouContent;
