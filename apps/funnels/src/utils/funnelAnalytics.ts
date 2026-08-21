import type posthog from "posthog-js";
import { z } from "zod";

import type { DeploymentEnvironment } from "@/lib/funnel/runtime-config";

type FunnelStep = "contact" | "qualification" | "booking";
export const CTA_PLACEMENTS = [
  "hero",
  "proof",
  "mechanism",
  "faq",
  "final",
  "mobile_sticky",
] as const;
export type CtaPlacement = (typeof CTA_PLACEMENTS)[number];
type MediaAction = "play" | "pause" | "unmute" | "mute" | "seek";
type BookingAction = "widget_viewed" | "booking_successful";

export type FunnelAnalyticsEventProperties = {
  funnel_viewed: {
    page: "landing" | "application" | "qualified" | "unqualified";
  };
  funnel_step_viewed: { step: FunnelStep };
  funnel_validation_failed: { step: FunnelStep; fields: string[] };
  funnel_step_completed: { step: Exclude<FunnelStep, "booking"> };
  qualification_outcome: { status: "qualified" | "unqualified" };
  cta_clicked: { placement: CtaPlacement };
  media_interaction: { action: MediaAction; media_id: string };
  booking_interaction: { action: BookingAction };
  funnel_deck_slide_viewed: {
    deck_id: string;
    slide_id: string;
    slide_index: number;
  };
  funnel_qualification_submitted: {
    qualification_status: "qualified" | "unqualified";
    qualification_form_id: string;
    qualification_form_version: string;
    qualification_questions: Record<string, string>;
    qualification_answers: Record<string, unknown>;
  };
};

export type FunnelAnalyticsEvent = keyof FunnelAnalyticsEventProperties;

type AnalyticsConfig = {
  apiKey: string;
  host: string;
  environment: DeploymentEnvironment;
  funnelId: string;
};

type FailureDetail = {
  code: "posthog_delivery_failed";
  event: FunnelAnalyticsEvent;
};

type PostHogAdapter = Pick<
  typeof posthog,
  | "init"
  | "capture"
  | "identify"
  | "reset"
  | "get_distinct_id"
  | "get_session_id"
>;

type AnalyticsRuntime = { posthog?: PostHogAdapter };

const allowedFields = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "businessOwner",
  "marketingBudget",
  "investmentIntent",
]);

const ctaPlacements: ReadonlySet<string> = new Set(CTA_PLACEMENTS);

export const isCtaPlacement = (value: unknown): value is CtaPlacement =>
  typeof value === "string" && ctaPlacements.has(value);

const allowedValues = {
  funnel_viewed: {
    page: new Set(["landing", "application", "qualified", "unqualified"]),
  },
  funnel_step_viewed: {
    step: new Set(["contact", "qualification", "booking"]),
  },
  funnel_validation_failed: {
    step: new Set(["contact", "qualification", "booking"]),
  },
  funnel_step_completed: { step: new Set(["contact", "qualification"]) },
  qualification_outcome: {
    status: new Set(["qualified", "unqualified"]),
  },
  cta_clicked: {
    placement: ctaPlacements,
  },
  media_interaction: {
    action: new Set(["play", "pause", "unmute", "mute", "seek"]),
  },
  booking_interaction: {
    action: new Set(["widget_viewed", "booking_successful"]),
  },
  funnel_deck_slide_viewed: {},
  funnel_qualification_submitted: {
    qualification_status: new Set(["qualified", "unqualified"]),
  },
} satisfies Record<FunnelAnalyticsEvent, Record<string, ReadonlySet<string>>>;

const reportFailure = (detail: FailureDetail) => {
  console.warn("PulpSense analytics delivery failed", detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pulpsense:analytics-failure", { detail }),
    );
  }
};

const safeIdentifier = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9-]{1,100}$/u.test(value)
    ? value
    : undefined;

const uuidSchema = z.uuid();
const safeUuid = (value: unknown) => {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const sanitizedProperties = <Event extends FunnelAnalyticsEvent>(
  event: Event,
  properties: FunnelAnalyticsEventProperties[Event],
) => {
  const safe: Record<string, unknown> = {};
  const eventRules = allowedValues[event];

  for (const [key, allowed] of Object.entries(eventRules)) {
    const value = (properties as Record<string, unknown>)[key];
    if (typeof value === "string" && allowed.has(value)) safe[key] = value;
  }

  if (event === "funnel_validation_failed") {
    const fields = (properties as Record<string, unknown>).fields;
    if (Array.isArray(fields)) {
      safe.fields = fields.filter(
        (field): field is string =>
          typeof field === "string" && allowedFields.has(field),
      );
    }
  }

  if (event === "media_interaction") {
    const mediaId = safeIdentifier(
      (properties as Record<string, unknown>).media_id,
    );
    if (mediaId) safe.media_id = mediaId;
  }

  if (event === "funnel_deck_slide_viewed") {
    const input =
      properties as FunnelAnalyticsEventProperties["funnel_deck_slide_viewed"];
    const deckId = safeIdentifier(input.deck_id);
    const slideId = safeIdentifier(input.slide_id);
    if (deckId && slideId && Number.isInteger(input.slide_index)) {
      Object.assign(safe, {
        deck_id: deckId,
        slide_id: slideId,
        slide_index: input.slide_index,
      });
    }
  }

  if (event === "funnel_qualification_submitted") {
    const input =
      properties as FunnelAnalyticsEventProperties["funnel_qualification_submitted"];
    const formId = safeIdentifier(input.qualification_form_id);
    if (
      formId &&
      /^\d{4}-\d{2}-\d{2}$/u.test(input.qualification_form_version)
    ) {
      Object.assign(safe, {
        qualification_form_id: formId,
        qualification_form_version: input.qualification_form_version,
        qualification_questions: input.qualification_questions,
        qualification_answers: input.qualification_answers,
      });
    }
  }

  return safe;
};

const normalizeHost = (host: string) => {
  if (host.startsWith("/") && !host.startsWith("//")) {
    const url = new URL(host, "https://proxy.invalid");
    if (url.search || url.hash) {
      throw new Error("PostHog proxy path cannot contain a query or hash");
    }
    return url.pathname.replace(/\/+$/u, "");
  }
  const url = new URL(host);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PostHog host must use HTTP(S)");
  }
  url.pathname = url.pathname.replace(/\/+$/u, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
};

export function createFunnelAnalyticsClient(
  config: AnalyticsConfig,
  runtime: AnalyticsRuntime,
) {
  const client = runtime.posthog;
  if (!client) throw new Error("PostHog adapter is required");
  const enabled = config.environment === "production" && Boolean(config.apiKey);

  if (enabled) {
    client.init(config.apiKey, {
      api_host: normalizeHost(config.host),
      ui_host: config.host.includes("eu.i.posthog.com")
        ? "https://eu.posthog.com"
        : "https://us.posthog.com",
      autocapture: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: true,
      },
      capture_performance: { network_timing: true, web_vitals: false },
      capture_pageview: false,
      disable_session_recording: false,
      person_profiles: "identified_only",
      session_recording: {
        maskAllInputs: false,
        recordHeaders: true,
        recordBody: true,
      },
    });
  }

  return {
    capture<Event extends FunnelAnalyticsEvent>(
      event: Event,
      properties: FunnelAnalyticsEventProperties[Event],
      capturedAt?: Date,
    ) {
      if (!enabled) return false;
      try {
        client.capture(
          event,
          {
            funnel_id: config.funnelId,
            ...sanitizedProperties(event, properties),
          },
          ...(capturedAt ? [{ timestamp: capturedAt }] : []),
        );
        return true;
      } catch {
        reportFailure({ code: "posthog_delivery_failed", event });
        return false;
      }
    },
    getIdentity() {
      if (!enabled) return {};
      const analyticsId = safeUuid(client.get_distinct_id());
      const sessionId = safeUuid(client.get_session_id());
      return {
        ...(analyticsId ? { analyticsId } : {}),
        ...(sessionId ? { sessionId } : {}),
      };
    },
    identify(
      prospectId: string,
      properties: Record<string, unknown>,
      propertiesSetOnce: Record<string, unknown>,
    ) {
      if (!enabled) return;
      const currentId = client.get_distinct_id();
      if (currentId.startsWith("prospect_v1_") && currentId !== prospectId) {
        client.reset();
      }
      client.identify(prospectId, properties, propertiesSetOnce);
    },
    reset() {
      if (enabled) client.reset();
    },
  };
}

type FunnelAnalyticsClient = ReturnType<typeof createFunnelAnalyticsClient>;
type QueuedEvent = {
  [Event in FunnelAnalyticsEvent]: {
    event: Event;
    properties: FunnelAnalyticsEventProperties[Event];
    capturedAt: Date;
  };
}[FunnelAnalyticsEvent];

let sharedClient: FunnelAnalyticsClient | undefined;
const queuedEvents: QueuedEvent[] = [];
let pendingIdentification:
  | {
      prospectId: string;
      properties: Record<string, unknown>;
      propertiesSetOnce: Record<string, unknown>;
    }
  | undefined;

type PostHogLoader = () => Promise<PostHogAdapter>;

const loadPostHog: PostHogLoader = async () =>
  (await import("posthog-js")).default;

export async function configureFunnelAnalytics(
  config: AnalyticsConfig,
  loader: PostHogLoader = loadPostHog,
) {
  if (config.environment !== "production" || !config.apiKey) {
    queuedEvents.length = 0;
    return;
  }

  try {
    sharedClient = createFunnelAnalyticsClient(config, {
      posthog: await loader(),
    });
    for (const queued of queuedEvents.splice(0)) {
      sharedClient.capture(
        queued.event,
        queued.properties as never,
        queued.capturedAt,
      );
    }
    if (pendingIdentification) {
      const pending = pendingIdentification;
      pendingIdentification = undefined;
      sharedClient.identify(
        pending.prospectId,
        pending.properties,
        pending.propertiesSetOnce,
      );
    }
  } catch {
    console.warn("PulpSense analytics initialization failed");
  }
}

export const getFunnelAnalyticsIdentity = () =>
  sharedClient?.getIdentity() ?? {};

export const identifyFunnelProspect = (
  prospectId: string,
  properties: Record<string, unknown>,
  propertiesSetOnce: Record<string, unknown>,
) => {
  if (sharedClient) {
    sharedClient.identify(prospectId, properties, propertiesSetOnce);
    return;
  }
  pendingIdentification = { prospectId, properties, propertiesSetOnce };
};

export function trackFunnelEvent<Event extends FunnelAnalyticsEvent>(
  event: Event,
  properties: FunnelAnalyticsEventProperties[Event],
) {
  if (sharedClient) {
    sharedClient.capture(event, properties);
    return;
  }

  if (queuedEvents.length < 50) {
    queuedEvents.push({
      event,
      properties,
      capturedAt: new Date(),
    } as QueuedEvent);
  }
}
