function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match?.[2];
}

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
) {
  const eventId = generateEventId(eventName);

  // Fire pixel with event ID for deduplication
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, customData ?? {}, { eventID: eventId });
  }

  // Fire CAPI via API route
  fetch('/api/meta-capi/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      fbc: getCookie('_fbc'),
      fbp: getCookie('_fbp'),
      ...(userData?.email ? { user_email: userData.email } : {}),
      ...(userData?.phone ? { user_phone: userData.phone } : {}),
      ...(customData ? { custom_data: customData } : {}),
    }),
  }).catch(() => {
    // Fire-and-forget — don't block the user experience
  });
}
