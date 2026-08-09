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
});

const eventName = (event: FunnelEvent) =>
  ({
    contact_submitted: "funnel_contact_submitted",
    application_submitted: "funnel_application_submitted",
    booking_completed: "funnel_booking_completed",
  })[event.eventType];

export function createPostHogLifecycleCapture(
  config: PostHogLifecycleConfig,
  runtime: PostHogLifecycleRuntime = {},
) {
  const endpoint = captureUrl(config.host);
  const send = runtime.fetch ?? fetch;

  return async (event: FunnelEvent) => {
    const response = await send(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        event: eventName(event),
        timestamp: event.occurredAt,
        properties: {
          distinct_id: event.requestContext.analyticsId ?? event.submissionId,
          funnel_id: event.funnelId,
          submission_id: event.submissionId,
          event_id: event.eventId,
          $insert_id: event.eventId,
          environment: event.environment,
          ...(event.eventType === "application_submitted"
            ? { qualification_status: event.qualificationStatus }
            : {}),
          ...(event.eventType === "booking_completed"
            ? { qualification_status: "qualified" }
            : {}),
          ...touchProperties("first", event.attribution.firstTouch),
          ...touchProperties("last", event.attribution.lastTouch),
          $process_person_profile: false,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`PostHog lifecycle delivery failed (${response.status})`);
    }
  };
}
