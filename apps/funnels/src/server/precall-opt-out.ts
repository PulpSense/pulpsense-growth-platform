import { readPrecallOptOutToken } from "@pulpsense/contracts";

import type { FunnelEnv } from "./funnel-env";

export const handlePrecallOptOut = async (request: Request, env: FunnelEnv) => {
  const token = new URL(request.url).searchParams.get("token");
  const secret = env.PRECALL_OPT_OUT_TOKEN_SECRET;
  if (!token || !secret || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
    return new Response("Invalid or unavailable opt-out link", { status: 400 });
  }
  try {
    const claims = await readPrecallOptOutToken(token, secret);
    const environment = env.PULPSENSE_ENVIRONMENT ?? "production";
    const event = {
      eventType: "precall_opted_out" as const,
      eventId: `precall_opted_out:${claims.sequenceId}:${claims.email}`,
      submissionId: claims.submissionId,
      email: claims.email,
      sequenceId: claims.sequenceId,
      occurredAt: new Date().toISOString(),
      environment,
    };
    const response = await fetch(
      `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/process-precall-opt-out/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: event,
          context: { environment },
          options: { idempotencyKey: event.eventId },
        }),
      },
    );
    if (!response.ok) throw new Error("Trigger rejected opt-out");
    return new Response(
      "<h1>Pre-call emails stopped</h1><p>Your appointment remains booked.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch {
    return new Response("Invalid or expired opt-out link", { status: 400 });
  }
};
