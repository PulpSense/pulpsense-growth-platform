import type { LeadMagnetOptInEvent } from "@pulpsense/contracts";

export type LeadMagnetEmail = LeadMagnetOptInEvent["emailContent"];

export type LeadMagnetConfig = {
  id: string;
  slug: string;
  seo: { title: string; description: string };
  page: {
    eyebrow: string;
    headline: string;
    accent: string;
    description: string;
    benefits: string[];
    compatibility: string;
    cardEyebrow: string;
    cardTitle: string;
    cardDescription: string;
    buttonLabel: string;
    successTitle: string;
    successDescription: string;
  };
  renderEmail(firstName: string): LeadMagnetEmail;
};

export const defineLeadMagnet = <const Config extends LeadMagnetConfig>(
  config: Config,
) => config;
