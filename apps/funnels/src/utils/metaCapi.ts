import { getBrowserCookie } from "./browserCookie";

function generateEventId(eventName: string): string {
  return `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMetaEvent(
  eventName: string,
  customData?: Record<string, unknown>,
  userData?: {
    email?: string;
    phone?: string;
  },
  options?: {
    eventId?: string;
    serverHandled?: boolean;
  },
) {
  const eventId = options?.eventId ?? generateEventId(eventName);

  // Fire pixel with event ID for deduplication
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, customData ?? {}, { eventID: eventId });
  }

  if (options?.serverHandled) return eventId;

  // Transitional CAPI path for lifecycle events not yet handled by Trigger.dev.
  fetch("/api/meta-capi/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      fbc: getBrowserCookie("_fbc"),
      fbp: getBrowserCookie("_fbp"),
      ...(userData?.email ? { user_email: userData.email } : {}),
      ...(userData?.phone ? { user_phone: userData.phone } : {}),
      ...(customData ? { custom_data: customData } : {}),
    }),
  }).catch(() => {
    // Fire-and-forget — don't block the user experience
  });

  return eventId;
}

export function trackMetaSchedule({
  bookingUid,
  funnelId,
}: {
  bookingUid: string;
  funnelId: string;
}) {
  return trackMetaEvent("Schedule", { funnel_id: funnelId }, undefined, {
    eventId: `booking_completed:${bookingUid}`,
    serverHandled: true,
  });
}
