export type MetaAction = {
  action_type?: string;
  value?: string;
};

export type RawMetaInsight = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  clicks?: string;
  impressions?: string;
  reach?: string;
  actions?: MetaAction[];
};

export type MetaMetrics = {
  campaignId?: string;
  campaignName?: string;
  spend: number;
  leads: number;
  metaBookings: number;
  clicks: number;
  impressions: number;
  reach: number;
  cpl: number | null;
  metaCpb: number | null;
  ctr: number;
  cpc: number | null;
  cpm: number;
  frequency: number | null;
};

export type Confidence = "insufficient" | "directional" | "decision-ready";

export const classifyConfidence = (
  spend: number,
  attributedBookings: number,
): Confidence => {
  if (spend < 100) return "insufficient";
  if (spend < 300 || attributedBookings < 3) return "directional";
  return "decision-ready";
};

export type BriefAlert = {
  code: "zero_verified_bookings" | "high_actual_cpb" | "tracking_discrepancy";
  severity: "warning" | "critical";
};

export const evaluateAlerts = (input: {
  spend: number;
  verifiedBookings: number;
  metaBookings: number;
  attributionReadyVerifiedBookings: number;
}): BriefAlert[] => {
  const alerts: BriefAlert[] = [];
  if (input.verifiedBookings === 0 && input.spend >= 200) {
    alerts.push({
      code: "zero_verified_bookings",
      severity: input.spend >= 300 ? "critical" : "warning",
    });
  }
  if (input.verifiedBookings > 0 && input.spend >= 300) {
    const actualCpb = input.spend / input.verifiedBookings;
    if (actualCpb > 130) {
      alerts.push({
        code: "high_actual_cpb",
        severity: actualCpb > 150 ? "critical" : "warning",
      });
    }
  }
  if (input.attributionReadyVerifiedBookings > input.metaBookings) {
    alerts.push({ code: "tracking_discrepancy", severity: "warning" });
  }
  return alerts;
};

const number = (value: string | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number) => Math.round(value * 100) / 100;

// Meta can return the same conversion in overlapping aggregate and pixel aliases.
// Use the largest alias value instead of summing so one conversion is counted once.
const actionValue = (actions: MetaAction[] | undefined, aliases: Set<string>) =>
  Math.max(
    0,
    ...(actions ?? [])
      .filter((action) => action.action_type && aliases.has(action.action_type))
      .map((action) => number(action.value)),
  );

const leadAliases = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);
const scheduleAliases = new Set([
  "schedule",
  "offsite_conversion.fb_pixel_schedule",
  "omni_schedule",
]);

export const parseMetaInsight = (raw: RawMetaInsight): MetaMetrics => {
  const spend = number(raw.spend);
  const clicks = number(raw.clicks);
  const impressions = number(raw.impressions);
  const reach = number(raw.reach);
  const leads = actionValue(raw.actions, leadAliases);
  const metaBookings = actionValue(raw.actions, scheduleAliases);

  return {
    ...(raw.campaign_id ? { campaignId: raw.campaign_id } : {}),
    ...(raw.campaign_name ? { campaignName: raw.campaign_name } : {}),
    spend,
    leads,
    metaBookings,
    clicks,
    impressions,
    reach,
    cpl: leads ? round(spend / leads) : null,
    metaCpb: metaBookings ? round(spend / metaBookings) : null,
    ctr: impressions ? round((clicks / impressions) * 100) : 0,
    cpc: clicks ? round(spend / clicks) : null,
    cpm: impressions ? round((spend / impressions) * 1000) : 0,
    frequency: reach ? round(impressions / reach) : null,
  };
};
