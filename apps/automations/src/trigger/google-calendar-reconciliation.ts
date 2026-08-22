import type { BookingRescheduledEvent } from "@pulpsense/contracts";
import {
  idempotencyKeys,
  logger,
  queue,
  retry,
  schedules,
  schemaTask,
  wait,
} from "@trigger.dev/sdk";
import { z } from "zod";

import {
  type CalBooking,
  type CalBookingReference,
  type CalendarReconciliationAdapters,
  type CalendarReconciliationMode,
  type GoogleCalendarEvent,
  type ReconciliationAlert,
  reconcileSalesAppointment,
  selectEligibleSalesAppointments,
} from "./calendar-reconciliation.js";
import { refreshGoogleRescheduleLink } from "./calendar-reschedule-link.js";
import { processFunnelEventTask } from "./process-funnel-event.js";
import { sendReliabilityAlert } from "./reliability-alerts.js";
import {
  formatSlackNotification,
  slackDate,
  slackIdentifierFooter,
  slackLink,
  slackText,
} from "./slack-notifications.js";
import { createTwentySalesAppointmentAdapter } from "./twenty-sales-appointment-adapter.js";
import { triggerRunUrl } from "./trigger-dashboard.js";

const CAL_API_VERSION = "2026-02-25";
const CAL_REFERENCES_API_VERSION = "2024-08-13";

const googleCalendarReconciliationQueue = queue({
  name: "google-calendar-reconciliation",
  concurrencyLimit: 1,
});

const googleCalendarDescriptionWriteQueue = queue({
  name: "google-calendar-description-writes",
  concurrencyLimit: 1,
});

type CalendarReconciliationEnvironment = {
  TWENTY_API_ORIGIN?: string;
  TWENTY_API_KEY?: string;
  CAL_API_KEY?: string;
  CAL_RECONCILIATION_HOST_EMAIL?: string;
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_REFRESH_TOKEN?: string;
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_CALENDAR_RECONCILIATION_MODE?: string;
  GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST?: string;
  GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY?: string;
  GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL?: string;
  SLACK_BOT_TOKEN?: string;
  PULPSENSE_AUTOMATION_ENVIRONMENT?: string;
};

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

export const parseAutomationEnvironment = (value: string | undefined) => {
  if (value === "local" || value === "preview" || value === "production") {
    return value;
  }
  throw new Error(
    "PULPSENSE_AUTOMATION_ENVIRONMENT must be local, preview, or production",
  );
};

export const parseReconciliationMode = (
  value: string | undefined,
): CalendarReconciliationMode => {
  if (!value || value === "off") return "off";
  if (value === "observe" || value === "reconcile") return value;
  throw new Error(
    "GOOGLE_CALENDAR_RECONCILIATION_MODE must be off, observe, or reconcile",
  );
};

export const parseUidAllowlist = (value: string | undefined) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
  );

export const parseCanaryOnly = (value: string | undefined) => {
  if (!value || value === "true") return true;
  if (value === "false") return false;
  throw new Error(
    "GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY must be true or false",
  );
};

const jsonRequest = async <Result>(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
  label: string,
  allowNotFound = false,
): Promise<Result | undefined> => {
  const response = await fetcher(url, init);
  if (allowNotFound && (response.status === 404 || response.status === 410)) {
    return undefined;
  }
  if (!response.ok) {
    const error = new Error(`${label} failed (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as Result;
};

const googleAccessToken = async (
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
) => {
  const result = await jsonRequest<{ access_token?: string }>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required(
          environment.GOOGLE_CALENDAR_CLIENT_ID,
          "GOOGLE_CALENDAR_CLIENT_ID",
        ),
        client_secret: required(
          environment.GOOGLE_CALENDAR_CLIENT_SECRET,
          "GOOGLE_CALENDAR_CLIENT_SECRET",
        ),
        refresh_token: required(
          environment.GOOGLE_CALENDAR_REFRESH_TOKEN,
          "GOOGLE_CALENDAR_REFRESH_TOKEN",
        ),
        grant_type: "refresh_token",
      }),
    },
    fetcher,
    "Google Calendar token refresh",
  );
  return required(result?.access_token, "Google Calendar access token");
};

const getGoogleEvent = async (
  calendarId: string,
  eventId: string,
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
): Promise<GoogleCalendarEvent | undefined> => {
  const configuredCalendarId = required(
    environment.GOOGLE_CALENDAR_ID,
    "GOOGLE_CALENDAR_ID",
  );
  if (calendarId !== configuredCalendarId) {
    throw new Error(
      "Google mapping does not belong to the designated calendar",
    );
  }
  const result = await jsonRequest<{
    id?: string;
    iCalUID?: string;
    etag?: string;
    sequence?: number;
    status?: string;
    start?: { dateTime?: string };
    description?: string;
  }>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      headers: {
        Authorization: `Bearer ${await googleAccessToken(environment, fetcher)}`,
        Accept: "application/json",
      },
    },
    fetcher,
    "Google Calendar event read",
    true,
  );
  if (!result) return undefined;
  if (
    !result.id ||
    !result.etag ||
    typeof result.sequence !== "number" ||
    !result.start?.dateTime
  ) {
    throw new Error("Google Calendar event omitted its direct event revision");
  }
  return {
    id: result.id,
    ...(result.iCalUID ? { iCalUID: result.iCalUID } : {}),
    etag: result.etag,
    sequence: result.sequence,
    status: result.status === "cancelled" ? "cancelled" : "confirmed",
    start: new Date(result.start.dateTime).toISOString(),
    ...(result.description ? { description: result.description } : {}),
  };
};

export const patchGoogleEventDescription = async (
  input: {
    calendarId: string;
    eventId: string;
    etag: string;
    description: string;
  },
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
) => {
  const configuredCalendarId = required(
    environment.GOOGLE_CALENDAR_ID,
    "GOOGLE_CALENDAR_ID",
  );
  if (input.calendarId !== configuredCalendarId) {
    throw new Error(
      "Google mapping does not belong to the designated calendar",
    );
  }
  await jsonRequest(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=none`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${await googleAccessToken(environment, fetcher)}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": input.etag,
      },
      body: JSON.stringify({ description: input.description }),
    },
    fetcher,
    "Google Calendar event description update",
  );
};

const calHeaders = (
  environment: CalendarReconciliationEnvironment,
  version: string,
) => ({
  Authorization: `Bearer ${required(environment.CAL_API_KEY, "CAL_API_KEY")}`,
  "cal-api-version": version,
  Accept: "application/json",
  "Content-Type": "application/json",
});

const parseCalBooking = (value: unknown): CalBooking => {
  const booking = value as {
    uid?: string;
    title?: string;
    status?: string;
    start?: string;
    end?: string;
    meetingUrl?: string;
    hosts?: Array<{ email?: string }>;
    attendees?: Array<{
      name?: string;
      email?: string;
      phoneNumber?: string;
      timeZone?: string;
    }>;
    rescheduledToUid?: string;
  };
  if (
    !booking.uid ||
    !booking.title ||
    !booking.status ||
    !booking.start ||
    !booking.end
  ) {
    throw new Error("Cal booking response omitted canonical fields");
  }
  return {
    uid: booking.uid,
    title: booking.title,
    status: booking.status,
    start: new Date(booking.start).toISOString(),
    end: new Date(booking.end).toISOString(),
    ...(booking.meetingUrl ? { meetingUrl: booking.meetingUrl } : {}),
    hosts: (booking.hosts ?? []).flatMap((host) =>
      host.email ? [{ email: host.email }] : [],
    ),
    attendees: (booking.attendees ?? []).flatMap((attendee) =>
      attendee.name && attendee.email && attendee.timeZone
        ? [
            {
              name: attendee.name,
              email: attendee.email,
              ...(attendee.phoneNumber
                ? { phoneNumber: attendee.phoneNumber }
                : {}),
              timeZone: attendee.timeZone,
            },
          ]
        : [],
    ),
    ...(booking.rescheduledToUid
      ? { rescheduledToUid: booking.rescheduledToUid }
      : {}),
  };
};

const getCalBooking = async (
  uid: string,
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
) => {
  const result = await jsonRequest<{ status?: string; data?: unknown }>(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}`,
    { headers: calHeaders(environment, CAL_API_VERSION) },
    fetcher,
    "Cal booking read",
    true,
  );
  if (!result) return undefined;
  if (
    result.status !== "success" ||
    !result.data ||
    Array.isArray(result.data)
  ) {
    throw new Error("Cal booking read returned an invalid response");
  }
  return parseCalBooking(result.data);
};

const getCalBookingReferences = async (
  uid: string,
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
) => {
  const result = await jsonRequest<{
    status?: string;
    data?: CalBookingReference[];
  }>(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}/references?type=google_calendar`,
    { headers: calHeaders(environment, CAL_REFERENCES_API_VERSION) },
    fetcher,
    "Cal booking reference read",
  );
  if (result?.status !== "success" || !Array.isArray(result.data)) {
    throw new Error("Cal booking reference read returned an invalid response");
  }
  return result.data;
};

const rescheduleCalBooking = async (
  input: Parameters<CalendarReconciliationAdapters["rescheduleCalBooking"]>[0],
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
) => {
  const result = await jsonRequest<{ status?: string; data?: unknown }>(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(input.bookingUid)}/reschedule`,
    {
      method: "POST",
      headers: calHeaders(environment, CAL_API_VERSION),
      body: JSON.stringify({
        start: input.start,
        rescheduledBy: input.rescheduledBy,
        rescheduleWithSameHost: input.rescheduleWithSameHost,
        allowConflicts: input.allowConflicts,
        allowBookingOutOfBounds: input.allowBookingOutOfBounds,
        skipBookingLimits: input.skipBookingLimits,
      }),
    },
    fetcher,
    "Cal booking reschedule",
  );
  if (
    result?.status !== "success" ||
    !result.data ||
    Array.isArray(result.data)
  ) {
    throw new Error("Cal booking reschedule returned an invalid response");
  }
  return parseCalBooking(result.data);
};

const splitName = (name: string) => {
  const [firstName = "Sales", ...rest] = name.trim().split(/\s+/u);
  return { firstName, lastName: rest.join(" ") };
};

const repairEvent = (
  salesAppointment: NonNullable<
    Parameters<
      CalendarReconciliationAdapters["enqueueLifecycleRepair"]
    >[0]["salesAppointment"]
  >,
  previousBooking: CalBooking,
  replacementBooking: CalBooking,
): BookingRescheduledEvent => {
  const attendee = replacementBooking.attendees[0];
  if (
    !salesAppointment.funnelId ||
    !salesAppointment.environment ||
    !attendee?.phoneNumber
  ) {
    throw new Error(
      "Lifecycle repair lacks canonical attendee or lineage data",
    );
  }
  const { firstName, lastName } = splitName(attendee.name);
  return {
    schemaVersion: 1,
    eventType: "booking_rescheduled",
    funnelId: salesAppointment.funnelId,
    submissionId: salesAppointment.originatingLeadJourneyId,
    ...(salesAppointment.prospectId
      ? { prospectId: salesAppointment.prospectId }
      : {}),
    eventId: `booking_rescheduled:${replacementBooking.uid}`,
    occurredAt: new Date().toISOString(),
    qualificationStatus: "qualified",
    payload: {
      firstName,
      lastName,
      email: attendee.email,
      phone: attendee.phoneNumber,
      emailVerification: { status: "verified", result: "business" },
      booking: {
        uid: replacementBooking.uid,
        previousUid: previousBooking.uid,
        title: replacementBooking.title,
        startTime: replacementBooking.start,
        endTime: replacementBooking.end,
        previousStartTime: previousBooking.start,
        previousEndTime: previousBooking.end,
        attendeeTimeZone: attendee.timeZone,
        ...(replacementBooking.meetingUrl
          ? { meetingUrl: replacementBooking.meetingUrl }
          : {}),
      },
    },
    attribution: { firstTouch: {}, lastTouch: {} },
    requestContext: {
      clientIp: "calendar-reconciler",
      userAgent: "pulpsense-google-calendar-reconciler",
      sourceUrl: "https://calendar.google.com/",
    },
    environment: salesAppointment.environment,
  };
};

export const formatCalendarReconciliationAlert = (
  input: ReconciliationAlert,
  context: {
    subject: string;
    timeZone?: string;
    environment?: string;
    links: ReturnType<typeof slackLink>[];
    runId?: string;
  },
) => {
  const problem =
    (
      {
        mapping_lookup_failed:
          "The Cal booking could not be matched to a Google Calendar event.",
        google_event_missing:
          "The mapped Google Calendar event could not be found.",
        cal_preflight_read_failed:
          "The current Cal booking could not be verified before reconciliation.",
        manual_repair_detected:
          "A manual calendar repair changed the expected appointment state.",
        host_assertion_failed:
          "The booking host does not match the designated reconciliation host.",
        canary_attendee_assertion_failed:
          "The booking attendee is outside the configured reconciliation canary.",
        google_stability_read_failed:
          "Google Calendar could not be read twice to confirm a stable revision.",
        cal_reschedule_retry:
          "Cal did not accept the reschedule attempt, so reconciliation will retry automatically.",
        past_time_candidate:
          "The intended Google Calendar time is already in the past, so the booking was not changed.",
        replacement_google_reference_missing:
          "The replacement Cal booking does not have a Google Calendar reference.",
        replacement_google_event_invalid:
          "The replacement Google Calendar event is missing, cancelled, or at the wrong time.",
        two_active_google_events:
          "Both the previous and replacement Google Calendar events are active.",
        cal_reschedule_omitted_booking:
          "Cal accepted the reconciliation request without returning a replacement booking.",
        preflight_appointment_missing:
          "The Sales Appointment disappeared before reconciliation could continue.",
        preflight_terminal:
          "The Sales Appointment became completed or cancelled before reconciliation could continue.",
        preflight_google_advanced:
          "The Google Calendar event changed again before reconciliation could continue.",
        preflight_cal_missing:
          "The current Cal booking disappeared before reconciliation could continue.",
      } as Record<string, string>
    )[input.classification] ??
    (input.classification.startsWith("preflight_")
      ? "A final safety check found that the appointment changed before reconciliation could continue."
      : "Calendar reconciliation stopped because an unexpected provider error occurred.");
  const sameTime =
    new Date(input.oldStart).getTime() ===
    new Date(input.intendedStart).getTime();
  const retrying = input.classification === "cal_reschedule_retry";
  return formatSlackNotification({
    tone: input.recovered ? "success" : retrying ? "warning" : "failure",
    title: input.recovered
      ? `Calendar reconciliation recovered for ${context.subject}`
      : retrying
        ? `Calendar reconciliation retrying for ${context.subject}`
        : input.classification === "mapping_lookup_failed"
          ? `Calendar mapping missing for ${context.subject}'s appointment`
          : `Calendar reconciliation needs attention for ${context.subject}`,
    environment: context.environment,
    fields: input.recovered
      ? [
          {
            label: "Call",
            value: slackDate(input.intendedStart, {
              timeZone: context.timeZone,
            }),
          },
          {
            label: "Status",
            value: slackText(
              "The appointment is mapped and synchronized again.",
            ),
          },
        ]
      : [
          {
            label: "Call",
            value: slackDate(input.intendedStart, {
              timeZone: context.timeZone,
            }),
          },
          { label: "Problem", value: slackText(problem) },
          {
            label: "Impact",
            value: slackText(
              retrying
                ? "The call time is not synchronized yet while automatic retries continue."
                : "Calendar changes cannot be reconciled safely until this is resolved.",
            ),
          },
          { label: "Retry", value: slackText(input.retryState) },
          { label: "Action", value: slackText(input.repairAction) },
          ...(!sameTime
            ? [
                {
                  label: "Previous Cal time",
                  value: slackDate(input.oldStart, {
                    timeZone: context.timeZone,
                  }),
                },
              ]
            : []),
        ],
    links: context.links,
    note: slackIdentifierFooter([
      ["Journey", input.salesAppointment.originatingLeadJourneyId],
      ["Booking", input.salesAppointment.currentCalBookingUid],
      ["Person", input.salesAppointment.personId],
      ["Run", context.runId],
    ]),
  });
};

export const createCalendarReconciliationAdapters = (
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
  run?: { id: string; url: string },
): CalendarReconciliationAdapters => {
  const twenty = createTwentySalesAppointmentAdapter({
    fetch: fetcher,
    origin: required(
      environment.TWENTY_API_ORIGIN,
      "TWENTY_API_ORIGIN",
    ).replace(/\/+$/u, ""),
    apiKey: required(environment.TWENTY_API_KEY, "TWENTY_API_KEY"),
  });
  return {
    getSalesAppointment: (id) => twenty.getSalesAppointment(id),
    updateSalesAppointment: (id, patch) =>
      twenty.updateSalesAppointment(id, patch),
    async resolveGoogleMapping(bookingUid) {
      const references = await getCalBookingReferences(
        bookingUid,
        environment,
        fetcher,
      );
      const reference = references.find(
        (candidate) => candidate.type === "google_calendar",
      );
      if (!reference?.destinationCalendarId || !reference.eventUid) {
        return undefined;
      }
      if (reference.destinationCalendarId !== environment.GOOGLE_CALENDAR_ID) {
        throw new Error("Cal reference points outside the designated calendar");
      }
      return {
        calendarId: reference.destinationCalendarId,
        eventId: reference.eventUid,
      };
    },
    getGoogleEvent: (calendarId, eventId) =>
      getGoogleEvent(calendarId, eventId, environment, fetcher),
    getCalBooking: (uid) => getCalBooking(uid, environment, fetcher),
    getCalBookingReferences: (uid) =>
      getCalBookingReferences(uid, environment, fetcher),
    rescheduleCalBooking: (input) =>
      rescheduleCalBooking(input, environment, fetcher),
    waitForStability: () => wait.for({ minutes: 5 }).then(() => undefined),
    waitForRetry: (attempt) =>
      wait.for({ seconds: 2 ** attempt }).then(() => undefined),
    waitForCanonicalWebhook: () =>
      wait.for({ minutes: 10 }).then(() => undefined),
    async enqueueLifecycleRepair({
      salesAppointment,
      previousBooking,
      replacementBooking,
    }) {
      const event = repairEvent(
        salesAppointment,
        previousBooking,
        replacementBooking,
      );
      await processFunnelEventTask.trigger(event, {
        idempotencyKey: await idempotencyKeys.create(event.eventId, {
          scope: "global",
        }),
        idempotencyKeyTTL: "1y",
      });
    },
    async sendAlert(input) {
      const token = required(environment.SLACK_BOT_TOKEN, "SLACK_BOT_TOKEN");
      const automationEnvironment = parseAutomationEnvironment(
        environment.PULPSENSE_AUTOMATION_ENVIRONMENT,
      );
      const twentyOrigin = required(
        environment.TWENTY_API_ORIGIN,
        "TWENTY_API_ORIGIN",
      ).replace(/\/+$/u, "");
      const links = [
        slackLink(
          "Open Sales Appointment",
          `${twentyOrigin}/object/salesAppointment/${encodeURIComponent(input.salesAppointment.id)}`,
        ),
        slackLink(
          "Open Person",
          `${twentyOrigin}/object/person/${encodeURIComponent(input.salesAppointment.personId)}`,
        ),
        ...(run ? [slackLink("Open in Trigger", run.url)] : []),
      ];
      const booking = await getCalBooking(
        input.salesAppointment.currentCalBookingUid,
        environment,
        fetcher,
      ).catch(() => undefined);
      const attendee = booking?.attendees[0];
      const personName = await twenty
        .getPersonDisplayName(input.salesAppointment.personId)
        .catch(() => undefined);
      const subject = attendee?.name ?? personName ?? "the affected person";
      const text = formatCalendarReconciliationAlert(input, {
        subject,
        ...(attendee?.timeZone ? { timeZone: attendee.timeZone } : {}),
        environment: automationEnvironment,
        links,
        runId: run?.id,
      });
      return sendReliabilityAlert(
        {
          token,
          text,
          ...(input.threadTs ? { threadTs: input.threadTs } : {}),
        },
        fetcher,
      );
    },
    now: () => new Date(),
  };
};

export const rescheduleLinkPayloadSchema = z.object({
  submissionId: z.string().uuid(),
  lifecycleEventId: z.string().min(1).max(500),
  salesAppointmentId: z.string().min(1).max(200).optional(),
  personId: z.string().min(1).max(200).optional(),
  oldStart: z.string().datetime({ offset: true }).optional(),
  intendedStart: z.string().datetime({ offset: true }).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  previousBookingUid: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u),
  replacementBookingUid: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u),
});

type RescheduleLinkPayload = z.infer<typeof rescheduleLinkPayloadSchema>;

export const formatGoogleRescheduleLinkFailureAlert = (
  payload: RescheduleLinkPayload,
  context: {
    environment: "local" | "preview" | "production";
    twentyOrigin?: string;
    runUrl: string;
    runId: string;
  },
) => {
  const personName =
    [payload.firstName, payload.lastName].filter(Boolean).join(" ") ||
    "the affected person";
  const twentyOrigin = context.twentyOrigin?.replace(/\/+$/u, "");
  const links = [
    ...(twentyOrigin && payload.salesAppointmentId
      ? [
          slackLink(
            "Open Sales Appointment",
            `${twentyOrigin}/object/salesAppointment/${encodeURIComponent(payload.salesAppointmentId)}`,
          ),
        ]
      : []),
    ...(twentyOrigin && payload.personId
      ? [
          slackLink(
            "Open Person",
            `${twentyOrigin}/object/person/${encodeURIComponent(payload.personId)}`,
          ),
        ]
      : []),
    slackLink("Open in Trigger", context.runUrl),
  ];

  return formatSlackNotification({
    tone: "failure",
    title: `Couldn't refresh ${personName}'s calendar reschedule link`,
    environment: context.environment,
    fields: [
      ...(payload.intendedStart
        ? [{ label: "Call", value: slackDate(payload.intendedStart) }]
        : []),
      ...(payload.oldStart &&
      payload.intendedStart &&
      new Date(payload.oldStart).getTime() !==
        new Date(payload.intendedStart).getTime()
        ? [{ label: "Previous time", value: slackDate(payload.oldStart) }]
        : []),
      {
        label: "Failed step",
        value: slackText(
          "Update the Google Calendar event description with the current Cal reschedule link",
        ),
      },
      {
        label: "Impact",
        value: slackText(
          "The meeting time remains correct, but the Google Calendar event may still open the previous reschedule page.",
        ),
      },
      {
        label: "Retry",
        value: slackText("Exhausted — manual investigation required"),
      },
      {
        label: "Action",
        value: slackText(
          "Open the run, verify the current Cal booking, and update the calendar description link manually.",
        ),
      },
    ],
    links,
    note: slackIdentifierFooter([
      ["Journey", payload.submissionId],
      ["Previous booking", payload.previousBookingUid],
      ["Booking", payload.replacementBookingUid],
      ["Sales Appointment", payload.salesAppointmentId],
      ["Person", payload.personId],
      ["Run", context.runId],
    ]),
  });
};

export const refreshGoogleCalendarRescheduleLinkTask = schemaTask({
  id: "refresh-google-calendar-reschedule-link",
  queue: googleCalendarDescriptionWriteQueue,
  schema: rescheduleLinkPayloadSchema,
  retry: { maxAttempts: 1 },
  run: async (payload, { ctx }) => {
    const environment: CalendarReconciliationEnvironment = {
      CAL_API_KEY: process.env.CAL_API_KEY,
      GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      GOOGLE_CALENDAR_REFRESH_TOKEN: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
      GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
      TWENTY_API_ORIGIN: process.env.TWENTY_API_ORIGIN,
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
      PULPSENSE_AUTOMATION_ENVIRONMENT:
        process.env.PULPSENSE_AUTOMATION_ENVIRONMENT,
    };
    try {
      const result = await retry.onThrow(
        () =>
          refreshGoogleRescheduleLink(payload, {
            getCalBookingReferences: (bookingUid) =>
              getCalBookingReferences(bookingUid, environment, fetch),
            getGoogleEvent: (calendarId, eventId) =>
              getGoogleEvent(calendarId, eventId, environment, fetch),
            patchGoogleEventDescription: (input) =>
              patchGoogleEventDescription(input, environment, fetch),
          }),
        {
          maxAttempts: 3,
          factor: 2,
          minTimeoutInMs: 1_000,
          maxTimeoutInMs: 10_000,
          randomize: true,
        },
      );
      logger.info("Google Calendar reschedule link refreshed", {
        submissionId: payload.submissionId,
        lifecycleEventId: payload.lifecycleEventId,
        replacementBookingUid: payload.replacementBookingUid,
        outcome: result.outcome,
      });
      return { outcome: result.outcome };
    } catch (error) {
      const classification =
        error instanceof Error ? error.message : "unknown_link_refresh_failure";
      logger.error("Google Calendar reschedule link refresh failed", {
        submissionId: payload.submissionId,
        lifecycleEventId: payload.lifecycleEventId,
        replacementBookingUid: payload.replacementBookingUid,
        classification,
      });
      await retry.onThrow(
        () =>
          sendReliabilityAlert(
            {
              token: required(process.env.SLACK_BOT_TOKEN, "SLACK_BOT_TOKEN"),
              text: formatGoogleRescheduleLinkFailureAlert(payload, {
                environment: parseAutomationEnvironment(
                  environment.PULPSENSE_AUTOMATION_ENVIRONMENT,
                ),
                twentyOrigin: environment.TWENTY_API_ORIGIN,
                runUrl: triggerRunUrl(ctx.environment.slug, ctx.run.id),
                runId: ctx.run.id,
              }),
            },
            fetch,
          ),
        {
          maxAttempts: 3,
          factor: 2,
          minTimeoutInMs: 1_000,
          maxTimeoutInMs: 10_000,
          randomize: true,
        },
      );
      return { outcome: "needs_attention" as const, classification };
    }
  },
});

const reconciliationPayloadSchema = z.object({
  salesAppointmentId: z.string().uuid(),
});

export const reconcileGoogleCalendarSalesAppointmentTask = schemaTask({
  id: "reconcile-google-calendar-sales-appointment",
  queue: googleCalendarReconciliationQueue,
  schema: reconciliationPayloadSchema,
  retry: { maxAttempts: 1 },
  run: async ({ salesAppointmentId }, { ctx }) => {
    const environment: CalendarReconciliationEnvironment = {
      TWENTY_API_ORIGIN: process.env.TWENTY_API_ORIGIN,
      TWENTY_API_KEY: process.env.TWENTY_API_KEY,
      CAL_API_KEY: process.env.CAL_API_KEY,
      CAL_RECONCILIATION_HOST_EMAIL: process.env.CAL_RECONCILIATION_HOST_EMAIL,
      GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      GOOGLE_CALENDAR_REFRESH_TOKEN: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
      GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
      GOOGLE_CALENDAR_RECONCILIATION_MODE:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_MODE,
      GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST,
      GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY,
      GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL:
        process.env.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL,
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
      PULPSENSE_AUTOMATION_ENVIRONMENT:
        process.env.PULPSENSE_AUTOMATION_ENVIRONMENT,
    };
    const mode = parseReconciliationMode(
      environment.GOOGLE_CALENDAR_RECONCILIATION_MODE,
    );
    if (mode === "off") return { outcome: "off" as const };
    const result = await reconcileSalesAppointment(
      salesAppointmentId,
      {
        mode,
        allowedBookingUids: parseUidAllowlist(
          environment.GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST,
        ),
        canaryOnly: parseCanaryOnly(
          environment.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY,
        ),
        canaryAttendeeEmail:
          environment.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL,
        hostEmail: required(
          environment.CAL_RECONCILIATION_HOST_EMAIL,
          "CAL_RECONCILIATION_HOST_EMAIL",
        ),
      },
      createCalendarReconciliationAdapters(environment, fetch, {
        id: ctx.run.id,
        url: triggerRunUrl(ctx.environment.slug, ctx.run.id),
      }),
    );
    logger.info("Google Calendar Sales Appointment reconciliation classified", {
      salesAppointmentId,
      outcome: result.outcome,
      revision: result.revision,
      mode,
    });
    return result;
  },
});

export const pollGoogleCalendarSalesAppointmentsTask = schedules.task({
  id: "poll-google-calendar-sales-appointments",
  cron: "*/5 * * * *",
  retry: { maxAttempts: 3 },
  run: async ({ timestamp }) => {
    const pollTimestamp = timestamp ?? new Date();
    const mode = parseReconciliationMode(
      process.env.GOOGLE_CALENDAR_RECONCILIATION_MODE,
    );
    if (mode === "off") return { mode, selected: 0 };
    const twenty = createTwentySalesAppointmentAdapter({
      fetch,
      origin: required(
        process.env.TWENTY_API_ORIGIN,
        "TWENTY_API_ORIGIN",
      ).replace(/\/+$/u, ""),
      apiKey: required(process.env.TWENTY_API_KEY, "TWENTY_API_KEY"),
    });
    const selected = selectEligibleSalesAppointments(
      await twenty.listSalesAppointments(),
      pollTimestamp,
    );
    for (const appointment of selected) {
      const bucket = Math.floor(pollTimestamp.getTime() / (5 * 60_000));
      await reconcileGoogleCalendarSalesAppointmentTask.trigger(
        { salesAppointmentId: appointment.id },
        {
          idempotencyKey: await idempotencyKeys.create(
            `calendar-reconcile:${appointment.id}:${bucket}`,
            { scope: "global" },
          ),
          idempotencyKeyTTL: "1d",
          concurrencyKey: appointment.id,
        },
      );
    }
    return { mode, selected: selected.length };
  },
});

export type { CalendarReconciliationEnvironment };
