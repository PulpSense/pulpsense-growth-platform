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
  reconcileSalesAppointment,
  selectEligibleSalesAppointments,
} from "./calendar-reconciliation.js";
import { refreshGoogleRescheduleLink } from "./calendar-reschedule-link.js";
import { processFunnelEventTask } from "./process-funnel-event.js";
import { sendReliabilityAlert } from "./reliability-alerts.js";
import { createTwentySalesAppointmentAdapter } from "./twenty-sales-appointment-adapter.js";

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
};

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
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
        reschedulingReason: input.reschedulingReason,
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

export const createCalendarReconciliationAdapters = (
  environment: CalendarReconciliationEnvironment,
  fetcher: typeof fetch,
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
      const twentyOrigin = required(
        environment.TWENTY_API_ORIGIN,
        "TWENTY_API_ORIGIN",
      ).replace(/\/+$/u, "");
      const personReference = input.salesAppointment.personId
        ? `<${twentyOrigin}/object/person/${encodeURIComponent(input.salesAppointment.personId)}|Open Person>`
        : "Person: unavailable";
      const appointmentReference = `<${twentyOrigin}/object/salesAppointment/${encodeURIComponent(input.salesAppointment.id)}|Open Sales Appointment>`;
      const text = [
        input.recovered
          ? ":white_check_mark: *Calendar reconciliation recovered*"
          : ":rotating_light: *Calendar reconciliation needs attention*",
        `${appointmentReference} · ${personReference}`,
        `Old Cal time: ${input.oldStart}`,
        `Intended Google time: ${input.intendedStart}`,
        `Classification: \`${input.classification}\``,
        `Retry state: ${input.retryState}`,
        `Repair: ${input.repairAction}`,
      ].join("\n");
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

const rescheduleLinkPayloadSchema = z.object({
  submissionId: z.string().uuid(),
  lifecycleEventId: z.string().min(1).max(500),
  previousBookingUid: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u),
  replacementBookingUid: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u),
});

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
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
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
      return result;
    } catch (error) {
      const classification =
        error instanceof Error ? error.message : "unknown_link_refresh_failure";
      logger.error("Google Calendar reschedule link refresh failed", {
        submissionId: payload.submissionId,
        lifecycleEventId: payload.lifecycleEventId,
        replacementBookingUid: payload.replacementBookingUid,
        classification,
      });
      try {
        await sendReliabilityAlert(
          {
            token: required(process.env.SLACK_BOT_TOKEN, "SLACK_BOT_TOKEN"),
            text: [
              ":rotating_light: *Google Calendar reschedule link needs attention*",
              `Lead Journey: \`${payload.submissionId}\``,
              `Previous Cal UID: \`${payload.previousBookingUid}\``,
              `Current Cal UID: \`${payload.replacementBookingUid}\``,
              `Classification: \`${classification}\``,
              `Trigger run: <https://cloud.trigger.dev/projects/v3/${encodeURIComponent(ctx.project.ref)}/runs/${encodeURIComponent(ctx.run.id)}|${ctx.run.id}>`,
              "The rescheduled meeting time remains canonical. Update the event description link manually if needed.",
            ].join("\n"),
          },
          fetch,
        );
      } catch (alertError) {
        logger.error("Google reschedule link failure alert delivery failed", {
          submissionId: payload.submissionId,
          classification:
            alertError instanceof Error
              ? alertError.message
              : "unknown_slack_failure",
        });
      }
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
  run: async ({ salesAppointmentId }) => {
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
      createCalendarReconciliationAdapters(environment, fetch),
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
