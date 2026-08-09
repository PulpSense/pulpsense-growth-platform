import { bookingCompletedEventSchema } from "@pulpsense/contracts";
import { z } from "zod";

import { enqueueFunnelEvent, readBookingToken } from "./contact-submission";
import type { FunnelEnv } from "./funnel-env";
import { json } from "./http";

const decodeHex = (value: string) => {
  if (!/^[0-9a-f]+$/iu.test(value) || value.length % 2 !== 0) {
    return undefined;
  }

  return Uint8Array.from(value.match(/.{2}/gu) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
};

const verifyCalSignature = async (
  body: string,
  signature: string | null,
  secret: string,
) => {
  if (!signature) return false;
  const signatureBytes = decodeHex(signature);
  if (!signatureBytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(body),
  );
};

const calBookingWebhookSchema = z.object({
  triggerEvent: z.literal("BOOKING_CREATED"),
  createdAt: z.iso.datetime({ offset: true }),
  payload: z.object({
    type: z.literal("growth-mapping-funnel"),
    status: z.literal("ACCEPTED"),
    uid: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    startTime: z.iso.datetime({ offset: true }),
    endTime: z.iso.datetime({ offset: true }),
    attendees: z
      .array(z.object({ email: z.email().trim().toLowerCase() }))
      .min(1),
    metadata: z.record(z.string(), z.unknown()),
  }),
});

export async function handleCalWebhook(request: Request, env: FunnelEnv) {
  if (!env.CAL_WEBHOOK_SECRET || !env.SUBMISSION_SIGNING_SECRET) {
    return json({ error: "cal_webhook_unavailable" }, 503);
  }

  const body = await request.text();
  const signatureValid = await verifyCalSignature(
    body,
    request.headers.get("x-cal-signature-256"),
    env.CAL_WEBHOOK_SECRET,
  );
  if (!signatureValid) {
    return json({ error: "invalid_cal_signature" }, 401);
  }

  let untrusted: unknown;
  try {
    untrusted = JSON.parse(body);
  } catch {
    return json({ error: "invalid_cal_payload" }, 400);
  }
  if (
    !untrusted ||
    typeof untrusted !== "object" ||
    !("triggerEvent" in untrusted) ||
    untrusted.triggerEvent !== "BOOKING_CREATED"
  ) {
    return json({ accepted: false, ignored: true }, 202);
  }

  const parsed = calBookingWebhookSchema.safeParse(untrusted);
  if (!parsed.success) {
    return json({ error: "invalid_cal_payload" }, 400);
  }
  const submissionId = parsed.data.payload.metadata.pulpsenseSubmissionId;
  const bookingToken = parsed.data.payload.metadata.pulpsenseBookingToken;
  if (typeof submissionId !== "string" || typeof bookingToken !== "string") {
    return json({ error: "booking_not_eligible" }, 422);
  }

  const claims = await readBookingToken(
    bookingToken,
    env.SUBMISSION_SIGNING_SECRET,
  );
  const attendeeMatches = parsed.data.payload.attendees.some(
    ({ email }) => email === claims?.contact.email.trim().toLowerCase(),
  );
  if (
    !claims ||
    claims.submissionId !== submissionId ||
    claims.environment !== (env.PULPSENSE_ENVIRONMENT ?? "local") ||
    !attendeeMatches
  ) {
    return json({ error: "booking_not_eligible" }, 422);
  }

  const eventId = `booking_completed:${parsed.data.payload.uid}`;
  const event = bookingCompletedEventSchema.parse({
    schemaVersion: 1,
    eventType: "booking_completed",
    funnelId: claims.funnelId,
    submissionId: claims.submissionId,
    eventId,
    occurredAt: parsed.data.createdAt,
    payload: {
      ...claims.contact,
      booking: {
        uid: parsed.data.payload.uid,
        title: parsed.data.payload.title,
        startTime: parsed.data.payload.startTime,
        endTime: parsed.data.payload.endTime,
      },
    },
    qualificationStatus: claims.qualificationStatus,
    attribution: claims.attribution,
    requestContext: claims.requestContext,
    environment: claims.environment,
  });

  try {
    const runId = await enqueueFunnelEvent(event, env);
    return json({
      accepted: true,
      submissionId: claims.submissionId,
      eventId,
      runId,
    });
  } catch {
    return json({ error: "handoff_failed" }, 502);
  }
}
