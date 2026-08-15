import type { LeadMagnetConfig } from "./define-lead-magnet";

const modules = import.meta.glob<{ default: LeadMagnetConfig }>(
  "./configs/*.ts",
  { eager: true },
);

export const LEAD_MAGNETS = Object.values(modules).map(
  ({ default: config }) => config,
);

const byId = new Map(LEAD_MAGNETS.map((config) => [config.id, config]));

export const resolveLeadMagnet = (id: string) => byId.get(id);

export const getLeadMagnetStaticPaths = () =>
  LEAD_MAGNETS.map((config) => ({
    params: { leadMagnet: config.slug },
    props: { config },
  }));
