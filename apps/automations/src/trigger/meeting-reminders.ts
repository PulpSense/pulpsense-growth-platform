import type {
  BookingCompletedEvent,
  BookingRescheduledEvent,
} from "@pulpsense/contracts";
import { idempotencyKeys, logger, retry, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const reminderThresholdSchema = z.enum(["24h", "2h", "15m"]);
export type ReminderThreshold = z.infer<typeof reminderThresholdSchema>;

export const meetingReminderPayloadSchema = z
  .object({
    submissionId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(100),
    bookingUid: z.string().trim().min(1).max(200),
    expectedStartTime: z.string().datetime({ offset: true }),
    threshold: reminderThresholdSchema,
    expiresAt: z.string().datetime({ offset: true }),
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

export type MeetingReminderPayload = z.infer<
  typeof meetingReminderPayloadSchema
>;

const thresholdDefinitions = [
  {
    threshold: "24h" as const,
    beforeMs: 24 * 60 * 60_000,
    expiresBeforeMs: 2 * 60 * 60_000,
  },
  {
    threshold: "2h" as const,
    beforeMs: 2 * 60 * 60_000,
    expiresBeforeMs: 15 * 60_000,
  },
  { threshold: "15m" as const, beforeMs: 15 * 60_000, expiresBeforeMs: 0 },
];

type SchedulableBookingEvent = BookingCompletedEvent | BookingRescheduledEvent;

type ReminderTrigger = (
  payload: MeetingReminderPayload,
  options: { delay: Date; idempotencyKey: string; idempotencyKeyTTL: string },
) => Promise<unknown>;

export const scheduleMeetingReminders = async (
  event: SchedulableBookingEvent,
  trigger: ReminderTrigger,
  now = new Date(),
  createIdempotencyKey: (key: string) => Promise<string> = (key) =>
    idempotencyKeys.create(key),
) => {
  const startMs = new Date(event.payload.booking.startTime).getTime();
  const scheduled: ReminderThreshold[] = [];
  for (const definition of thresholdDefinitions) {
    const sendAt = new Date(startMs - definition.beforeMs);
    if (sendAt.getTime() <= now.getTime()) continue;
    const payload: MeetingReminderPayload = {
      submissionId: event.submissionId,
      firstName: event.payload.firstName,
      bookingUid: event.payload.booking.uid,
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
    scheduled.push(definition.threshold);
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
  const names = templateNames[payload.threshold];
  const subjectTemplate = required(environment[names.subject], names.subject);
  const bodyTemplate = required(environment[names.body], names.body);
  const meetingUrl = required(booking.meetingUrl, "Cal meeting URL");
  const { localTime, daypart } = formatAppointmentForAttendee(
    booking.start,
    attendee.timeZone,
  );
  const variables = {
    first_name: payload.firstName,
    local_time: localTime,
    daypart,
    meeting_title: booking.title,
    start_time: booking.start,
    attendee_timezone: attendee.timeZone,
    meeting_url: meetingUrl,
  };
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
        ":rotating_light: Meeting reminder exhausted retries",
        `Environment: ${payload.environment}`,
        `Operation: gmail_reminder_${payload.threshold}`,
        `Lead Journey: ${payload.submissionId}`,
        `Cal UID: ${payload.bookingUid}`,
        `Trigger.dev run: ${runUrl}`,
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
  runtime: { fetch: typeof fetch; now?: () => Date },
) => {
  const now = runtime.now?.() ?? new Date();
  if (now.getTime() >= new Date(payload.expiresAt).getTime()) {
    return { skipped: "expired" as const };
  }
  if (environment.GMAIL_REMINDERS_ENABLED !== "true") {
    return { skipped: "disabled" as const };
  }
  if (payload.environment !== environment.PULPSENSE_AUTOMATION_ENVIRONMENT) {
    throw new Error("Reminder environment does not match destinations");
  }
  const booking = await fetchCurrentBooking(
    payload.bookingUid,
    required(environment.CAL_API_KEY, "CAL_API_KEY"),
    runtime.fetch,
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
  await sendGmailReminder(
    payload,
    booking,
    attendee,
    environment,
    runtime.fetch,
  );
  return { sent: true as const };
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
      SLACK_FAILURE_WEBHOOK_URL: process.env.SLACK_FAILURE_WEBHOOK_URL,
    };
    try {
      return await retry.onThrow(
        () => deliverMeetingReminder(payload, environment, { fetch }),
        {
          maxAttempts: 5,
          factor: 2,
          minTimeoutInMs: 1_000,
          maxTimeoutInMs: 30_000,
          randomize: true,
        },
      );
    } catch (error) {
      const webhookUrl = environment.SLACK_FAILURE_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await alertReminderFailure(
            payload,
            webhookUrl,
            `https://cloud.trigger.dev/projects/v3/${encodeURIComponent(ctx.project.ref)}/${encodeURIComponent(ctx.environment.slug)}/runs/${encodeURIComponent(ctx.run.id)}`,
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
