export type FunnelRateLimitService = {
  fetch(input: string, init?: RequestInit): Promise<Response>;
};

export type FunnelEnv = {
  FUNNEL_RATE_LIMIT_SERVICE?: FunnelRateLimitService;
  TURNSTILE_SECRET_KEY?: string;
  SUBMISSION_SIGNING_SECRET?: string;
  PROSPECT_ID_SECRET?: string;
  PULPSENSE_ENVIRONMENT?: "local" | "preview" | "production";
  MILLION_VERIFIER_API_KEY?: string;
  PULPSENSE_TRIGGER_API_ORIGIN?: string;
  PULPSENSE_TRIGGER_SECRET_KEY?: string;
  PRECALL_OPT_OUT_TOKEN_SECRET?: string;
  CAL_WEBHOOK_SECRET?: string;
  TWENTY_WEBHOOK_SECRET?: string;
  TWENTY_PRODUCTION_WORKSPACE_ID?: string;
  CAL_BOOKING_LINK?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
};
