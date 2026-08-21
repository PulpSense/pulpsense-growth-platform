import type {
  BookingCompletedEvent,
  BookingRescheduledEvent,
} from "@pulpsense/contracts";
import { idempotencyKeys, logger, retry, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { triggerRunUrl } from "./trigger-dashboard.js";
import {
  salesAppointmentAutomationGuardShape,
  type SalesAppointmentAutomationGuard,
  verifySalesAppointmentAutomationGuard,
} from "./sales-appointment-automation-guard.js";

export const reminderThresholdSchema = z.enum([
  "24h",
  "2h",
  "90m",
  "15m",
  "5m",
]);
export type ReminderThreshold = z.infer<typeof reminderThresholdSchema>;
export const reminderChannelSchema = z.enum(["gmail", "sms"]);
export type ReminderChannel = z.infer<typeof reminderChannelSchema>;
export type ReminderScheduleTarget =
  | { channel: "gmail" }
  | { channel: "sms"; personId: string };

export const meetingReminderPayloadSchema = z
  .object({
    submissionId: z.string().uuid(),
    personId: z.string().uuid().optional(),
    firstName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(7).max(40).optional(),
    channel: reminderChannelSchema.default("gmail"),
    bookingUid: z.string().trim().min(1).max(200),
    ...salesAppointmentAutomationGuardShape,
    expectedStartTime: z.string().datetime({ offset: true }),
    threshold: reminderThresholdSchema,
    expiresAt: z.string().datetime({ offset: true }),
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict()
  .superRefine((payload, context) => {
    const valid =
      (payload.channel === "gmail" &&
        ["24h", "2h", "15m"].includes(payload.threshold)) ||
      (payload.channel === "sms" && ["90m", "5m"].includes(payload.threshold));
    if (!valid) {
      context.addIssue({
        code: "custom",
        path: ["threshold"],
        message: `${payload.threshold} is not valid for ${payload.channel}`,
      });
    }
  });

export type MeetingReminderPayload = z.infer<
  typeof meetingReminderPayloadSchema
>;

const thresholdDefinitions = [
  {
    threshold: "24h" as const,
    channel: "gmail" as const,
    beforeMs: 24 * 60 * 60_000,
    expiresBeforeMs: 2 * 60 * 60_000,
  },
  {
    threshold: "2h" as const,
    channel: "gmail" as const,
    beforeMs: 2 * 60 * 60_000,
    expiresBeforeMs: 15 * 60_000,
  },
  {
    threshold: "90m" as const,
    channel: "sms" as const,
    beforeMs: 90 * 60_000,
    expiresBeforeMs: 15 * 60_000,
  },
  {
    threshold: "15m" as const,
    channel: "gmail" as const,
    beforeMs: 15 * 60_000,
    expiresBeforeMs: 0,
  },
  {
    threshold: "5m" as const,
    channel: "sms" as const,
    beforeMs: 5 * 60_000,
    expiresBeforeMs: 0,
  },
];

type SchedulableBookingEvent = BookingCompletedEvent | BookingRescheduledEvent;
type ScheduledReminder = `${ReminderChannel}:${ReminderThreshold}`;

type ReminderTrigger = (
  payload: MeetingReminderPayload,
  options: { delay: Date; idempotencyKey: string; idempotencyKeyTTL: string },
) => Promise<unknown>;

export const scheduleMeetingReminders = async (
  event: SchedulableBookingEvent,
  target: ReminderScheduleTarget,
  trigger: ReminderTrigger,
  now = new Date(),
  createIdempotencyKey: (key: string) => Promise<string> = (key) =>
    idempotencyKeys.create(key),
  guard?: SalesAppointmentAutomationGuard,
) => {
  const startMs = new Date(event.payload.booking.startTime).getTime();
  const scheduled: ScheduledReminder[] = [];
  for (const definition of thresholdDefinitions) {
    if (definition.channel !== target.channel) continue;
    const sendAt = new Date(startMs - definition.beforeMs);
    if (sendAt.getTime() <= now.getTime()) continue;
    const payload: MeetingReminderPayload = {
      submissionId: event.submissionId,
      ...(target.channel === "sms" ? { personId: target.personId } : {}),
      firstName: event.payload.firstName,
      channel: definition.channel,
      bookingUid: event.payload.booking.uid,
      ...(guard ?? {}),
      expectedStartTime: event.payload.booking.startTime,
      threshold: definition.threshold,
      expiresAt: new Date(startMs - definition.expiresBeforeMs).toISOString(),
      environment: event.environment,
    };
    const idempotencyKey = await createIdempotencyKey(
      [
        "meeting-reminder",
        event.payload.booking.uid,
        event.payload.booking.startTime,
        definition.threshold,
      ].join(":"),
    );
    await trigger(payload, {
      delay: sendAt,
      idempotencyKey,
      idempotencyKeyTTL: "1y",
    });
    scheduled.push(`${definition.channel}:${definition.threshold}`);
  }
  return { scheduled };
};

type CalBooking = {
  uid: string;
  title: string;
  status: string;
  start: string;
  end: string;
  meetingUrl?: string;
  attendees?: Array<{ email?: string; timeZone?: string }>;
};

type ReminderEnvironment = {
  PULPSENSE_AUTOMATION_ENVIRONMENT?: string;
  CAL_API_KEY?: string;
  GMAIL_REMINDERS_ENABLED?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  GMAIL_SENDER_EMAIL?: string;
  GMAIL_REMINDER_24H_SUBJECT?: string;
  GMAIL_REMINDER_24H_BODY?: string;
  GMAIL_REMINDER_2H_SUBJECT?: string;
  GMAIL_REMINDER_2H_BODY?: string;
  GMAIL_REMINDER_15M_SUBJECT?: string;
  GMAIL_REMINDER_15M_BODY?: string;
  TELNYX_SMS_REMINDERS_ENABLED?: string;
  TWENTY_API_KEY?: string;
  TWENTY_API_ORIGIN?: string;
  TELNYX_SMS_REMINDER_90M_BODY?: string;
  TELNYX_SMS_REMINDER_5M_BODY?: string;
  SLACK_FAILURE_WEBHOOK_URL?: string;
};

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const fetchCurrentBooking = async (
  bookingUid: string,
  calApiKey: string,
  fetcher: typeof fetch,
) => {
  const response = await fetcher(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(bookingUid)}`,
    {
      headers: {
        Authorization: `Bearer ${calApiKey}`,
        "cal-api-version": "2026-02-25",
        Accept: "application/json",
      },
    },
  );
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Cal booking verification failed (${response.status})`);
  }
  const result = (await response.json()) as {
    status?: string;
    data?: CalBooking | CalBooking[];
  };
  if (
    result.status !== "success" ||
    Array.isArray(result.data) ||
    !result.data
  ) {
    throw new Error("Cal booking verification returned an invalid response");
  }
  return result.data;
};

const templateNames = {
  "24h": {
    subject: "GMAIL_REMINDER_24H_SUBJECT",
    body: "GMAIL_REMINDER_24H_BODY",
  },
  "2h": {
    subject: "GMAIL_REMINDER_2H_SUBJECT",
    body: "GMAIL_REMINDER_2H_BODY",
  },
  "15m": {
    subject: "GMAIL_REMINDER_15M_SUBJECT",
    body: "GMAIL_REMINDER_15M_BODY",
  },
} as const;

const smsTemplateNames = {
  "90m": "TELNYX_SMS_REMINDER_90M_BODY",
  "5m": "TELNYX_SMS_REMINDER_5M_BODY",
} as const;

const renderTemplate = (template: string, variables: Record<string, string>) =>
  Object.entries(variables).reduce(
    (rendered, [name, value]) => rendered.replaceAll(`{{${name}}}`, value),
    template.replaceAll("\\n", "\n"),
  );

const encodeBase64 = (value: string) =>
  Buffer.from(value, "utf8").toString("base64");

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

const formatAppointmentForAttendee = (start: string, timeZone: string) => {
  const startDate = new Date(start);
  const displayParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(startDate);
  const hour = displayParts.find((part) => part.type === "hour")?.value;
  const minute = displayParts.find((part) => part.type === "minute")?.value;
  const dayPeriod = displayParts
    .find((part) => part.type === "dayPeriod")
    ?.value.toLowerCase();
  if (!hour || !minute || !dayPeriod) {
    throw new Error("Could not format the appointment in attendee timezone");
  }
  const localHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(startDate),
  );
  const daypart =
    localHour < 12 ? "morning" : localHour < 17 ? "afternoon" : "evening";
  return { localTime: `${hour}:${minute}${dayPeriod}`, daypart };
};

const buildReminderTemplateVariables = (
  payload: MeetingReminderPayload,
  booking: CalBooking,
  attendeeTimeZone: string,
) => {
  const { localTime, daypart } = formatAppointmentForAttendee(
    booking.start,
    attendeeTimeZone,
  );
  return {
    first_name: payload.firstName,
    local_time: localTime,
    daypart,
    meeting_title: booking.title,
    start_time: booking.start,
    attendee_timezone: attendeeTimeZone,
    meeting_url: required(booking.meetingUrl, "Cal meeting URL"),
  };
};

const gmailAccessToken = async (
  environment: ReminderEnvironment,
  fetcher: typeof fetch,
) => {
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required(environment.GMAIL_CLIENT_ID, "GMAIL_CLIENT_ID"),
      client_secret: required(
        environment.GMAIL_CLIENT_SECRET,
        "GMAIL_CLIENT_SECRET",
      ),
      refresh_token: required(
        environment.GMAIL_REFRESH_TOKEN,
        "GMAIL_REFRESH_TOKEN",
      ),
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Gmail token refresh failed (${response.status})`);
  }
  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token)
    throw new Error("Gmail token refresh omitted token");
  return result.access_token;
};

const sendGmailReminder = async (
  payload: MeetingReminderPayload,
  booking: CalBooking,
  attendee: { email: string; timeZone: string },
  environment: ReminderEnvironment,
  fetcher: typeof fetch,
) => {
  const sender = required(environment.GMAIL_SENDER_EMAIL, "GMAIL_SENDER_EMAIL");
  if (!(payload.threshold in templateNames)) {
    throw new Error("Gmail reminder threshold is invalid");
  }
  const names = templateNames[payload.threshold as keyof typeof templateNames];
  const subjectTemplate = required(environment[names.subject], names.subject);
  const bodyTemplate = required(environment[names.body], names.body);
  const variables = buildReminderTemplateVariables(
    payload,
    booking,
    attendee.timeZone,
  );
  const subject = renderTemplate(subjectTemplate, variables);
  const body = renderTemplate(bodyTemplate, variables);
  const messageId = `<pulpsense-${payload.bookingUid}-${payload.expectedStartTime}-${payload.threshold}@pulpsense.com>`;
  const rawMessage = [
    `From: ${sender}`,
    `To: ${attendee.email}`,
    `Reply-To: ${sender}`,
    `Subject: =?UTF-8?B?${encodeBase64(subject)}?=`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64(body),
  ].join("\r\n");
  const accessToken = await gmailAccessToken(environment, fetcher);
  const response = await fetcher(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeBase64Url(rawMessage) }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gmail reminder send failed (${response.status})`);
  }
};

const sendTwentySmsReminder = async (
  payload: MeetingReminderPayload,
  personId: string,
  booking: CalBooking,
  attendee: { timeZone: string },
  environment: ReminderEnvironment,
  fetcher: typeof fetch,
) => {
  if (!(payload.threshold in smsTemplateNames)) {
    throw new Error("SMS reminder threshold is invalid");
  }
  const templateName =
    smsTemplateNames[payload.threshold as keyof typeof smsTemplateNames];
  const template = required(environment[templateName], templateName);
  const text = renderTemplate(
    template,
    buildReminderTemplateVariables(payload, booking, attendee.timeZone),
  );
  const twentyOrigin = required(
    environment.TWENTY_API_ORIGIN,
    "TWENTY_API_ORIGIN",
  ).replace(/\/+$/u, "");
  const response = await fetcher(`${twentyOrigin}/s/telnyx/sms`, {
    method: "POST",
    headers: {
      Authorization: [
        "Bearer",
        required(environment.TWENTY_API_KEY, "TWENTY_API_KEY"),
      ].join(" "),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientRequestId: [
        "appointment-reminder",
        payload.bookingUid,
        payload.expectedStartTime,
        payload.threshold,
      ].join(":"),
      personId,
      text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Twenty SMS reminder send failed (${response.status})`);
  }
  const result = (await response.json()) as {
    accepted?: boolean;
    error?: string;
  };
  if (result.accepted !== true) {
    throw new Error(
      `Twenty SMS reminder refused: ${result.error?.trim() || "unknown reason"}`,
    );
  }
};

const alertReminderFailure = async (
  payload: MeetingReminderPayload,
  webhookUrl: string,
  runUrl: string,
  fetcher: typeof fetch,
) => {
  const response = await fetcher(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: [
        `:rotating_light: *Meeting reminder failed* — ${payload.environment}`,
        `${payload.threshold} reminder · Journey: \`${payload.submissionId}\` · Booking: \`${payload.bookingUid}\``,
        `<${runUrl}|Open in Trigger>`,
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    throw new Error(`Reminder failure alert failed (${response.status})`);
  }
};

export const deliverMeetingReminder = async (
  payload: MeetingReminderPayload,
  environment: ReminderEnvironment,
  runtime: {
    fetch: typeof fetch;
    now?: () => Date;
    attempt?: <Result>(operation: () => Promise<Result>) => Promise<Result>;
  },
) => {
  const now = runtime.now?.() ?? new Date();
  if (now.getTime() >= new Date(payload.expiresAt).getTime()) {
    return { skipped: "expired" as const };
  }
  const channelEnabled =
    payload.channel === "gmail"
      ? environment.GMAIL_REMINDERS_ENABLED === "true"
      : environment.TELNYX_SMS_REMINDERS_ENABLED === "true";
  if (!channelEnabled) {
    return { skipped: "disabled" as const };
  }
  if (payload.environment !== environment.PULPSENSE_AUTOMATION_ENVIRONMENT) {
    throw new Error("Reminder environment does not match destinations");
  }
  if (payload.channel === "sms" && !payload.personId) {
    throw new Error("Twenty Person ID is required for an SMS reminder");
  }
  const attempt = runtime.attempt ?? (async (operation) => operation());
  if (
    !(await attempt(() =>
      verifySalesAppointmentAutomationGuard(
        payload,
        environment,
        runtime.fetch,
        "reminder",
      ),
    ))
  ) {
    return { skipped: "sales_appointment_guard_failed" as const };
  }
  const smsPersonId = payload.channel === "sms" ? payload.personId : undefined;
  const booking = await attempt(() =>
    fetchCurrentBooking(
      payload.bookingUid,
      required(environment.CAL_API_KEY, "CAL_API_KEY"),
      runtime.fetch,
    ),
  );
  if (!booking) return { skipped: "booking_not_found" as const };
  if (
    booking.status.toLowerCase() !== "accepted" ||
    new Date(booking.start).getTime() !==
      new Date(payload.expectedStartTime).getTime()
  ) {
    return { skipped: "inactive_or_superseded" as const };
  }
  const attendee = booking.attendees?.find(
    (candidate): candidate is { email: string; timeZone: string } =>
      Boolean(candidate.email && candidate.timeZone),
  );
  if (!attendee) throw new Error("Cal booking omitted its attendee");
  if (payload.channel === "gmail") {
    await attempt(() =>
      sendGmailReminder(payload, booking, attendee, environment, runtime.fetch),
    );
  }
  if (payload.channel === "sms") {
    await attempt(() =>
      sendTwentySmsReminder(
        payload,
        smsPersonId!,
        booking,
        attendee,
        environment,
        runtime.fetch,
      ),
    );
  }
  return {
    sent: true as const,
    channel: payload.channel,
  };
};

export const sendMeetingReminderTask = schemaTask({
  id: "send-meeting-reminder",
  schema: meetingReminderPayloadSchema,
  retry: { maxAttempts: 1 },
  run: async (payload, { ctx }) => {
    const environment: ReminderEnvironment = {
      PULPSENSE_AUTOMATION_ENVIRONMENT:
        process.env.PULPSENSE_AUTOMATION_ENVIRONMENT,
      CAL_API_KEY: process.env.CAL_API_KEY,
      GMAIL_REMINDERS_ENABLED: process.env.GMAIL_REMINDERS_ENABLED,
      GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
      GMAIL_SENDER_EMAIL: process.env.GMAIL_SENDER_EMAIL,
      GMAIL_REMINDER_24H_SUBJECT: process.env.GMAIL_REMINDER_24H_SUBJECT,
      GMAIL_REMINDER_24H_BODY: process.env.GMAIL_REMINDER_24H_BODY,
      GMAIL_REMINDER_2H_SUBJECT: process.env.GMAIL_REMINDER_2H_SUBJECT,
      GMAIL_REMINDER_2H_BODY: process.env.GMAIL_REMINDER_2H_BODY,
      GMAIL_REMINDER_15M_SUBJECT: process.env.GMAIL_REMINDER_15M_SUBJECT,
      GMAIL_REMINDER_15M_BODY: process.env.GMAIL_REMINDER_15M_BODY,
      TELNYX_SMS_REMINDERS_ENABLED: process.env.TELNYX_SMS_REMINDERS_ENABLED,
      TWENTY_API_KEY: process.env.TWENTY_API_KEY,
      TWENTY_API_ORIGIN: process.env.TWENTY_API_ORIGIN,
      TELNYX_SMS_REMINDER_90M_BODY: process.env.TELNYX_SMS_REMINDER_90M_BODY,
      TELNYX_SMS_REMINDER_5M_BODY: process.env.TELNYX_SMS_REMINDER_5M_BODY,
      SLACK_FAILURE_WEBHOOK_URL: process.env.SLACK_FAILURE_WEBHOOK_URL,
    };
    const attempt = <Result>(operation: () => Promise<Result>) =>
      retry.onThrow(operation, {
        maxAttempts: 5,
        factor: 2,
        minTimeoutInMs: 1_000,
        maxTimeoutInMs: 30_000,
        randomize: true,
      });
    try {
      return await deliverMeetingReminder(payload, environment, {
        fetch,
        attempt,
      });
    } catch (error) {
      const webhookUrl = environment.SLACK_FAILURE_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await alertReminderFailure(
            payload,
            webhookUrl,
            triggerRunUrl(ctx.environment.slug, ctx.run.id),
            fetch,
          );
        } catch {
          logger.info("Reminder failure alert delivery failed", {
            submissionId: payload.submissionId,
            bookingUid: payload.bookingUid,
            threshold: payload.threshold,
          });
        }
      }
      throw error;
    }
  },
});

export type { ReminderEnvironment };
