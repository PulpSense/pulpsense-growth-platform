import type { FunnelId } from "@pulpsense/contracts";

export type AiSeoCampaignKey =
  | "lawyers"
  | "dentists"
  | "dental-implants"
  | "plastic-surgery"
  | "hair-restoration"
  | "med-spas";

export type AiSeoFunnelId = Extract<
  FunnelId,
  | "ai-seo"
  | "ai-seo-dentists"
  | "ai-seo-dental-implants"
  | "ai-seo-plastic-surgery"
  | "ai-seo-hair-restoration"
  | "ai-seo-med-spas"
>;

export type AiSeoMetaDestination =
  | "AI_SEO_L"
  | "AI_SEO_D"
  | "AI_SEO_DI"
  | "AI_SEO_PS"
  | "AI_SEO_HR"
  | "AI_SEO_MS";

export type BenefitContent = {
  icon: string;
  title: string;
  body: string;
};

export type MetricContent = { label: string; value: string };

export type RichLineContent = {
  before?: string;
  emphasis: string;
  after?: string;
};

export type LandingContent = {
  hero: {
    callout: string;
    badge: string;
    promise: string;
    timeframePrefix: string;
    timeframe: string;
    titleSuffix: string;
    lead: string;
    ctaLabel: string;
    note: RichLineContent;
    logoLabel: string;
  };
  benefits: {
    heading: string;
    intro: string;
    cards: readonly BenefitContent[];
  };
  marketShift: {
    heading: string;
    intro: string;
    stats: readonly MetricContent[];
    note: string;
  };
  comparison: {
    heading: string;
    intro: string;
    headings: readonly [string, string, string];
    rows: readonly {
      feature: string;
      alternative: string;
      pulpsense: string;
    }[];
  };
  education: {
    heading: string;
    intro: string;
    items: readonly { title: string; body: string }[];
  };
  results: {
    heading: string;
    intro: string;
    items: readonly {
      badge: string;
      name: string;
      metrics: readonly MetricContent[];
      summary: string;
    }[];
    rating: string;
    ratingLabel: string;
  };
  process: {
    heading: string;
    intro: string;
    steps: readonly { title: string; body: string }[];
  };
  offer: {
    heading: string;
    intro: string;
    items: readonly RichLineContent[];
    ctaLabel: string;
    note: string;
  };
  guarantee: {
    promise: string;
    timeframe: string;
    titleSuffix: string;
    body: string;
    pills: readonly string[];
  };
  faq: {
    heading: string;
    items: readonly { question: string; answer: string }[];
  };
  reviews: {
    heading: string;
  };
  stickyCta: { label: string };
};

export type ApplicationPageContent = {
  badge: string;
  promise: string;
  timeframe: string;
  titleSuffix: string;
  intro: string;
  expectationHeading: string;
  expectations: readonly RichLineContent[];
  callout: string;
  proofRating: string;
  proofLabel: string;
};

export type ThankYouContent = {
  confirmation: {
    heading: string;
    intro: string;
  };
  calendar: {
    stepLabel: string;
    heading: string;
    beforeConfirmation: string;
    confirmationLabel: string;
    afterConfirmation: string;
    imageSrc: string;
    imageAlt: string;
  };
  videos: {
    heading: string;
    items: readonly { title: string; mediaId: string; label: string }[];
  };
  reviews: {
    heading: string;
  };
};

type DeepReadonly<Value> = Value extends object
  ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
  : Value;

type AiSeoCampaignShape = {
  identity: {
    key: AiSeoCampaignKey;
    funnelId: AiSeoFunnelId;
    slug: string;
    browserPixelEnvKey: `PUBLIC_${string}`;
    serverMetaDestination: AiSeoMetaDestination;
  };
  metadata: {
    landingTitle: string;
    landingDescription: string;
    thankYouTitle: string;
    thankYouDescription: string;
  };
  landing: LandingContent;
  application: ApplicationPageContent;
  thankYou: ThankYouContent;
  landingPath: string;
  qualificationPath: string;
  thankYouPath: string;
};

export type AiSeoCampaignConfig = DeepReadonly<AiSeoCampaignShape>;

export type AiSeoCampaignInput = DeepReadonly<
  Omit<AiSeoCampaignShape, "landingPath" | "qualificationPath" | "thankYouPath">
>;
