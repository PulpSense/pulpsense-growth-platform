// Shared CTA type for sections
export type SectionCTAConfig = {
  text: string;
  scrollTo?: string;
  href?: string;
};

// Hero Section Types
export type TrustBadgeConfig = {
  text: string;
  stars?: number;
  avatars?: string[];
};

export type BannerConfig = {
  text: string;
  variant: 'orange' | 'red';
};

export type VideoConfig =
  | { provider: 'wistia'; videoId: string }
  | { provider: 'youtube'; videoId: string }
  | { provider?: undefined; posterSrc?: string; altText?: string };

export type CTAConfig = {
  text: string;
  scrollTo?: string;
  href?: string;
  disclaimer?: string;
};

export type HeroSectionProps = {
  trustBadge: TrustBadgeConfig;
  banner: BannerConfig;
  headline: string;
  highlightedText?: string;
  headlineSuffix?: string;
  subheadline: string;
  video?: VideoConfig;
  cta: CTAConfig;
};

// Founder Story Types
export type FounderStoryImage = {
  src?: string; // Optional - shows placeholder if missing
  alt: string;
  caption: string;
};

export type FounderStoryProps = {
  sectionLabel?: string; // e.g., "WHO AM I?"
  name: string; // Highlighted name
  namePrefix?: string; // e.g., "MY NAME IS"
  paragraphs: string[];
  featuredImage?: FounderStoryImage;
  galleryImages?: FounderStoryImage[]; // 3 images with captions
  additionalContent?: {
    image?: FounderStoryImage;
    paragraphs: string[];
  };
  quote?: string;
  cta?: SectionCTAConfig;
};

// Program Overview Types
export type FeatureItem = {
  title: string;
  text: string;
};

export type HighlightBoxConfig = {
  title: string;
  content: string;
};

export type ProgramOverviewProps = {
  header: string;
  paragraphs: string[];
  highlightBox?: HighlightBoxConfig;
  features: FeatureItem[];
  cta?: SectionCTAConfig;
};

// FAQ Types
export type FAQItem = {
  question: string;
  answer: string;
};

export type FAQProps = {
  headerLabel?: string; // "FAQ" above main header
  header: string;
  items: FAQItem[];
  cta?: SectionCTAConfig;
};

// Application Section Types
export type ApplicationSectionProps = {
  header: string;
  description: string;
  urgency?: string;
  filloutId?: string;
};

// Disclaimer Footer Types
export type LegalLink = {
  text: string;
  href: string;
};

export type DisclaimerFooterProps = {
  disclaimerHeader: string;
  paragraphs: string[];
  legalLinks: LegalLink[];
  copyrightText: string;
  platformDisclaimer?: string;
};

// Thank You Section Types
export type ThankYouStepCTA = {
  text: string;
  subtext?: string;
  href: string;
};

export type ThankYouStep = {
  number: number;
  heading: string;
  description?: string;
  highlightedText?: string;
  cta?: ThankYouStepCTA;
  imageSrc?: string;
  imageAlt?: string;
};

export type ThankYouVideo = { title: string } & (
  | { provider: 'wistia'; videoId: string }
  | { provider: 'youtube'; videoId: string }
  | { provider?: undefined; thumbnailSrc?: string; href?: string }
);

export type ThankYouHeroProps = {
  title: string;
  subtitle: string;
  requiredLabel?: string;
  alertMessage?: string;
  videoPlaceholder?:
    | { provider: 'wistia'; videoId: string }
    | { provider: 'youtube'; videoId: string }
    | { provider?: undefined; title?: string; subtitle?: string };
};

export type ThankYouContentProps = {
  steps: ThankYouStep[];
  bottomVideos?: ThankYouVideo[];
};

// Unqualified Section Types
export type UnqualifiedHeroProps = {
  trustBadge?: TrustBadgeConfig;
  banner?: BannerConfig;
  title: string;
  subtitle: string;
  cta: { text: string; href: string };
};

export type UnqualifiedContentProps = {
  followUpMessage: string;
  requirements: string[];
  reapplyText: string;
  reapplyHref: string;
};

// Benefits Section Types (Case Study / Hook Section)
export type BenefitsSectionProps = {
  headline: string;
  benefits: string[];
  cta?: SectionCTAConfig;
};

// Problem Section Types
export type ProblemSectionProps = {
  headline: string;
  paragraphs: string[];
  /** Text to emphasize (will be bold if it matches a paragraph exactly) */
  emphasizedText?: string;
  highlight: string;
  conclusion: string;
  cta?: SectionCTAConfig;
};

// Results Section Types
export type ResultsSectionProps = {
  header: string;
  stats: string[];
};

// Testimonials Section Types
export type TestimonialItem = {
  quote: string;
  name: string;
  title: string;
  avatar?: string;
  stars?: number;
};

export type TestimonialsSectionProps = {
  header?: string;
  testimonials: TestimonialItem[];
};

// CTA Section Types
export type CTASectionProps = {
  id?: string;
  header: string;
  steps: string[];
  cta: {
    text: string;
    href: string;
  };
  urgency?: string;
  cardTitle?: string;
  cardSubtext?: string;
};

// VSL Hero Section Types
export type VSLHeroCheckoutConfig = {
  originalPrice: number;
  currentPrice: number;
  productLabels: string[];
  ctaText: string;
  ctaScrollTo?: string;
};

export type VSLHeroSectionProps = {
  announcementBar?: string;
  forLabel: string;
  headline: string;
  highlightedPrice?: string;
  subheadline: string;
  video: VideoConfig;
  checkout: VSLHeroCheckoutConfig;
};

// Bonus Section Types
export type BonusItem = {
  number: number;
  title: string;
  subtitle?: string;
  paragraphs: string[];
};

export type BonusSectionProps = {
  header: string;
  bonuses: BonusItem[];
  cta: SectionCTAConfig;
};

// Guarantee Section Types
export type GuaranteeSectionProps = {
  headline: string;
  paragraphs: string[];
  days: number;
  keepOnRefund?: boolean;
  cta: SectionCTAConfig;
};

// Scroller Summary Section Types
export type ScrollerSummarySectionProps = {
  label: string;
  heading: string;
  intro: string;
  items: string[];
  price: string;
  cta: SectionCTAConfig;
};
