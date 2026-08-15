import metaOfferIntelligenceSkill from "./configs/meta-offer-intelligence-skill.js";
import type { LeadMagnetConfig } from "./define-lead-magnet.js";

export type {
  LeadMagnetConfig,
  LeadMagnetEmail,
} from "./define-lead-magnet.js";

export const LEAD_MAGNETS = [
  metaOfferIntelligenceSkill,
] as const satisfies readonly LeadMagnetConfig[];

const byId = new Map<string, LeadMagnetConfig>(
  LEAD_MAGNETS.map((config) => [config.id, config]),
);

export const resolveLeadMagnet = (id: string) => byId.get(id);

export const getLeadMagnetStaticPaths = () =>
  LEAD_MAGNETS.map((config) => ({
    params: { leadMagnet: config.slug },
    props: { config },
  }));
