import type { FunnelEnv } from "./funnel-env";
import { getClientIp, json, parseJson } from "./http";

type CapiRequestBody = {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_email?: string;
  user_phone?: string;
  fbc?: string;
  fbp?: string;
  custom_data?: Record<string, unknown>;
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export async function handleMetaCapi(request: Request, env: FunnelEnv) {
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) {
    return json({ error: "Meta CAPI not configured" }, 500);
  }

  const body = await parseJson<CapiRequestBody>(request);
  if (!body?.event_name || !body.event_id || !body.event_source_url) {
    return json({ error: "Invalid Meta CAPI event" }, 400);
  }
  if (body.event_name === "Schedule") {
    return json({ error: "authoritative_booking_required" }, 403);
  }

  const userData: Record<string, unknown> = {
    client_ip_address: getClientIp(request),
    client_user_agent: request.headers.get("user-agent") ?? "",
  };

  if (body.user_email) userData.em = [await sha256(body.user_email)];
  if (body.user_phone) userData.ph = [await sha256(body.user_phone)];
  if (body.fbc) userData.fbc = body.fbc;
  if (body.fbp) userData.fbp = body.fbp;

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: body.event_source_url,
        event_id: body.event_id,
        user_data: userData,
        ...(body.custom_data ? { custom_data: body.custom_data } : {}),
      },
    ],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${env.META_PIXEL_ID}/events?access_token=${env.META_CAPI_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as {
      events_received?: number;
      error?: unknown;
    };

    if (!response.ok) {
      return json(
        { error: result.error ?? "Meta CAPI delivery failed" },
        response.status,
      );
    }

    return json({ success: true, events_received: result.events_received });
  } catch {
    return json({ error: "Meta CAPI delivery failed" }, 502);
  }
}
