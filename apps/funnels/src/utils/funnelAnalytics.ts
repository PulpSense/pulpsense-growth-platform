type FunnelStep = "contact" | "qualification" | "booking";
type CtaPlacement =
  | "hero"
  | "proof"
  | "mechanism"
  | "faq"
  | "final"
  | "mobile_sticky";
type MediaAction = "play" | "pause" | "unmute" | "mute" | "seek";
type BookingAction = "widget_viewed" | "booking_successful";

export type FunnelAnalyticsEventProperties = {
  funnel_viewed: { page: "landing" | "qualified" | "unqualified" };
  funnel_step_viewed: { step: FunnelStep };
  funnel_validation_failed: { step: FunnelStep; fields: string[] };
  funnel_step_completed: { step: Exclude<FunnelStep, "booking"> };
  qualification_outcome: { status: "qualified" | "unqualified" };
  cta_clicked: { placement: CtaPlacement };
  media_interaction: { action: MediaAction; media_id: string };
  booking_interaction: { action: BookingAction };
};

export type FunnelAnalyticsEvent = keyof FunnelAnalyticsEventProperties;

type AnalyticsConfig = {
  apiKey: string;
  host: string;
  analyticsId: string;
  funnelId: string;
};

type FailureDetail = {
  code: "posthog_delivery_failed";
  event: FunnelAnalyticsEvent;
};

type AnalyticsRuntime = {
  fetch?: typeof fetch;
  now?: () => Date;
  reportFailure?: (detail: FailureDetail) => void;
};

const allowedFields = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "brandUrl",
  "paidSocialSpend",
  "winnerStatus",
  "platforms",
  "deliveryTimeline",
]);

const allowedValues = {
  funnel_viewed: { page: new Set(["landing", "qualified", "unqualified"]) },
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
    placement: new Set([
      "hero",
      "proof",
      "mechanism",
      "faq",
      "final",
      "mobile_sticky",
    ]),
  },
  media_interaction: {
    action: new Set(["play", "pause", "unmute", "mute", "seek"]),
  },
  booking_interaction: {
    action: new Set(["widget_viewed", "booking_successful"]),
  },
} satisfies Record<FunnelAnalyticsEvent, Record<string, ReadonlySet<string>>>;

const defaultReportFailure = (detail: FailureDetail) => {
  console.warn("PulpSense analytics delivery failed", detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pulpsense:analytics-failure", { detail }),
    );
  }
};

const postHogCaptureUrl = (host: string) => {
  const url = new URL(host);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PostHog host must use HTTP(S)");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/i/v0/e/`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const sanitizedProperties = <Event extends FunnelAnalyticsEvent>(
  event: Event,
  properties: FunnelAnalyticsEventProperties[Event],
) => {
  const safe: Record<string, string | string[]> = {};
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
    const mediaId = (properties as Record<string, unknown>).media_id;
    if (typeof mediaId === "string" && /^[a-z0-9-]{1,100}$/u.test(mediaId)) {
      safe.media_id = mediaId;
    }
  }

  return safe;
};

export function createFunnelAnalyticsClient(
  config: AnalyticsConfig,
  runtime: AnalyticsRuntime = {},
) {
  const captureUrl = postHogCaptureUrl(config.host);
  const send = runtime.fetch ?? fetch;
  const now = runtime.now ?? (() => new Date());
  const reportFailure = runtime.reportFailure ?? defaultReportFailure;

  return {
    async capture<Event extends FunnelAnalyticsEvent>(
      event: Event,
      properties: FunnelAnalyticsEventProperties[Event],
    ) {
      try {
        const response = await send(captureUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: config.apiKey,
            event,
            timestamp: now().toISOString(),
            properties: {
              distinct_id: config.analyticsId,
              funnel_id: config.funnelId,
              ...sanitizedProperties(event, properties),
              $process_person_profile: false,
              $geoip_disable: true,
            },
          }),
          keepalive: true,
        });
        if (!response.ok)
          throw new Error(`PostHog rejected ${response.status}`);
        return true;
      } catch {
        reportFailure({ code: "posthog_delivery_failed", event });
        return false;
      }
    },
  };
}

type FunnelAnalyticsClient = ReturnType<typeof createFunnelAnalyticsClient>;
type QueuedEvent = {
  [Event in FunnelAnalyticsEvent]: {
    event: Event;
    properties: FunnelAnalyticsEventProperties[Event];
  };
}[FunnelAnalyticsEvent];

let sharedClient: FunnelAnalyticsClient | undefined;
const queuedEvents: QueuedEvent[] = [];

export function configureFunnelAnalytics(config: AnalyticsConfig) {
  sharedClient = createFunnelAnalyticsClient(config);
  for (const queued of queuedEvents.splice(0)) {
    void sharedClient.capture(queued.event, queued.properties as never);
  }
}

export function trackFunnelEvent<Event extends FunnelAnalyticsEvent>(
  event: Event,
  properties: FunnelAnalyticsEventProperties[Event],
) {
  if (sharedClient) {
    void sharedClient.capture(event, properties);
    return;
  }

  if (queuedEvents.length < 50) {
    queuedEvents.push({ event, properties } as QueuedEvent);
  }
}
