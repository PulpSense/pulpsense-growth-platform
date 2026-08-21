import { defineAiSeoCampaign } from "./define";
import { validateLawFirmCampaignPresentation } from "./law-firm-policy";
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
      "See whether your law firm qualifies for a source-to-signature growth program with Google and AI diagnostics and a 45 qualified new-client inquiry guarantee.",
    thankYouTitle: "Your Law-Firm Growth Audit Is Booked | PulpSense",
    thankYouDescription:
      "Prepare the source-to-signature numbers for your PulpSense law-firm growth audit.",
  },
  landing: {
    hero: {
      callout: "⚖️ Law-firm pilot for approved US firms",
      badge: null,
      promise: "45 Qualified New-Client Inquiries",
      timeframePrefix: "in",
      timeframe: "90 Days",
      titleSeparator: "—",
      titleSuffix: "or Get Fully Refunded and Keep Everything We Build.",
      lead: "For consumer and local-service law firms with the capacity, data access, and intake discipline to turn qualified demand into signed matters. We connect marketing activity to intake, consultations, and signed matters before recommending more spend.",
      ctaLabel: "See If Your Firm Qualifies",
      note: {
        emphasis: "Approved applicants only.",
        after:
          " One agreed practice area and market; the 90-day period begins after tracking is live and the baseline is approved.",
      },
      showDeck: false,
      logoLabel: null,
    },
    benefits: {
      heading: "Your Partners Care About Signed Matters—Not Raw Call Volume",
      intro:
        "The pilot measures the full path from first inquiry to signed matter, so you can see whether the constraint is demand, response, qualification, consultation, or attribution.",
      cards: [
        {
          icon: "🎯",
          title: "Lead Quality Before Volume",
          body: "Define the practice area, geography, case type, timing, and payment or case-value screen before an inquiry counts toward the guarantee.",
        },
        {
          icon: "🔗",
          title: "Source-to-Signature Visibility",
          body: "Connect calls and forms to intake dispositions, consultations, and signed matters instead of stopping the report at leads.",
        },
        {
          icon: "🔍",
          title: "Fix Leakage Before Adding Spend",
          body: "Find the highest-value break in the current funnel, then decide whether the next move is better demand capture, faster response, stronger qualification, or cleaner measurement.",
        },
      ],
    },
    marketShift: {
      heading: "See Where Qualified Demand Stops Becoming Signed Matters",
      intro:
        "A healthy top-line inquiry count can hide missed responses, poor-fit prospects, consultation no-shows, and attribution gaps.",
      stats: [
        {
          value: "Inquiry",
          label:
            "Was the prospect unique, attributable, and inside the agreed screen?",
        },
        {
          value: "Consultation",
          label:
            "Did intake respond, qualify, schedule, and record the outcome?",
        },
        {
          value: "Signed Matter",
          label: "Can the firm trace the retained client back to the source?",
        },
      ],
      note: "The audit uses your definitions and source systems; it does not assume universal conversion benchmarks.",
    },
    comparison: {
      heading: "Raw Lead Reporting vs. Source-to-Signature Visibility",
      intro:
        "The goal is not a prettier lead dashboard. It is a shared operating view of what arrived, what qualified, what progressed, and where value leaked.",
      headings: ["Question", "Raw lead reporting", "PulpSense pilot"],
      rows: [
        {
          feature: "What counts?",
          alternative: "Calls and forms",
          pulpsense: "Written qualified-inquiry definition",
        },
        {
          feature: "Where did it come from?",
          alternative: "Platform-reported source",
          pulpsense:
            "Call, form, recorded attribution, or prospect self-report",
        },
        {
          feature: "What happened next?",
          alternative: "Usually unknown",
          pulpsense: "Disposition, consultation, and signed-matter status",
        },
        {
          feature: "What gets fixed first?",
          alternative: "More traffic",
          pulpsense: "The highest-value measurable leak",
        },
        {
          feature: "Who owns the work?",
          alternative: "Often vendor-dependent",
          pulpsense: "The firm keeps transferable assets we build",
        },
      ],
    },
    education: {
      heading: "What Counts as a Qualified New-Client Inquiry?",
      intro:
        "The definition is agreed in writing before the baseline is approved, then applied consistently during the initial 90-day program.",
      items: [
        {
          title: "A Real Potential New Client",
          body: "One unique prospective client in the agreed practice area and geography who meets the written case-type, timing, and payment or case-value screen.",
        },
        {
          title: "Attributable to the Program",
          body: "The inquiry is connected through call tracking, a tracked form, recorded attribution, or the prospect's own source report.",
        },
        {
          title: "Noise Is Excluded",
          body: "Spam, vendors, duplicates, misdials, directions or general-information requests, and known disqualifying conflicts where reasonably determinable do not count.",
        },
      ],
    },
    results: null,
    process: {
      heading: "Start With the Funnel You Already Have",
      intro:
        "The first working session establishes the definitions, evidence, and priorities required for a measured pilot.",
      steps: [
        {
          title: "Approve the Baseline and Tracking",
          body: "Agree on one primary practice area and market, the qualified-inquiry screen, declared intake coverage, attribution sources, and starting numbers.",
        },
        {
          title: "Map the Source-to-Signature Funnel",
          body: "Review the last 60–90 days of spend, inquiries, consultations, signed matters, fee or value range, intake coverage, and available source-system data.",
        },
        {
          title: "Prioritize the 90-Day Test Plan",
          body: "Use one practice-area economics model, one Google and AI visibility sample, and three priority gaps to decide what to test after prerequisites are confirmed.",
        },
      ],
    },
    offer: {
      heading: "Map My Firm's Lost-Matter Funnel",
      intro:
        "The live audit turns your existing numbers into a practical source-to-signature working session.",
      items: [
        {
          emphasis: "Current source-to-signature funnel map",
          after: ", from inquiry through consultation and signed matter",
        },
        {
          emphasis: "One-practice-area economics model",
          after: ", using your fee or value range and current funnel inputs",
        },
        {
          emphasis: "One Google and AI visibility sample",
          after:
            ", a dated diagnostic of observable results and sources, not a ranking promise",
        },
        {
          emphasis: "Three priority measurement or conversion gaps",
          after: ", ranked by evidence and likely operational impact",
        },
        {
          emphasis: "Conditional 90-day test plan",
          after:
            ", finalized only after access, baseline, and dependencies are confirmed",
        },
      ],
      ctaLabel: "Map My Firm's Lost-Matter Funnel",
      note: "This is a law-firm pilot for approved applicants. The guarantee's eligibility, measurement, intake, and attribution terms are shown directly below.",
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
          question: "How are the 45 inquiries measured?",
          answer:
            "The 90-day period begins only after tracking is live and the baseline is approved. An inquiry must be attributable through call tracking, a tracked form, recorded attribution, or the prospect's own source report, then recorded against the agreed definition.",
        },
        {
          question: "What counts as a qualified new-client inquiry?",
          answer:
            "One unique prospective client in the agreed primary practice area and geography who meets the written case-type, timing, and payment or case-value screen established before the program begins.",
        },
        {
          question: "What does not count?",
          answer:
            "Spam, vendors, duplicate inquiries, misdials, directions or general-information requests, and known disqualifying conflicts where reasonably determinable are excluded.",
        },
        {
          question: "What is our intake team's responsibility?",
          answer:
            "Your firm provides required access and approvals, maintains the agreed intake coverage, returns missed inquiries within 15 minutes during declared coverage hours, and records dispositions within two business days.",
        },
        {
          question: "Which systems do you need access to?",
          answer:
            "Access depends on your current stack and may include call tracking, website forms, analytics and search tools, CRM or intake software, case-management dispositions, business profiles, and other agreed source systems. We confirm the minimum access before approving the baseline.",
        },
        {
          question: "What happens during the live audit?",
          answer:
            "We map the current source-to-signature funnel, build one practice-area economics model, review one Google and AI visibility sample, identify three priority gaps, and outline a 90-day test plan subject to access and dependencies.",
        },
        {
          question: "How quickly should we expect movement?",
          answer:
            "The guarantee window starts after tracking is live and the baseline is approved. The sequence and timing of specific changes depend on your market, current assets, approvals, intake readiness, and the gaps confirmed during the audit.",
        },
        {
          question: "Do you guarantee Google or AI rankings?",
          answer:
            "No. Google, map products, LSAs, AI assistants, and their cited sources are dynamic third-party systems. We audit dated observable outputs and improve eligible digital evidence; we do not promise placement or control recommendations.",
        },
        {
          question: "Who owns the work and data?",
          answer:
            "Your firm keeps its data and the transferable content, profiles, schema, citations, and tracking assets PulpSense builds for the initial program. Access and transfer details are confirmed during onboarding.",
        },
        {
          question:
            "What happens if the program produces fewer than 45 qualified inquiries?",
          answer:
            "For an approved applicant that meets the agreed access, approval, intake, response, and disposition requirements, PulpSense refunds the service fees paid for the initial 90-day program. This does not guarantee retainers, case outcomes, collected fees, revenue, ROI, or rankings.",
        },
      ],
    },
    reviews: null,
    stickyCta: { label: "See If Your Firm Qualifies" },
  },
  application: {
    pageTitle: "See If Your Law Firm Qualifies | PulpSense",
    pageDescription:
      "Share your details and one quick answer before booking a law-firm growth audit.",
    badge: null,
    promise: "45 Qualified New-Client Inquiries",
    timeframe: "90 Days",
    titleSeparator: "—",
    titleSuffix: "or Get Fully Refunded and Keep Everything We Build.",
    intro:
      "Enter your details, then answer one quick question about what is holding back signed-matter growth. Final guarantee eligibility and baseline terms are approved in writing.",
    expectationHeading: "What to prepare for the live audit",
    expectations: [
      {
        emphasis: "Last 60–90 days of channel and program spend",
        after: ", separated by source where available",
      },
      {
        emphasis: "Inquiry and consultation counts",
        after: ", including dispositions, response coverage, and show outcomes",
      },
      {
        emphasis: "Signed-matter count and fee or value range",
        after:
          ", without confidential client facts, case merits, or legal-advice details",
      },
      {
        emphasis: "Source-system and intake access",
        after:
          ", so we can assess attribution, response, qualification, and measurement gaps",
      },
    ],
    callout:
      "The audit produces a current funnel map, one-practice-area economics model, one dated Google and AI visibility sample, three priority gaps, and a conditional 90-day test plan. AI visibility is diagnostic; no search or AI placement is guaranteed.",
    guaranteeTerms: lawFirmGuaranteeTerms,
    proofRating: null,
    proofLabel: null,
  },
  thankYou: {
    confirmation: {
      heading: "Your law-firm source-to-signature audit is booked",
      intro:
        "Bring the last 60–90 days of spend, new-client inquiries, consultations, signed matters, fee or value range, intake coverage, and available source-system reports. Do not send confidential client facts or case details.",
      showDeck: false,
    },
    calendar: {
      stepLabel: "Required step",
      heading: "Confirm your calendar invite",
      beforeConfirmation:
        "Search your inbox and spam for the Law-Firm Source-to-Signature Audit invitation. Open it and click ",
      confirmationLabel: '"Yes"',
      afterConfirmation:
        " so we know the time is confirmed and can prepare the working session.",
      imageSrc: "/ai-seo/images/calendar-confirmation.webp",
      imageAlt:
        "Google Calendar invitation email: tap Yes to confirm your law-firm growth audit",
    },
    videos: null,
    reviews: null,
  },
});

export const lawFirmsCampaign = validateLawFirmCampaignPresentation(
  lawFirmsCampaignConfig,
);
