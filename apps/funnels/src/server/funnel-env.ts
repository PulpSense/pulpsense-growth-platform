export type FunnelEnv = {
  FUNNEL_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
  TURNSTILE_SECRET_KEY?: string;
  SUBMISSION_SIGNING_SECRET?: string;
  PULPSENSE_ENVIRONMENT?: "local" | "preview" | "production";
  MILLION_VERIFIER_API_KEY?: string;
  PULPSENSE_TRIGGER_API_ORIGIN?: string;
  PULPSENSE_TRIGGER_SECRET_KEY?: string;
  CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID?: string;
  CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID?: string;
  CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
};
