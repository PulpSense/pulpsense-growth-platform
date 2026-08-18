import {
  leadMagnetIdSchema,
  leadMagnetOptInEventSchema,
} from "@pulpsense/contracts";
import { resolveLeadMagnet } from "@pulpsense/lead-magnets";
import { z } from "zod";

import { verifyLeadMagnetEmail } from "./email-verification";
import type { FunnelEnv } from "./funnel-env";
import { getClientIp, json, parseJson, rejectCrossOrigin } from "./http";
import { consumeRateLimit } from "./rate-limit";
import { verifyTurnstileForEnvironment } from "./turnstile-verification";

const requestSchema = z
  .object({
    magnetId: leadMagnetIdSchema,
    firstName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(320),
    turnstileToken: z.string().min(1).max(4096),
  })
  .strict();

const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export async function handleLeadMagnetOptIn(request: Request, env: FunnelEnv) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const parsed = requestSchema.safeParse(await parseJson<unknown>(request));
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  const clientIp = getClientIp(request);
  const rateLimit = await consumeRateLimit(
    env.FUNNEL_RATE_LIMIT_SERVICE,
    `lead-magnet:${clientIp}`,
  );
  if (rateLimit === "unavailable") {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }
  if (rateLimit === "limited") return json({ error: "rate_limited" }, 429);
  const turnstile = await verifyTurnstileForEnvironment({
    request,
    env,
    token: parsed.data.turnstileToken,
    clientIp,
    expectedAction: "lead_magnet_submit",
  });
  if (turnstile === "unavailable") {
    return json({ error: "turnstile_unavailable" }, 503);
  }
  if (turnstile === "rejected") {
    return json({ error: "turnstile_rejected" }, 403);
  }

  const verification = await verifyLeadMagnetEmail(
    parsed.data.email,
    env.MILLION_VERIFIER_API_KEY,
  );
  if (verification === "invalid") {
    return json({ error: "email_invalid" }, 422);
  }
  if (!env.PULPSENSE_TRIGGER_SECRET_KEY) {
    return json({ error: "handoff_unavailable" }, 503);
  }

  const magnet = resolveLeadMagnet(parsed.data.magnetId);
  if (!magnet) return json({ error: "magnet_not_found" }, 404);

  const event = leadMagnetOptInEventSchema.parse({
    schemaVersion: 1,
    eventType: "lead_magnet_opted_in",
    magnetId: parsed.data.magnetId,
    deliveryId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    firstName: parsed.data.firstName,
    email: parsed.data.email,
    environment: env.PULPSENSE_ENVIRONMENT ?? "local",
  });
  const idempotencyKey = await digest(`${event.magnetId}:${event.email}`);

  try {
    const response = await fetch(
      `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/process-lead-magnet-opt-in/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: event,
          context: { environment: event.environment },
          options: { idempotencyKey, idempotencyKeyTTL: "10m" },
        }),
      },
    );
    if (!response.ok) throw new Error("Trigger rejected opt-in");
    const result = (await response.json()) as { id?: string };
    if (!result.id) throw new Error("Trigger response omitted run ID");
    return json({ accepted: true });
  } catch {
    return json({ accepted: false, error: "handoff_failed" }, 502);
  }
}
