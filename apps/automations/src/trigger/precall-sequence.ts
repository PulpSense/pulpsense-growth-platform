import { idempotencyKeys, logger, schemaTask, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import { createPrecallOptOutToken } from "@pulpsense/contracts";

import { renderPrecallEmail } from "../email/render-precall-email.js";
import {
  buildPrecallSchedule,
  sequenceIdFor,
} from "./precall-schedule.js";
import { sendBrevoTransactionalEmail } from "./brevo-transactional.js";

export const precallSequencePayloadSchema = z
  .object({
    submissionId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100),
    email: z.string().email().max(320),
    bookingUid: z.string().trim().min(1).max(200),
    expectedStartTime: z.string().datetime({ offset: true }),
    expectedEndTime: z.string().datetime({ offset: true }),
    attendeeTimeZone: z.string().trim().min(1).max(100),
    funnelId: z.string().trim().min(1).max(100),
    environment: z.enum(["local", "preview", "production"]),
    acquisitionSourceLabel: z.string().trim().max(200),
    sequenceId: z.string().trim().min(1).max(500),
    sentMask: z.number().int().min(0).max(65535).default(0),
    isNewBooking: z.boolean().default(true),
  })
  .strict();

export type PrecallSequencePayload = z.infer<
  typeof precallSequencePayloadSchema
>;

type CalBooking = { uid: string; status: string; start: string };
type BrevoState = {
  emailBlacklisted?: boolean;
  attributes?: Record<string, unknown>;
};

type PrecallEnvironment = {
  PULPSENSE_AUTOMATION_ENVIRONMENT?: string;
  PRECALL_EMAILS_ENABLED?: string;
  PRECALL_PUBLIC_ORIGIN?: string;
  PULPSENSE_BUSINESS_POSTAL_ADDRESS?: string;
  PRECALL_OPT_OUT_TOKEN_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_PRECALL_SENDER_EMAIL?: string;
  BREVO_PRECALL_SENDER_NAME?: string;
  BREVO_PRECALL_REPLY_TO_EMAIL?: string;
  CAL_API_KEY?: string;
};

type PrecallRuntime = {
  fetch: typeof fetch;
  now?: () => Date;
};

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const calBooking = async (
  bookingUid: string,
  apiKey: string,
  fetcher: typeof fetch,
) => {
  const response = await fetcher(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(bookingUid)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2026-02-25",
        Accept: "application/json",
      },
    },
  );
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Cal booking check failed (${response.status})`);
  const result = (await response.json()) as {
    status?: string;
    data?: CalBooking | CalBooking[];
  };
  if (result.status !== "success" || !result.data || Array.isArray(result.data)) {
    throw new Error("Cal booking check returned an invalid response");
  }
  return result.data;
};

const brevoHeaders = (apiKey: string) => ({
  "api-key": apiKey,
  Accept: "application/json",
  "Content-Type": "application/json",
});

const readBrevoState = async (
  email: string,
  apiKey: string,
  fetcher: typeof fetch,
): Promise<BrevoState | undefined> => {
  const response = await fetcher(
    `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?identifierType=email_id`,
    { headers: brevoHeaders(apiKey) },
  );
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Brevo contact check failed (${response.status})`);
  return (await response.json()) as BrevoState;
};

const updateBrevoState = async (
  email: string,
  apiKey: string,
  attributes: Record<string, string | number>,
  fetcher: typeof fetch,
) => {
  const response = await fetcher(
    `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
    {
      method: "PUT",
      headers: brevoHeaders(apiKey),
      body: JSON.stringify({ attributes }),
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(`Brevo pre-call state update failed (${response.status})`);
  }
};

const formatMeeting = (start: string, timeZone: string) => {
  const date = new Date(start);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(date);
  return {
    date: `${value("month")} ${value("day")}, ${value("year")}`,
    time: `${value("hour")}:${value("minute")} ${value("dayPeriod")}`,
    weekday,
  };
};

const optOutUrl = async (environment: PrecallEnvironment, payload: PrecallSequencePayload) => {
  const origin = required(environment.PRECALL_PUBLIC_ORIGIN, "PRECALL_PUBLIC_ORIGIN");
  const secret = required(environment.PRECALL_OPT_OUT_TOKEN_SECRET, "PRECALL_OPT_OUT_TOKEN_SECRET");
  const token = await createPrecallOptOutToken(
    {
      email: payload.email,
      submissionId: payload.submissionId,
      sequenceId: payload.sequenceId,
      expiresAt: new Date(payload.expectedStartTime).getTime(),
    },
    secret,
  );
  return `${origin.replace(/\/$/u, "")}/api/precall-opt-out?token=${encodeURIComponent(token)}`;
};

export const deliverPrecallSequence = async (
  payload: PrecallSequencePayload,
  environment: PrecallEnvironment,
  runtime: PrecallRuntime,
) => {
  if (environment.PRECALL_EMAILS_ENABLED !== "true") return { skipped: "disabled" as const };
  if (payload.environment !== environment.PULPSENSE_AUTOMATION_ENVIRONMENT) {
    throw new Error("Pre-call environment does not match destinations");
  }
  const now = runtime.now?.() ?? new Date();
  const meetingStart = new Date(payload.expectedStartTime);
  if (now >= meetingStart) return { skipped: "appointment_started" as const };
  const schedule = buildPrecallSchedule({
    now,
    meetingStart,
    sentMask: payload.sentMask,
  }).filter((slot) => payload.isNewBooking || slot.moduleId !== "confirmation");
  const apiKey = required(environment.BREVO_API_KEY, "BREVO_API_KEY");
  const calApiKey = required(environment.CAL_API_KEY, "CAL_API_KEY");
  const state = await readBrevoState(payload.email, apiKey, runtime.fetch);
  if (!state) return { skipped: "contact_not_found" as const };
  if (state.emailBlacklisted === true) return { skipped: "suppressed" as const };
  if (state.attributes?.PULPSENSE_PRECALL_OPTED_OUT_AT) {
    return { skipped: "opted_out" as const };
  }
  if (state.attributes?.PULPSENSE_PRECALL_SEQUENCE_ID !== payload.sequenceId) {
    return { skipped: "superseded" as const };
  }

  for (const slot of schedule) {
    const sendAt = slot.sendAt;
    if (sendAt > (runtime.now?.() ?? new Date())) {
      await wait.until({
        date: sendAt,
        idempotencyKey: `precall-slot:${payload.sequenceId}:${slot.moduleId}`,
        idempotencyKeyTTL: "1y",
      });
    }
    const current = await readBrevoState(payload.email, apiKey, runtime.fetch);
    const booking = await calBooking(payload.bookingUid, calApiKey, runtime.fetch);
    if (
      !current ||
      current.emailBlacklisted === true ||
      current.attributes?.PULPSENSE_PRECALL_OPTED_OUT_AT ||
      current.attributes?.PULPSENSE_PRECALL_SEQUENCE_ID !== payload.sequenceId ||
      !booking ||
      booking.status.toLowerCase() !== "accepted" ||
      booking.uid !== payload.bookingUid ||
      new Date(booking.start).getTime() !== meetingStart.getTime() ||
      (runtime.now?.() ?? new Date()) >= meetingStart
    ) {
      return { skipped: "send_guard_failed" as const, moduleId: slot.moduleId };
    }

    const meeting = formatMeeting(payload.expectedStartTime, payload.attendeeTimeZone);
    const rendered = renderPrecallEmail(slot.moduleId, {
      first_name: payload.firstName,
      meeting_local_date: meeting.date,
      meeting_local_time: meeting.time,
      meeting_local_weekday: meeting.weekday,
      attendee_timezone: payload.attendeeTimeZone,
      acquisition_source_label: payload.acquisitionSourceLabel,
      precall_opt_out_url: await optOutUrl(environment, payload),
      business_postal_address: required(
        environment.PULPSENSE_BUSINESS_POSTAL_ADDRESS,
        "PULPSENSE_BUSINESS_POSTAL_ADDRESS",
      ),
      sender_name: required(environment.BREVO_PRECALL_SENDER_NAME, "BREVO_PRECALL_SENDER_NAME"),
    });
    const transportKey = await idempotencyKeys.create(
      `precall-send:${payload.sequenceId}:${slot.moduleId}`,
    );
    await sendBrevoTransactionalEmail(
      {
        recipientEmail: payload.email,
        recipientName: `${payload.firstName} ${payload.lastName}`.trim(),
        senderEmail: required(environment.BREVO_PRECALL_SENDER_EMAIL, "BREVO_PRECALL_SENDER_EMAIL"),
        senderName: required(environment.BREVO_PRECALL_SENDER_NAME, "BREVO_PRECALL_SENDER_NAME"),
        replyToEmail: required(environment.BREVO_PRECALL_REPLY_TO_EMAIL, "BREVO_PRECALL_REPLY_TO_EMAIL"),
        subject: rendered.subject,
        textContent: rendered.textContent,
        htmlContent: rendered.htmlContent,
        moduleId: slot.moduleId,
        idempotencyKey: transportKey,
      },
      environment,
      runtime.fetch,
    );
    const bitMask = slot.moduleId === "confirmation" || slot.moduleId === "final-preparation"
      ? 0
      : 1 << [
          "what-we-will-inspect", "proof-twin-oaks", "measurement-and-attribution",
          "already-have-seo", "guarantee", "google-and-ai-mechanism",
          "no-ad-spend-or-shared-leads", "owner-time", "rebuild-risk",
          "proof-wesley-glen", "market-applicability", "call-quality", "economics",
          "multiple-locations", "market-exclusivity", "why-now",
        ].indexOf(slot.moduleId);
    await updateBrevoState(payload.email, apiKey, {
      PULPSENSE_PRECALL_STATUS: "active",
      PULPSENSE_PRECALL_SEQUENCE_ID: payload.sequenceId,
      PULPSENSE_PRECALL_SENT_MASK: Number(current.attributes?.PULPSENSE_PRECALL_SENT_MASK ?? 0) | bitMask,
      PULPSENSE_PRECALL_COPY_VERSION: "precall-v1",
    }, runtime.fetch);
  }
  return { sent: true as const, sequenceId: payload.sequenceId };
};

export const runPrecallSequenceTask = schemaTask({
  id: "run-precall-sequence",
  schema: precallSequencePayloadSchema,
  retry: { maxAttempts: 3 },
  run: async (payload) => {
    const environment: PrecallEnvironment = {
      PULPSENSE_AUTOMATION_ENVIRONMENT: process.env.PULPSENSE_AUTOMATION_ENVIRONMENT,
      PRECALL_EMAILS_ENABLED: process.env.PRECALL_EMAILS_ENABLED,
      PRECALL_PUBLIC_ORIGIN: process.env.PRECALL_PUBLIC_ORIGIN,
      PULPSENSE_BUSINESS_POSTAL_ADDRESS: process.env.PULPSENSE_BUSINESS_POSTAL_ADDRESS,
      PRECALL_OPT_OUT_TOKEN_SECRET: process.env.PRECALL_OPT_OUT_TOKEN_SECRET,
      BREVO_API_KEY: process.env.BREVO_API_KEY,
      BREVO_PRECALL_SENDER_EMAIL: process.env.BREVO_PRECALL_SENDER_EMAIL,
      BREVO_PRECALL_SENDER_NAME: process.env.BREVO_PRECALL_SENDER_NAME,
      BREVO_PRECALL_REPLY_TO_EMAIL: process.env.BREVO_PRECALL_REPLY_TO_EMAIL,
      CAL_API_KEY: process.env.CAL_API_KEY,
    };
    try {
      return await deliverPrecallSequence(payload, environment, { fetch });
    } catch (error) {
      logger.error("Pre-call sequence failed", {
        submissionId: payload.submissionId,
        sequenceId: payload.sequenceId,
        error: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  },
});

export const sequenceIdFromPayload = (bookingUid: string, expectedStartTime: string) =>
  sequenceIdFor(bookingUid, expectedStartTime);

export type { PrecallEnvironment };
