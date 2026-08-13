import {
  bookingCancelledEventSchema,
  bookingCompletedEventSchema,
  bookingRescheduledEventSchema,
  type FunnelEvent,
} from "@pulpsense/contracts";
import { z } from "zod";

import { enqueueFunnelEvent } from "./funnel-events/delivery";
import { readBookingToken } from "./funnel-events/submission-identity";
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

const calBookingPayloadSchema = z.object({
  type: z.string().trim().min(1).max(200),
  status: z.enum(["ACCEPTED", "CANCELLED"]),
  uid: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  startTime: z.iso.datetime({ offset: true }),
  endTime: z.iso.datetime({ offset: true }),
  location: z.unknown().optional(),
  attendees: z
    .array(
      z.object({
        email: z.email().trim().toLowerCase(),
        timeZone: z.string().trim().min(1).max(100),
      }),
    )
    .min(1),
  metadata: z.record(z.string(), z.unknown()),
  rescheduleUid: z.string().trim().min(1).max(200).nullish(),
  rescheduleStartTime: z.iso.datetime({ offset: true }).nullish(),
  rescheduleEndTime: z.iso.datetime({ offset: true }).nullish(),
  cancellationReason: z.string().trim().max(2000).nullish(),
  videoCallData: z.object({ url: z.unknown().optional() }).nullish(),
  references: z
    .array(z.object({ meetingUrl: z.unknown().optional() }))
    .nullish(),
});

const calBookingWebhookSchema = z.object({
  triggerEvent: z.enum([
    "BOOKING_CREATED",
    "BOOKING_RESCHEDULED",
    "BOOKING_CANCELLED",
  ]),
  createdAt: z.iso.datetime({ offset: true }),
  payload: calBookingPayloadSchema,
});

const isUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const meetingUrlFromPayload = (
  payload: z.infer<typeof calBookingPayloadSchema>,
) => {
  const metadataUrl = payload.metadata.videoCallUrl;
  if (isUrl(metadataUrl)) return metadataUrl;
  if (isUrl(payload.location)) return payload.location;
  if (isUrl(payload.videoCallData?.url)) return payload.videoCallData.url;
  for (const reference of payload.references ?? []) {
    if (isUrl(reference.meetingUrl)) return reference.meetingUrl;
  }
  return undefined;
};

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
    !["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"].includes(
      String(untrusted.triggerEvent),
    )
  ) {
    return json({ accepted: false, ignored: true }, 202);
  }

  const parsed = calBookingWebhookSchema.safeParse(untrusted);
  if (!parsed.success) {
    return json({ error: "invalid_cal_payload" }, 400);
  }
  if (
    (parsed.data.triggerEvent === "BOOKING_CANCELLED") !==
    (parsed.data.payload.status === "CANCELLED")
  ) {
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
  const matchingAttendee = parsed.data.payload.attendees.find(
    ({ email }) => email === claims?.contact.email.trim().toLowerCase(),
  );
  if (
    !claims ||
    claims.submissionId !== submissionId ||
    claims.environment !== (env.PULPSENSE_ENVIRONMENT ?? "local") ||
    !matchingAttendee
  ) {
    return json({ error: "booking_not_eligible" }, 422);
  }

  const meetingUrl = meetingUrlFromPayload(parsed.data.payload);
  const commonEvent = {
    schemaVersion: 1,
    funnelId: claims.funnelId,
    submissionId: claims.submissionId,
    occurredAt: parsed.data.createdAt,
    payload: {
      ...claims.contact,
      booking: {
        uid: parsed.data.payload.uid,
        title: parsed.data.payload.title,
        startTime: parsed.data.payload.startTime,
        endTime: parsed.data.payload.endTime,
        attendeeTimeZone: matchingAttendee.timeZone,
        ...(meetingUrl ? { meetingUrl } : {}),
      },
    },
    qualificationStatus: claims.qualificationStatus,
    attribution: claims.attribution,
    requestContext: claims.requestContext,
    environment: claims.environment,
  } as const;
  let event: FunnelEvent;
  if (parsed.data.triggerEvent === "BOOKING_RESCHEDULED") {
    if (
      !parsed.data.payload.rescheduleUid ||
      !parsed.data.payload.rescheduleStartTime ||
      !parsed.data.payload.rescheduleEndTime
    ) {
      return json({ error: "invalid_cal_payload" }, 400);
    }
    event = bookingRescheduledEventSchema.parse({
      ...commonEvent,
      eventType: "booking_rescheduled",
      eventId: `booking_rescheduled:${parsed.data.payload.uid}`,
      payload: {
        ...commonEvent.payload,
        booking: {
          ...commonEvent.payload.booking,
          previousUid: parsed.data.payload.rescheduleUid,
          previousStartTime: parsed.data.payload.rescheduleStartTime,
          previousEndTime: parsed.data.payload.rescheduleEndTime,
        },
      },
    });
  } else if (parsed.data.triggerEvent === "BOOKING_CANCELLED") {
    event = bookingCancelledEventSchema.parse({
      ...commonEvent,
      eventType: "booking_cancelled",
      eventId: `booking_cancelled:${parsed.data.payload.uid}`,
      payload: {
        ...commonEvent.payload,
        booking: {
          ...commonEvent.payload.booking,
          ...(parsed.data.payload.cancellationReason
            ? { cancellationReason: parsed.data.payload.cancellationReason }
            : {}),
        },
      },
    });
  } else {
    event = bookingCompletedEventSchema.parse({
      ...commonEvent,
      eventType: "booking_completed",
      eventId: `booking_completed:${parsed.data.payload.uid}`,
    });
  }

  try {
    const runId = await enqueueFunnelEvent(event, env);
    return json({
      accepted: true,
      submissionId: claims.submissionId,
      eventId: event.eventId,
      runId,
    });
  } catch {
    return json({ error: "handoff_failed" }, 502);
  }
}
