import { idempotencyKeys, logger, retry, schemaTask, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import { createPrecallOptOutToken } from "@pulpsense/contracts";

import { renderPrecallEmail } from "../email/render-precall-email.js";
import {
  buildPrecallSchedule,
  sequenceIdFor,
  type PrecallModuleId,
} from "./precall-schedule.js";
import { sendBrevoTransactionalEmail } from "./brevo-transactional.js";
import { triggerRunUrl } from "./trigger-dashboard.js";
import {
  salesAppointmentAutomationGuardShape,
  verifySalesAppointmentAutomationGuard,
} from "./sales-appointment-automation-guard.js";
import { sendReliabilityAlert } from "./reliability-alerts.js";

export const precallSequencePayloadSchema = z
  .object({
    submissionId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100),
    email: z.string().email().max(320),
    bookingUid: z.string().trim().min(1).max(200),
    ...salesAppointmentAutomationGuardShape,
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
  TWENTY_API_ORIGIN?: string;
  TWENTY_API_KEY?: string;
  GOOGLE_CALENDAR_RECONCILIATION_MODE?: string;
  GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST?: string;
  GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY?: string;
  SLACK_BOT_TOKEN?: string;
};

type PrecallRuntime = {
  fetch: typeof fetch;
  now?: () => Date;
  attempt?: <Result>(operation: () => Promise<Result>) => Promise<Result>;
};

export const precallRunIdempotencyKey = (sequenceId: string) =>
  `precall-run:${sequenceId}`;

export const precallSlotIdempotencyKey = (
  sequenceId: string,
  moduleId: PrecallModuleId,
) => `precall-slot:${sequenceId}:${moduleId}`;

export const precallSendIdempotencyKey = (
  sequenceId: string,
  moduleId: PrecallModuleId,
) => `precall-send:${sequenceId}:${moduleId}`;

export const accumulatedPrecallSentMask = (
  payloadMask: number,
  persistedMask: unknown,
) => payloadMask | Number(persistedMask ?? 0);

export const conversationalSenderName = (displayName: string) =>
  displayName.trim().split(/\s+/)[0] ?? displayName;

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
  const apiKey = required(environment.BREVO_API_KEY, "BREVO_API_KEY");
  const calApiKey = required(environment.CAL_API_KEY, "CAL_API_KEY");
  const attempt = runtime.attempt ?? (async (operation) => operation());
  const state = await attempt(() =>
    readBrevoState(payload.email, apiKey, runtime.fetch),
  );
  if (!state) return { skipped: "contact_not_found" as const };
  if (state.emailBlacklisted === true) return { skipped: "suppressed" as const };
  if (state.attributes?.PULPSENSE_PRECALL_OPTED_OUT_AT) {
    return { skipped: "opted_out" as const };
  }
  if (state.attributes?.PULPSENSE_PRECALL_SEQUENCE_ID !== payload.sequenceId) {
    return { skipped: "superseded" as const };
  }
  if (
    !(await attempt(() =>
      verifySalesAppointmentAutomationGuard(
        payload,
        environment,
        runtime.fetch,
        "pre-call",
      ),
    ))
  ) {
    return { skipped: "sales_appointment_guard_failed" as const };
  }
  const schedule = buildPrecallSchedule({
    now,
    meetingStart,
    sentMask: accumulatedPrecallSentMask(
      payload.sentMask,
      state.attributes?.PULPSENSE_PRECALL_SENT_MASK,
    ),
  }).filter((slot) => payload.isNewBooking || slot.moduleId !== "confirmation");

  for (const slot of schedule) {
    const sendAt = slot.sendAt;
    const currentTime = runtime.now?.() ?? new Date();
    if (sendAt.getTime() - currentTime.getTime() > 1_000) {
      await wait.until({
        date: sendAt,
        idempotencyKey: await idempotencyKeys.create(
          precallSlotIdempotencyKey(payload.sequenceId, slot.moduleId),
          { scope: "global" },
        ),
        idempotencyKeyTTL: "1y",
      });
    }
    const current = await attempt(() =>
      readBrevoState(payload.email, apiKey, runtime.fetch),
    );
    const booking = await attempt(() =>
      calBooking(payload.bookingUid, calApiKey, runtime.fetch),
    );
    const generationIsCurrent = await attempt(() =>
      verifySalesAppointmentAutomationGuard(
        payload,
        environment,
        runtime.fetch,
        "pre-call",
      ),
    );
    if (
      !current ||
      current.emailBlacklisted === true ||
      current.attributes?.PULPSENSE_PRECALL_OPTED_OUT_AT ||
      current.attributes?.PULPSENSE_PRECALL_SEQUENCE_ID !== payload.sequenceId ||
      !generationIsCurrent ||
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
      sender_name: conversationalSenderName(
        required(environment.BREVO_PRECALL_SENDER_NAME, "BREVO_PRECALL_SENDER_NAME"),
      ),
    });
    const transportKey = await idempotencyKeys.create(
      precallSendIdempotencyKey(payload.sequenceId, slot.moduleId),
      { scope: "global" },
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
    await updateBrevoState(
      payload.email,
      apiKey,
      {
        PULPSENSE_PRECALL_STATUS: "active",
        PULPSENSE_PRECALL_SEQUENCE_ID: payload.sequenceId,
        PULPSENSE_PRECALL_SENT_MASK:
          Number(current.attributes?.PULPSENSE_PRECALL_SENT_MASK ?? 0) |
          bitMask,
        PULPSENSE_PRECALL_COPY_VERSION: "precall-v1",
      },
      runtime.fetch,
    );
  }
  return { sent: true as const, sequenceId: payload.sequenceId };
};

export const runPrecallSequenceTask = schemaTask({
  id: "run-precall-sequence",
  schema: precallSequencePayloadSchema,
  retry: { maxAttempts: 1 },
  run: async (payload, { ctx }) => {
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
      TWENTY_API_ORIGIN: process.env.TWENTY_API_ORIGIN,
      TWENTY_API_KEY: process.env.TWENTY_API_KEY,
      GOOGLE_CALENDAR_RECONCILIATION_MODE:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_MODE,
      GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST,
      GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY,
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    };
    try {
      return await deliverPrecallSequence(payload, environment, {
        fetch,
        attempt: (operation) =>
          retry.onThrow(operation, {
            maxAttempts: 5,
            factor: 2,
            minTimeoutInMs: 1_000,
            maxTimeoutInMs: 30_000,
            randomize: true,
          }),
      });
    } catch (error) {
      logger.error("Pre-call sequence failed", {
        submissionId: payload.submissionId,
        sequenceId: payload.sequenceId,
        error: error instanceof Error ? error.message : "unknown",
      });
      if (environment.SLACK_BOT_TOKEN) {
        try {
          await sendReliabilityAlert(
            {
              token: environment.SLACK_BOT_TOKEN,
              text: [
                `:rotating_light: *Pre-call sequence failed* — ${payload.environment}`,
                `Sales Appointment: \`${payload.salesAppointmentId ?? "legacy-unmapped"}\` · Booking: \`${payload.bookingUid}\``,
                `<${triggerRunUrl(ctx.environment.slug, ctx.run.id)}|Open in Trigger>`,
              ].join("\n"),
            },
            fetch,
          );
        } catch {
          logger.info("Pre-call failure alert delivery failed", {
            submissionId: payload.submissionId,
            bookingUid: payload.bookingUid,
          });
        }
      }
      throw error;
    }
  },
});

export const sequenceIdFromPayload = (bookingUid: string, expectedStartTime: string) =>
  sequenceIdFor(bookingUid, expectedStartTime);

export type { PrecallEnvironment };
