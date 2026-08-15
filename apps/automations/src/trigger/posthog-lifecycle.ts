import type { FunnelEvent } from "@pulpsense/contracts";

type PostHogLifecycleConfig = {
  apiKey: string;
  host: string;
};

type PostHogLifecycleRuntime = {
  fetch?: typeof fetch;
};

const captureUrl = (host: string) => {
  const url = new URL(host);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PostHog host must use HTTP(S)");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/i/v0/e/`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const referrerHost = (referrer: string | undefined) => {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname;
  } catch {
    return undefined;
  }
};

const touchProperties = (
  prefix: "first" | "last",
  touch: FunnelEvent["attribution"]["firstTouch"],
) => ({
  ...(touch.utmSource ? { [`${prefix}_utm_source`]: touch.utmSource } : {}),
  ...(touch.utmMedium ? { [`${prefix}_utm_medium`]: touch.utmMedium } : {}),
  ...(touch.utmCampaign
    ? { [`${prefix}_utm_campaign`]: touch.utmCampaign }
    : {}),
  ...(touch.utmContent ? { [`${prefix}_utm_content`]: touch.utmContent } : {}),
  ...(touch.utmTerm ? { [`${prefix}_utm_term`]: touch.utmTerm } : {}),
  ...(touch.gclid ? { [`${prefix}_gclid`]: touch.gclid } : {}),
  ...(touch.fbclid ? { [`${prefix}_fbclid`]: touch.fbclid } : {}),
  ...(touch.msclkid ? { [`${prefix}_msclkid`]: touch.msclkid } : {}),
  ...(touch.ttclid ? { [`${prefix}_ttclid`]: touch.ttclid } : {}),
  ...(touch.liFatId ? { [`${prefix}_li_fat_id`]: touch.liFatId } : {}),
  ...(referrerHost(touch.referrer)
    ? { [`${prefix}_referrer_host`]: referrerHost(touch.referrer) }
    : {}),
  ...(touch.landingPage
    ? { [`${prefix}_landing_page`]: touch.landingPage }
    : {}),
});

const companyDomain = (event: FunnelEvent) =>
  event.eventType === "application_submitted"
    ? event.companyDomain
    : event.payload.email.split("@").at(-1)?.toLowerCase();

const personProperties = (event: FunnelEvent) => ({
  email: event.payload.email,
  name: [event.payload.firstName, event.payload.lastName]
    .filter(Boolean)
    .join(" "),
  phone: event.payload.phone,
  ...(companyDomain(event) ? { company_domain: companyDomain(event) } : {}),
  funnel_id: event.funnelId,
  lead_journey_id: event.submissionId,
  ...touchProperties("last", event.attribution.lastTouch),
});

const eventName = (event: FunnelEvent) =>
  ({
    contact_submitted: "funnel_contact_submitted",
    application_submitted: "funnel_application_submitted",
    booking_completed: "funnel_booking_completed",
    booking_rescheduled: "funnel_booking_rescheduled",
    booking_cancelled: "funnel_booking_cancelled",
  })[event.eventType];

export function createPostHogLifecycleCapture(
  config: PostHogLifecycleConfig,
  runtime: PostHogLifecycleRuntime = {},
) {
  const endpoint = captureUrl(config.host);
  const send = runtime.fetch ?? fetch;

  return async (event: FunnelEvent) => {
    if (!event.prospectId) {
      throw new Error("PostHog lifecycle event omitted Prospect identity");
    }
    const response = await send(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        event: eventName(event),
        timestamp: event.occurredAt,
        properties: {
          distinct_id: event.prospectId,
          funnel_id: event.funnelId,
          submission_id: event.submissionId,
          event_id: event.eventId,
          $insert_id: event.eventId,
          environment: event.environment,
          ...(event.eventType === "application_submitted"
            ? { qualification_status: event.qualificationStatus }
            : {}),
          ...(event.eventType === "booking_completed" ||
          event.eventType === "booking_rescheduled" ||
          event.eventType === "booking_cancelled"
            ? { qualification_status: "qualified" }
            : {}),
          ...touchProperties("first", event.attribution.firstTouch),
          ...touchProperties("last", event.attribution.lastTouch),
          ...(event.requestContext.sessionId
            ? { $session_id: event.requestContext.sessionId }
            : {}),
          $set: personProperties(event),
          $set_once: {
            created_at: event.occurredAt,
            ...touchProperties("first", event.attribution.firstTouch),
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`PostHog lifecycle delivery failed (${response.status})`);
    }
  };
}

export function createPostHogPersonLinkCapture(
  config: PostHogLifecycleConfig,
  runtime: PostHogLifecycleRuntime = {},
) {
  const endpoint = captureUrl(config.host);
  const send = runtime.fetch ?? fetch;

  return async (event: FunnelEvent, twentyPersonId: string) => {
    if (!event.prospectId) {
      throw new Error("PostHog person link omitted Prospect identity");
    }
    const insertId = `twenty_person_linked:${event.prospectId}:${twentyPersonId}`;
    const response = await send(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        event: "funnel_crm_person_linked",
        timestamp: event.occurredAt,
        properties: {
          distinct_id: event.prospectId,
          funnel_id: event.funnelId,
          lead_journey_id: event.submissionId,
          $insert_id: insertId,
          $set: { twenty_person_id: twentyPersonId },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`PostHog person link delivery failed (${response.status})`);
    }
  };
}
