import {
  funnelEventSchema,
  isInternalTestLeadEmail,
  type ApplicationSubmittedEvent,
  type BookingCancelledEvent,
  type BookingCompletedEvent,
  type BookingRescheduledEvent,
  type ContactSubmittedEvent,
  type FunnelEvent,
} from "@pulpsense/contracts";
import { logger, retry, schemaTask } from "@trigger.dev/sdk";

import {
  postSlackBooking,
  postSlackLead,
  publishBrevoLifecycle,
  type BrevoLifecycleEvent,
} from "./lifecycle-destinations.js";
import {
  scheduleMeetingReminders,
  sendMeetingReminderTask,
  type ReminderScheduleTarget,
} from "./meeting-reminders.js";
import { runPrecallSequenceTask } from "./precall-sequence.js";
import {
  createPostHogLifecycleCapture,
  createPostHogPersonLinkCapture,
} from "./posthog-lifecycle.js";
import { resolveMetaEnvironment } from "./meta-destination.js";
import {
  projectSalesAppointmentLifecycle,
  salesAppointmentIdFor,
  type SalesAppointmentProjectionOutcome,
} from "./sales-appointment-ledger.js";
import type { SalesAppointmentAutomationGuard } from "./sales-appointment-automation-guard.js";
import { createTwentySalesAppointmentAdapter } from "./twenty-sales-appointment-adapter.js";

type AdapterDestination = "twenty" | "meta" | "slack" | "brevo" | "trigger";

type AdapterOperation =
  | "upsert_person"
  | "record_application"
  | "record_booking"
  | "project_sales_appointment"
  | "deliver_lead"
  | "deliver_application"
  | "deliver_schedule"
  | "deliver_slack_lead"
  | "deliver_slack_booking"
  | "publish_brevo_lifecycle"
  | "schedule_meeting_reminders"
  | "alert_twenty_failure"
  | "alert_destination_failure";

type AdapterExecutionContext = {
  destination: AdapterDestination;
  operation: AdapterOperation;
};

export type AdapterExecutor = <Result>(
  context: AdapterExecutionContext,
  operation: () => Promise<Result>,
) => Promise<Result>;

type TwentyFailureContext = {
  submissionId: string;
  eventId: string;
  eventType: FunnelEvent["eventType"];
  funnelId: FunnelEvent["funnelId"];
  environment: FunnelEvent["environment"];
  operation: AdapterOperation;
};

const triggerRunLink = (url: string | undefined, fallback: string) =>
  url ? `<${url}|Open in Trigger>` : fallback;

const displayOperation = (operation: AdapterOperation) =>
  ({
    upsert_person: "Upsert person",
    record_application: "Create application",
    record_booking: "Record booking",
    project_sales_appointment: "Project Sales Appointment",
    deliver_lead: "Send lead",
    deliver_application: "Send application",
    deliver_schedule: "Send booking",
    deliver_slack_lead: "Post lead",
    deliver_slack_booking: "Post booking",
    publish_brevo_lifecycle: "Sync lifecycle",
    schedule_meeting_reminders: "Schedule reminders",
    alert_twenty_failure: "Post failure alert",
    alert_destination_failure: "Post failure alert",
  })[operation];

export const formatTwentyFailureAlert = (
  context: TwentyFailureContext,
  runUrl?: string,
) =>
  [
    `:rotating_light: *Twenty CRM sync failed* — ${context.environment}`,
    `${displayOperation(context.operation)} · Funnel: \`${context.funnelId}\` · Journey: \`${context.submissionId}\``,
    triggerRunLink(runUrl, "Trigger run unavailable"),
  ].join("\n");

export const formatBrevoFailureAlert = (
  event: BrevoLifecycleEvent,
  runUrl?: string,
) =>
  [
    `:rotating_light: *Brevo lifecycle sync failed* — ${event.environment}`,
    [
      `Journey: \`${event.submissionId}\``,
      ...("booking" in event.payload
        ? [`Booking: \`${event.payload.booking.uid}\``]
        : []),
    ].join(" · "),
    triggerRunLink(runUrl, "Trigger run unavailable"),
  ].join("\n");

type ProcessorDependencies = {
  internalCanary?: InternalCanaryConfiguration;
  assertEnvironment?(environment: FunnelEvent["environment"]): void;
  upsertTwentyPerson(event: FunnelEvent): Promise<{ personId: string }>;
  sendMetaLead(
    event: ContactSubmittedEvent,
  ): Promise<{ eventsReceived: number }>;
  recordTwentyApplication?(
    event: ApplicationSubmittedEvent,
    personId: string,
    options?: { internalCanary: boolean },
  ): Promise<{ activityId: string; opportunityId?: string }>;
  sendMetaApplication?(
    event: ApplicationSubmittedEvent,
  ): Promise<{ eventsReceived: number }>;
  recordTwentyBooking?(
    event: BookingCompletedEvent,
    personId: string,
    options?: { internalCanary: boolean },
  ): Promise<{ salesAppointmentId: string; opportunityId: string }>;
  projectSalesAppointment?(
    event: BookingRescheduledEvent | BookingCancelledEvent,
  ): Promise<SalesAppointmentProjectionOutcome>;
  sendMetaSchedule?(
    event: BookingCompletedEvent,
  ): Promise<{ eventsReceived: number }>;
  postSlackLead?(event: ContactSubmittedEvent): Promise<unknown>;
  postSlackBooking?(event: BookingCompletedEvent): Promise<unknown>;
  publishBrevoLifecycle?(event: BrevoLifecycleEvent): Promise<unknown>;
  scheduleMeetingReminders?(
    event: BookingCompletedEvent | BookingRescheduledEvent,
    target: ReminderScheduleTarget,
  ): Promise<unknown>;
  schedulePrecallSequence?(
    event: BookingCompletedEvent | BookingRescheduledEvent,
  ): Promise<unknown>;
  capturePostHogLifecycle?(event: FunnelEvent): Promise<void>;
  capturePostHogPersonLink?(
    event: FunnelEvent,
    twentyPersonId: string,
  ): Promise<void>;
  executeAdapter?: AdapterExecutor;
  alertTwentyFailure?(context: TwentyFailureContext): Promise<void>;
  log: {
    info(message: string, data?: Record<string, unknown>): void;
  };
};

type InternalCanaryConfiguration = {
  submissionIds: ReadonlySet<string>;
  attendeeEmail: string;
};

export const parseInternalCanaryConfiguration = (environment: {
  PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS?: string;
  GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL?: string;
}): InternalCanaryConfiguration | undefined => {
  const submissionIds = new Set(
    (environment.PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const attendeeEmail =
    environment.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL?.trim().toLowerCase();
  if (submissionIds.size === 0 || !attendeeEmail) return undefined;
  return { submissionIds, attendeeEmail };
};

const isInternalCanaryEvent = (
  event: FunnelEvent,
  configuration: InternalCanaryConfiguration | undefined,
) =>
  Boolean(
    configuration?.submissionIds.has(event.submissionId) &&
      event.payload.email.trim().toLowerCase() ===
        configuration.attendeeEmail,
  );

export const isInternalTestLead = (event: FunnelEvent) =>
  isInternalTestLeadEmail(event.payload.email);

const runIndependent = async <
  Operations extends Record<string, Promise<unknown>>,
>(
  operations: Operations,
) => {
  const entries = Object.entries(operations);
  const settled: PromiseSettledResult<unknown>[] = [];
  for (const [, operation] of entries) {
    try {
      settled.push({ status: "fulfilled", value: await operation });
    } catch (reason) {
      settled.push({ status: "rejected", reason });
    }
  }
  const errors = settled.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "Multiple funnel destinations failed");
  }
  return Object.fromEntries(
    settled.map((result, index) => [
      entries[index]![0],
      result.status === "fulfilled" ? result.value : undefined,
    ]),
  ) as { [Key in keyof Operations]: Awaited<Operations[Key]> };
};

const executeAdapter = <Result>(
  dependencies: ProcessorDependencies,
  context: AdapterExecutionContext,
  operation: () => Promise<Result>,
) =>
  dependencies.executeAdapter
    ? dependencies.executeAdapter(context, operation)
    : operation();

const executeTwenty = async <Result>(
  event: FunnelEvent,
  dependencies: ProcessorDependencies,
  operationName: AdapterOperation,
  operation: () => Promise<Result>,
) => {
  try {
    return await executeAdapter(
      dependencies,
      { destination: "twenty", operation: operationName },
      operation,
    );
  } catch (error) {
    try {
      await dependencies.alertTwentyFailure?.({
        submissionId: event.submissionId,
        eventId: event.eventId,
        eventType: event.eventType,
        funnelId: event.funnelId,
        environment: event.environment,
        operation: operationName,
      });
    } catch {
      dependencies.log.info("Twenty failure alert delivery failed", {
        submissionId: event.submissionId,
        eventId: event.eventId,
        eventType: event.eventType,
        operation: operationName,
      });
    }
    throw error;
  }
};

const deliverPostHogSafely = async (
  event: FunnelEvent,
  dependencies: ProcessorDependencies,
  delivery: (() => Promise<void>) | undefined,
  failureMessage: string,
) => {
  if (!delivery) return;

  try {
    await delivery();
  } catch {
    dependencies.log.info(failureMessage, {
      submissionId: event.submissionId,
      eventId: event.eventId,
      eventType: event.eventType,
    });
  }
};

const capturePostHogSafely = (
  event: FunnelEvent,
  dependencies: ProcessorDependencies,
) => {
  const capture = dependencies.capturePostHogLifecycle;
  return deliverPostHogSafely(
    event,
    dependencies,
    capture ? () => capture(event) : undefined,
    "PostHog lifecycle delivery failed",
  );
};

const capturePostHogPersonLinkSafely = async (
  event: FunnelEvent,
  personId: string,
  dependencies: ProcessorDependencies,
) => {
  const capture = dependencies.capturePostHogPersonLink;
  return deliverPostHogSafely(
    event,
    dependencies,
    capture ? () => capture(event, personId) : undefined,
    "PostHog person link delivery failed",
  );
};

const precallPayloadFromBooking = (
  event: BookingCompletedEvent | BookingRescheduledEvent,
  guard?: SalesAppointmentAutomationGuard,
) => ({
  submissionId: event.submissionId,
  firstName: event.payload.firstName,
  lastName: event.payload.lastName,
  email: event.payload.email,
  bookingUid: event.payload.booking.uid,
  ...(guard ?? {}),
  expectedStartTime: event.payload.booking.startTime,
  expectedEndTime: event.payload.booking.endTime,
  attendeeTimeZone: event.payload.booking.attendeeTimeZone,
  funnelId: event.funnelId,
  environment: event.environment,
  acquisitionSourceLabel: "one of our ads on Facebook or Instagram",
  sequenceId: `precall:${event.payload.booking.uid}:${event.payload.booking.startTime}:precall-v1`,
  sentMask: 0,
  isNewBooking: event.eventType === "booking_completed",
});

export async function processFunnelEvent(
  event: FunnelEvent,
  dependencies: ProcessorDependencies,
) {
  dependencies.assertEnvironment?.(event.environment);
  const internalTestLead = isInternalTestLead(event);
  const internalCanary =
    internalTestLead &&
    isInternalCanaryEvent(event, dependencies.internalCanary);
  if (internalTestLead && !internalCanary) {
    dependencies.log.info("Skipped internal test lead", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      eventType: event.eventType,
      environment: event.environment,
    });
    return { ok: true as const, skipped: "internal_test_lead" as const };
  }
  if (event.eventType === "booking_rescheduled") {
    dependencies.log.info("Processing verified booking reschedule", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      bookingUid: event.payload.booking.uid,
      previousBookingUid: event.payload.booking.previousUid,
      environment: event.environment,
    });
    // The canonical lifecycle projection must advance before replacement
    // reminders are created. Their send-time generation guard is resolved
    // from this state and therefore cannot authorize the superseded booking.
    const salesAppointment = dependencies.projectSalesAppointment
      ? await executeTwenty(
          event,
          dependencies,
          "project_sales_appointment",
          () => dependencies.projectSalesAppointment!(event),
        )
      : undefined;
    const gmailReminders =
      dependencies.scheduleMeetingReminders?.(event, { channel: "gmail" }) ??
      Promise.resolve();
    const smsReminders = dependencies.scheduleMeetingReminders
      ? (async () => {
          const { personId } = await executeTwenty(
            event,
            dependencies,
            "upsert_person",
            () => dependencies.upsertTwentyPerson(event),
          );
          return dependencies.scheduleMeetingReminders!(event, {
            channel: "sms",
            personId,
          });
        })()
      : Promise.resolve();
    await runIndependent({
      brevo: dependencies.publishBrevoLifecycle?.(event) ?? Promise.resolve(),
      gmailReminders,
      smsReminders,
      salesAppointment: Promise.resolve(salesAppointment),
      measurement: internalCanary
        ? Promise.resolve()
        : capturePostHogSafely(event, dependencies),
    });
    await dependencies.schedulePrecallSequence?.(event);
    return { ok: true as const, bookingUid: event.payload.booking.uid };
  }

  if (event.eventType === "booking_cancelled") {
    dependencies.log.info("Processing verified booking cancellation", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      bookingUid: event.payload.booking.uid,
      environment: event.environment,
    });
    await runIndependent({
      salesAppointment: dependencies.projectSalesAppointment
        ? executeTwenty(event, dependencies, "project_sales_appointment", () =>
            dependencies.projectSalesAppointment!(event),
          )
        : Promise.resolve(),
      brevo: dependencies.publishBrevoLifecycle?.(event) ?? Promise.resolve(),
      measurement: internalCanary
        ? Promise.resolve()
        : capturePostHogSafely(event, dependencies),
    });
    return { ok: true as const, bookingUid: event.payload.booking.uid };
  }

  if (event.eventType === "booking_completed") {
    if (
      !dependencies.recordTwentyBooking ||
      (!internalCanary && !dependencies.sendMetaSchedule)
    ) {
      throw new Error("Booking processing is not configured");
    }
    dependencies.log.info("Processing verified funnel booking", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      bookingUid: event.payload.booking.uid,
      funnelId: event.funnelId,
      environment: event.environment,
    });

    // Schedule the customer-facing sequence before CRM/Slack work. These
    // integrations are independent and must not suppress the booked-call
    // emails when a destination has stale data or a provider outage.
    await dependencies.schedulePrecallSequence?.(event);

    const person = executeTwenty(event, dependencies, "upsert_person", () =>
      dependencies.upsertTwentyPerson(event),
    );
    const gmailReminders =
      dependencies.scheduleMeetingReminders?.(event, { channel: "gmail" }) ??
      Promise.resolve();
    const destinations = await runIndependent({
      core: (async () => {
        const { personId } = await person;
        const smsReminders =
          dependencies.scheduleMeetingReminders?.(event, {
            channel: "sms",
            personId,
          }) ?? Promise.resolve();
        const bookingAndMeasurement = (async () => {
          const booking = await executeTwenty(
            event,
            dependencies,
            "record_booking",
            () =>
              internalCanary
                ? dependencies.recordTwentyBooking!(event, personId, {
                    internalCanary: true,
                  })
                : dependencies.recordTwentyBooking!(event, personId),
          );
          const { eventsReceived } = internalCanary
            ? { eventsReceived: 0 }
            : await executeAdapter(
                dependencies,
                { destination: "meta", operation: "deliver_schedule" },
                () => dependencies.sendMetaSchedule!(event),
              );
          return { personId, booking, eventsReceived };
        })();
        const [result] = await Promise.all([
          bookingAndMeasurement,
          smsReminders,
        ]);
        return result;
      })(),
      slack: internalCanary
        ? Promise.resolve()
        : (dependencies.postSlackBooking?.(event) ?? Promise.resolve()),
      brevo: dependencies.publishBrevoLifecycle?.(event) ?? Promise.resolve(),
      gmailReminders,
      measurement: internalCanary
        ? Promise.resolve()
        : capturePostHogSafely(event, dependencies),
    });
    const { personId, booking, eventsReceived } = destinations.core;
    if (!internalCanary) {
      await capturePostHogPersonLinkSafely(event, personId, dependencies);
    }

    dependencies.log.info("Processed verified funnel booking", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      bookingUid: event.payload.booking.uid,
      personId,
      salesAppointmentId: booking.salesAppointmentId,
      opportunityId: booking.opportunityId,
      metaEventsReceived: eventsReceived,
    });

    return {
      ok: true as const,
      personId,
      salesAppointmentId: booking.salesAppointmentId,
      opportunityId: booking.opportunityId,
      ...(internalCanary
        ? { internalCanary: true as const }
        : { metaEventId: event.eventId }),
    };
  }

  if (event.eventType === "application_submitted") {
    if (
      !dependencies.recordTwentyApplication ||
      (!internalCanary && !dependencies.sendMetaApplication)
    ) {
      throw new Error("Application processing is not configured");
    }
    dependencies.log.info("Processing funnel application", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      funnelId: event.funnelId,
      environment: event.environment,
      qualificationStatus: event.qualificationStatus,
    });

    const destinations = await runIndependent({
      core: (async () => {
        const { personId } = await executeTwenty(
          event,
          dependencies,
          "upsert_person",
          () => dependencies.upsertTwentyPerson(event),
        );
        const application = await executeTwenty(
          event,
          dependencies,
          "record_application",
          () =>
            internalCanary
              ? dependencies.recordTwentyApplication!(event, personId, {
                  internalCanary: true,
                })
              : dependencies.recordTwentyApplication!(event, personId),
        );
        const { eventsReceived } = internalCanary
          ? { eventsReceived: 0 }
          : await executeAdapter(
              dependencies,
              { destination: "meta", operation: "deliver_application" },
              () => dependencies.sendMetaApplication!(event),
            );
        return { personId, application, eventsReceived };
      })(),
      brevo: internalCanary
        ? Promise.resolve()
        : (dependencies.publishBrevoLifecycle?.(event) ?? Promise.resolve()),
      measurement: internalCanary
        ? Promise.resolve()
        : capturePostHogSafely(event, dependencies),
    });
    const { personId, application, eventsReceived } = destinations.core;
    if (!internalCanary) {
      await capturePostHogPersonLinkSafely(event, personId, dependencies);
    }

    dependencies.log.info("Processed funnel application", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      personId,
      activityId: application.activityId,
      ...(application.opportunityId
        ? { opportunityId: application.opportunityId }
        : {}),
      metaEventsReceived: eventsReceived,
    });

    return {
      ok: true as const,
      personId,
      activityId: application.activityId,
      ...(application.opportunityId
        ? { opportunityId: application.opportunityId }
        : {}),
      ...(internalCanary
        ? { internalCanary: true as const }
        : { metaEventId: event.eventId }),
    };
  }

  dependencies.log.info("Processing funnel contact", {
    submissionId: event.submissionId,
    eventId: event.eventId,
    funnelId: event.funnelId,
    environment: event.environment,
    emailVerificationStatus: event.payload.emailVerification.status,
  });

  const destinations = await runIndependent({
    core: (async () => {
      const { personId } = await executeTwenty(
        event,
        dependencies,
        "upsert_person",
        () => dependencies.upsertTwentyPerson(event),
      );
      const { eventsReceived } = internalCanary
        ? { eventsReceived: 0 }
        : await executeAdapter(
            dependencies,
            { destination: "meta", operation: "deliver_lead" },
            () => dependencies.sendMetaLead(event),
          );
      return { personId, eventsReceived };
    })(),
    slack: internalCanary
      ? Promise.resolve()
      : (dependencies.postSlackLead?.(event) ?? Promise.resolve()),
    brevo: internalCanary
      ? Promise.resolve()
      : (dependencies.publishBrevoLifecycle?.(event) ?? Promise.resolve()),
    measurement: internalCanary
      ? Promise.resolve()
      : capturePostHogSafely(event, dependencies),
  });
  const { personId, eventsReceived } = destinations.core;
  if (!internalCanary) {
    await capturePostHogPersonLinkSafely(event, personId, dependencies);
  }

  dependencies.log.info("Processed funnel contact", {
    submissionId: event.submissionId,
    eventId: event.eventId,
    personId,
    metaEventsReceived: eventsReceived,
  });

  return {
    ok: true as const,
    personId,
    ...(internalCanary
      ? { internalCanary: true as const }
      : { metaEventId: event.eventId }),
  };
}

type ProcessorEnvironment = {
  TWENTY_API_KEY?: string;
  TWENTY_API_ORIGIN?: string;
  TWENTY_QUALIFIED_STAGE_VALUE?: string;
  TWENTY_CALL_BOOKED_STAGE_VALUE?: string;
  TWENTY_CLOSED_STAGE_VALUES?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
  META_GRAPH_API_VERSION?: string;
  POSTHOG_PROJECT_KEY?: string;
  POSTHOG_HOST?: string;
  SLACK_FAILURE_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_LEADS_CHANNEL_ID?: string;
  CAL_INTERNAL_BOOKING_BASE_URL?: string;
  BREVO_API_KEY?: string;
  BREVO_ADS_LIST_ID?: string;
  BREVO_NEWSLETTER_LIST_ID?: string;
  BREVO_LEAD_MAGNETS_LIST_ID?: string;
  BREVO_PRECALL_SENDER_EMAIL?: string;
  BREVO_PRECALL_SENDER_NAME?: string;
  BREVO_PRECALL_REPLY_TO_EMAIL?: string;
  PRECALL_EMAILS_ENABLED?: string;
  PRECALL_PUBLIC_ORIGIN?: string;
  PULPSENSE_BUSINESS_POSTAL_ADDRESS?: string;
  PRECALL_OPT_OUT_TOKEN_SECRET?: string;
  CAL_API_KEY?: string;
  PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS?: string;
  GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL?: string;
  PULPSENSE_AUTOMATION_ENVIRONMENT?: FunnelEvent["environment"];
};

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/u, "");

const twentyHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

type TwentyClient = {
  fetch: typeof fetch;
  origin: string;
  apiKey: string;
};

const findTwentyPersonId = async (
  client: TwentyClient,
  email: string,
  includeDeleted = false,
) => {
  const deletedFilter = includeDeleted ? ", deletedAt: { is: NOT_NULL }" : "";
  const response = await client.fetch(`${client.origin}/graphql`, {
    method: "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify({
      query: `
        query FindPersonByEmail($email: String!) {
          people(
            filter: { emails: { primaryEmail: { eq: $email } }${deletedFilter} }
            first: 1
          ) {
            edges { node { id } }
          }
        }
      `,
      variables: { email },
    }),
  });
  if (!response.ok) {
    throw new Error(`Twenty person lookup failed (${response.status})`);
  }

  const result = (await response.json()) as {
    data?: { people?: { edges?: Array<{ node?: { id?: string } }> } };
    errors?: unknown[];
  };
  if (result.errors?.length) throw new Error("Twenty person lookup failed");
  return result.data?.people?.edges?.[0]?.node?.id;
};

const restoreTwentyPerson = async (client: TwentyClient, personId: string) => {
  const response = await client.fetch(`${client.origin}/graphql`, {
    method: "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify({
      query: `mutation RestorePerson($id: UUID!) {
        restorePerson(id: $id) { id }
      }`,
      variables: { id: personId },
    }),
  });
  if (!response.ok) {
    throw new Error(`Twenty person restore failed (${response.status})`);
  }
  const result = (await response.json()) as {
    data?: { restorePerson?: { id?: string } };
    errors?: unknown[];
  };
  if (result.errors?.length || result.data?.restorePerson?.id !== personId) {
    throw new Error("Twenty person restore failed");
  }
};

// Keep these projections aligned with the custom attribution fields provisioned
// on Twenty People and Opportunities.
const twentyVerticalLabels = {
  "ai-seo": "Law Firms",
  "ai-seo-dentists": "Dental Practices",
  "ai-seo-dental-implants": "Dental Implants",
  "ai-seo-plastic-surgery": "Plastic Surgery",
  "ai-seo-hair-restoration": "Hair Restoration",
  "ai-seo-med-spas": "Med Spas",
} as const satisfies Record<FunnelEvent["funnelId"], string>;

const twentyContentWithVertical = (event: FunnelEvent, content?: string) =>
  content
    ? `${twentyVerticalLabels[event.funnelId]} · ${content}`
    : twentyVerticalLabels[event.funnelId];

type TwentyPersonWriteMode = "create" | "update";

const twentyFirstTouchInput = (event: FunnelEvent) => {
  const { firstTouch } = event.attribution;

  return {
    ...(firstTouch.utmSource ? { firstTouchSource: firstTouch.utmSource } : {}),
    ...(firstTouch.utmMedium ? { firstTouchMedium: firstTouch.utmMedium } : {}),
    ...(firstTouch.utmCampaign
      ? { firstTouchCampaign: firstTouch.utmCampaign }
      : {}),
    firstTouchContent: twentyContentWithVertical(event, firstTouch.utmContent),
    ...(firstTouch.landingPage
      ? { firstTouchLandingPage: firstTouch.landingPage }
      : {}),
  };
};

const twentyLastTouchInput = (
  event: FunnelEvent,
  mode: TwentyPersonWriteMode,
) => {
  const { lastTouch } = event.attribution;
  const missingValue = mode === "update" ? null : undefined;

  return {
    lastTouchSource: lastTouch.utmSource ?? missingValue,
    lastTouchMedium: lastTouch.utmMedium ?? missingValue,
    lastTouchCampaign: lastTouch.utmCampaign ?? missingValue,
    lastTouchContent: twentyContentWithVertical(event, lastTouch.utmContent),
    lastTouchLandingPage: lastTouch.landingPage ?? missingValue,
  };
};

const twentyAttributionInput = (event: FunnelEvent) => ({
  ...twentyFirstTouchInput(event),
  ...twentyLastTouchInput(event, "create"),
});

const personInput = (event: FunnelEvent, mode: TwentyPersonWriteMode) => ({
  name: {
    firstName: event.payload.firstName,
    lastName: event.payload.lastName,
  },
  emails: {
    primaryEmail: event.payload.email.trim().toLowerCase(),
    additionalEmails: [],
  },
  phones: {
    primaryPhoneNumber: event.payload.phone,
  },
  ...(event.eventType === "booking_completed" && event.payload.phone.trim()
    ? {
        smsConsentStatus: "OPTED_IN",
        smsConsentSource: "PULPSENSE_ADS_FUNNEL_BOOKING",
        smsConsentUpdatedAt: event.occurredAt,
      }
    : {}),
  ...(event.prospectId ? { prospectId: event.prospectId } : {}),
  ...(mode === "create" ? twentyFirstTouchInput(event) : {}),
  ...twentyLastTouchInput(event, mode),
});

const upsertTwentyPerson = async (event: FunnelEvent, client: TwentyClient) => {
  const normalizedEmail = event.payload.email.trim().toLowerCase();
  const existingId = await findTwentyPersonId(client, normalizedEmail);
  const endpoint = existingId
    ? `${client.origin}/rest/people/${encodeURIComponent(existingId)}`
    : `${client.origin}/rest/people`;
  const response = await client.fetch(endpoint, {
    method: existingId ? "PATCH" : "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify(personInput(event, existingId ? "update" : "create")),
  });

  if (!response.ok) {
    const responseBody = response.status === 400 ? await response.text() : "";
    const isDuplicateCreate =
      !existingId &&
      (response.status === 409 ||
        (response.status === 400 &&
          responseBody.toLowerCase().includes("duplicate entry")));

    if (isDuplicateCreate) {
      const concurrentId = await findTwentyPersonId(client, normalizedEmail);
      const personId =
        concurrentId ??
        (await findTwentyPersonId(client, normalizedEmail, true));
      if (!personId) {
        throw new Error("Twenty person conflict could not be reconciled");
      }
      if (!concurrentId) {
        await restoreTwentyPerson(client, personId);
      }
      const updateResponse = await client.fetch(
        `${client.origin}/rest/people/${encodeURIComponent(personId)}`,
        {
          method: "PATCH",
          headers: twentyHeaders(client.apiKey),
          body: JSON.stringify(personInput(event, "update")),
        },
      );
      if (!updateResponse.ok) {
        throw new Error(
          `Twenty person upsert failed (${updateResponse.status})`,
        );
      }
      return { personId };
    }

    throw new Error(
      `Twenty person upsert failed (${response.status})${responseBody ? `: ${responseBody}` : ""}`,
    );
  }

  const result = (await response.json()) as {
    data?: {
      createPerson?: { id?: string };
      updatePerson?: { id?: string };
      person?: { id?: string };
    };
  };
  const personId =
    existingId ??
    result.data?.createPerson?.id ??
    result.data?.updatePerson?.id ??
    result.data?.person?.id;
  if (!personId) throw new Error("Twenty person upsert omitted person ID");

  return { personId };
};

const findTwentyCompanyId = async (
  client: TwentyClient,
  companyDomain: string,
) => {
  const domainUrl = `https://${companyDomain}`;
  const response = await client.fetch(`${client.origin}/graphql`, {
    method: "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify({
      query: `
        query FindCompanyByDomain($domainUrl: String!) {
          companies(
            filter: { domainName: { primaryLinkUrl: { eq: $domainUrl } } }
            first: 1
          ) {
            edges { node { id } }
          }
        }
      `,
      variables: { domainUrl },
    }),
  });
  if (!response.ok) {
    throw new Error(`Twenty company lookup failed (${response.status})`);
  }
  const result = (await response.json()) as {
    data?: { companies?: { edges?: Array<{ node?: { id?: string } }> } };
    errors?: unknown[];
  };
  if (result.errors?.length) throw new Error("Twenty company lookup failed");
  return result.data?.companies?.edges?.[0]?.node?.id;
};

const createTwentyRecordOnce = async (
  client: TwentyClient,
  objectNamePlural: string,
  input: Record<string, unknown>,
) => {
  const response = await client.fetch(
    `${client.origin}/rest/${objectNamePlural}`,
    {
      method: "POST",
      headers: twentyHeaders(client.apiKey),
      body: JSON.stringify(input),
    },
  );
  if (response.status === 409) return;
  if (!response.ok) {
    const body = await response.text();
    if (
      response.status === 400 &&
      body.toLowerCase().includes("duplicate entry")
    ) {
      return;
    }
    throw new Error(
      `Twenty ${objectNamePlural} create failed (${response.status})`,
    );
  }
};

const applicationMarkdown = (event: ApplicationSubmittedEvent) =>
  [
    `# Application ${event.submissionId}`,
    "",
    `Qualification: ${event.qualificationStatus}`,
    `Submitted: ${event.occurredAt}`,
    "",
    "```json",
    JSON.stringify(event.payload.application, null, 2),
    "```",
  ].join("\n");

const bookingMarkdown = (event: BookingCompletedEvent) =>
  [
    `# Booking ${event.payload.booking.uid}`,
    "",
    `Title: ${event.payload.booking.title}`,
    `Starts: ${event.payload.booking.startTime}`,
    `Ends: ${event.payload.booking.endTime}`,
    `Confirmed: ${event.occurredAt}`,
  ].join("\n");

const deterministicUuid = async (identity: string) => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const findOpenTwentyOpportunity = async (
  client: TwentyClient,
  personId: string,
  closedStageValues: ReadonlySet<string>,
) => {
  let after: string | undefined;
  do {
    const response = await client.fetch(`${client.origin}/graphql`, {
      method: "POST",
      headers: twentyHeaders(client.apiKey),
      body: JSON.stringify({
        query: `
        query FindOpportunitiesByPerson($personId: UUID!, $after: String) {
          opportunities(
            filter: { pointOfContactId: { eq: $personId } }
            first: 50
            after: $after
          ) {
            edges { node { id stage } }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
        variables: { personId, ...(after ? { after } : {}) },
      }),
    });
    if (!response.ok) {
      throw new Error(`Twenty opportunity lookup failed (${response.status})`);
    }
    const result = (await response.json()) as {
      data?: {
        opportunities?: {
          edges?: Array<{ node?: { id?: string; stage?: string } }>;
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
        };
      };
      errors?: unknown[];
    };
    if (result.errors?.length) {
      throw new Error("Twenty opportunity lookup failed");
    }
    const opportunity = result.data?.opportunities?.edges
      ?.map(({ node }) => node)
      .find(
        (opportunity) =>
          opportunity?.id &&
          opportunity.stage &&
          !closedStageValues.has(opportunity.stage),
      );
    if (opportunity?.id && opportunity.stage) {
      return { id: opportunity.id, stage: opportunity.stage };
    }
    const pageInfo = result.data?.opportunities?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return undefined;
};

const writeTwentyOpportunity = async (
  client: TwentyClient,
  input: Record<string, unknown>,
  opportunityId?: string,
) => {
  const response = await client.fetch(
    opportunityId
      ? `${client.origin}/rest/opportunities/${encodeURIComponent(opportunityId)}`
      : `${client.origin}/rest/opportunities`,
    {
      method: opportunityId ? "PATCH" : "POST",
      headers: twentyHeaders(client.apiKey),
      body: JSON.stringify(input),
    },
  );
  if (
    response.status === 409 &&
    !opportunityId &&
    typeof input.id === "string"
  ) {
    return input.id;
  }
  if (!response.ok) {
    throw new Error(`Twenty opportunity write failed (${response.status})`);
  }
  if (opportunityId) return opportunityId;
  const result = (await response.json()) as {
    data?: {
      createOpportunity?: { id?: string };
      opportunity?: { id?: string };
    };
  };
  const createdId =
    result.data?.createOpportunity?.id ??
    result.data?.opportunity?.id ??
    (typeof input.id === "string" ? input.id : undefined);
  if (!createdId) throw new Error("Twenty opportunity create omitted ID");
  return createdId;
};

export const shouldAdvanceOpportunityToCallBooked = (
  currentStage: string,
  qualifiedStage: string,
  callBookedStage: string,
) => currentStage === qualifiedStage && currentStage !== callBookedStage;

const advanceTwentyOpportunityToCallBooked = async (
  client: TwentyClient,
  opportunityId: string,
  qualifiedStage: string,
  callBookedStage: string,
) => {
  const response = await client.fetch(
    `${client.origin}/rest/opportunities/${encodeURIComponent(opportunityId)}`,
    { headers: twentyHeaders(client.apiKey) },
  );
  if (!response.ok) {
    throw new Error(`Twenty opportunity lookup failed (${response.status})`);
  }
  const result = (await response.json()) as {
    data?: { opportunity?: { id?: string; stage?: string } };
  };
  const opportunity = result.data?.opportunity;
  if (!opportunity?.id || !opportunity.stage) {
    throw new Error("Twenty opportunity lookup omitted identity or stage");
  }
  if (
    !shouldAdvanceOpportunityToCallBooked(
      opportunity.stage,
      qualifiedStage,
      callBookedStage,
    )
  ) {
    return;
  }
  await writeTwentyOpportunity(
    client,
    { stage: callBookedStage },
    opportunityId,
  );
};

const recordTwentyApplication = async (
  event: ApplicationSubmittedEvent,
  personId: string,
  client: TwentyClient,
  qualifiedStageValue: string | undefined,
  closedStageValues: ReadonlySet<string>,
  options: { internalCanary: boolean },
) => {
  // Twenty's workspace automation is the sole Company creator. Trigger.dev
  // only matches the normalized email domain so both systems cannot race.
  const companyId = await findTwentyCompanyId(client, event.companyDomain);
  await createTwentyRecordOnce(client, "notes", {
    id: event.submissionId,
    title: `Application ${event.submissionId}`,
    bodyV2: { markdown: applicationMarkdown(event) },
  });
  await createTwentyRecordOnce(client, "noteTargets", {
    id: event.submissionId,
    noteId: event.submissionId,
    targetPersonId: personId,
  });

  if (event.qualificationStatus === "unqualified") {
    return { activityId: event.submissionId };
  }

  const stage = required(qualifiedStageValue, "TWENTY_QUALIFIED_STAGE_VALUE");
  const openOpportunity = options.internalCanary
    ? undefined
    : await findOpenTwentyOpportunity(client, personId, closedStageValues);
  const attemptOpportunityId = openOpportunity
    ? undefined
    : await deterministicUuid(`funnel-opportunity:${event.submissionId}`);
  const opportunityId = await writeTwentyOpportunity(
    client,
    {
      ...(attemptOpportunityId ? { id: attemptOpportunityId } : {}),
      name: `AI SEO – ${event.companyDomain}`,
      ...(options.internalCanary ? { isTest: true } : {}),
      ...(openOpportunity ? {} : { stage }),
      ...(openOpportunity
        ? {}
        : {
            originatingLeadJourneyId: event.submissionId,
            ...twentyAttributionInput(event),
          }),
      pointOfContactId: personId,
      ...(companyId ? { companyId } : {}),
    },
    openOpportunity?.id,
  );

  return { activityId: event.submissionId, opportunityId };
};

const recordTwentyBooking = async (
  event: BookingCompletedEvent,
  personId: string,
  client: TwentyClient,
  qualifiedStageValue: string | undefined,
  callBookedStageValue: string | undefined,
  closedStageValues: ReadonlySet<string>,
  ledgerAdapter: ReturnType<typeof createTwentySalesAppointmentAdapter>,
  options: { internalCanary: boolean },
) => {
  const qualifiedStage = required(
    qualifiedStageValue,
    "TWENTY_QUALIFIED_STAGE_VALUE",
  );
  const callBookedStage = required(
    callBookedStageValue,
    "TWENTY_CALL_BOOKED_STAGE_VALUE",
  );
  const projection: SalesAppointmentProjectionOutcome =
    await projectSalesAppointmentLifecycle(
      event,
      {
        ...(options.internalCanary
          ? {
              classification: {
                classification: "NON_PRODUCTION" as const,
                isTest: true,
                isCommercial: false,
              },
            }
          : {}),
        resolveCreationContext: async () => {
          if (options.internalCanary) {
            return {
              personId,
              opportunityId: await deterministicUuid(
                `funnel-opportunity:${event.submissionId}`,
              ),
            };
          }
          const opportunity = await findOpenTwentyOpportunity(
            client,
            personId,
            closedStageValues,
          );
          if (!opportunity) {
            throw new Error(
              "Qualified Opportunity is not available for booking",
            );
          }
          return { personId, opportunityId: opportunity.id };
        },
      },
      ledgerAdapter,
    );
  if (!projection.opportunityId) {
    throw new Error("Sales Appointment is missing its Opportunity reference");
  }
  await advanceTwentyOpportunityToCallBooked(
    client,
    projection.opportunityId,
    qualifiedStage,
    callBookedStage,
  );

  // Notes are a human-readable timeline mirror only. Their deterministic ID
  // remains separate from canonical Sales Appointment measurement state.
  const noteId = await deterministicUuid(
    `cal-booking:${event.payload.booking.uid}`,
  );
  await createTwentyRecordOnce(client, "notes", {
    id: noteId,
    title: `Booking ${event.payload.booking.uid}`,
    bodyV2: { markdown: bookingMarkdown(event) },
  });
  await createTwentyRecordOnce(client, "noteTargets", {
    id: noteId,
    noteId,
    targetPersonId: personId,
  });

  return {
    salesAppointmentId: projection.salesAppointmentId,
    opportunityId: projection.opportunityId,
  };
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export const normalizeMetaName = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

const sendMetaEvent = async (
  event: FunnelEvent,
  eventName: "Lead" | "SubmitApplication" | "Schedule",
  customData: Record<string, unknown>,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) => {
  const normalizedFirstName = normalizeMetaName(event.payload.firstName);
  const normalizedLastName = event.payload.lastName
    ? normalizeMetaName(event.payload.lastName)
    : "";
  const userData: Record<string, unknown> = {
    em: [await sha256(event.payload.email.trim().toLowerCase())],
    ph: [await sha256(event.payload.phone.replace(/\D/gu, ""))],
    external_id: [await sha256(event.submissionId.trim().toLowerCase())],
    ...(normalizedFirstName ? { fn: [await sha256(normalizedFirstName)] } : {}),
    ...(normalizedLastName ? { ln: [await sha256(normalizedLastName)] } : {}),
    client_ip_address: event.requestContext.clientIp,
    client_user_agent: event.requestContext.userAgent,
    ...(event.requestContext.fbp ? { fbp: event.requestContext.fbp } : {}),
    ...(event.requestContext.fbc ? { fbc: event.requestContext.fbc } : {}),
  };
  const response = await fetcher(
    `https://graph.facebook.com/${encodeURIComponent(graphApiVersion)}/${encodeURIComponent(pixelId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000),
            event_id: event.eventId,
            action_source: "website",
            event_source_url: event.requestContext.sourceUrl,
            user_data: userData,
            custom_data: customData,
          },
        ],
        ...(testEventCode ? { test_event_code: testEventCode } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Meta ${eventName} delivery failed (${response.status})`);
  }

  const result = (await response.json()) as { events_received?: number };
  if (result.events_received !== 1) {
    throw new Error(`Meta ${eventName} delivery was not acknowledged`);
  }

  return { eventsReceived: result.events_received };
};

const sendMetaLead = async (
  event: ContactSubmittedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) =>
  sendMetaEvent(
    event,
    "Lead",
    { funnel_id: event.funnelId },
    fetcher,
    graphApiVersion,
    pixelId,
    accessToken,
    testEventCode,
  );

const sendMetaApplication = async (
  event: ApplicationSubmittedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) =>
  sendMetaEvent(
    event,
    "SubmitApplication",
    { qualification_status: event.qualificationStatus },
    fetcher,
    graphApiVersion,
    pixelId,
    accessToken,
    testEventCode,
  );

const sendMetaSchedule = async (
  event: BookingCompletedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) =>
  sendMetaEvent(
    event,
    "Schedule",
    { funnel_id: event.funnelId },
    fetcher,
    graphApiVersion,
    pixelId,
    accessToken,
    testEventCode,
  );

export function createProcessorDependencies(
  environment: ProcessorEnvironment,
  runtime: {
    fetch: typeof fetch;
    log: ProcessorDependencies["log"];
    executeAdapter?: AdapterExecutor;
    run?: { id: string; url: string };
  },
): ProcessorDependencies {
  const twentyApiKey = required(environment.TWENTY_API_KEY, "TWENTY_API_KEY");
  const twentyOrigin = normalizeOrigin(
    required(environment.TWENTY_API_ORIGIN, "TWENTY_API_ORIGIN"),
  );
  const pixelId = required(environment.META_PIXEL_ID, "META_PIXEL_ID");
  const metaToken = required(
    environment.META_CAPI_ACCESS_TOKEN,
    "META_CAPI_ACCESS_TOKEN",
  );
  const metaTestEventCode = environment.META_TEST_EVENT_CODE;
  const graphVersion = required(
    environment.META_GRAPH_API_VERSION,
    "META_GRAPH_API_VERSION",
  );
  const automationEnvironment = required(
    environment.PULPSENSE_AUTOMATION_ENVIRONMENT,
    "PULPSENSE_AUTOMATION_ENVIRONMENT",
  ) as ContactSubmittedEvent["environment"];
  const slackFailureWebhookUrl = required(
    environment.SLACK_FAILURE_WEBHOOK_URL,
    "SLACK_FAILURE_WEBHOOK_URL",
  );
  const slackConfig =
    environment.SLACK_BOT_TOKEN && environment.SLACK_LEADS_CHANNEL_ID
      ? {
          botToken: environment.SLACK_BOT_TOKEN,
          channelId: environment.SLACK_LEADS_CHANNEL_ID,
          internalBookingBaseUrl: environment.CAL_INTERNAL_BOOKING_BASE_URL,
        }
      : undefined;
  if (
    Boolean(environment.SLACK_BOT_TOKEN) !==
    Boolean(environment.SLACK_LEADS_CHANNEL_ID)
  ) {
    throw new Error(
      "SLACK_BOT_TOKEN and SLACK_LEADS_CHANNEL_ID must be configured together",
    );
  }
  if (
    Boolean(environment.BREVO_API_KEY) !==
    Boolean(environment.BREVO_ADS_LIST_ID)
  ) {
    throw new Error(
      "BREVO_API_KEY and BREVO_ADS_LIST_ID must be configured together",
    );
  }
  const brevoAdsListId = environment.BREVO_ADS_LIST_ID
    ? Number(environment.BREVO_ADS_LIST_ID)
    : undefined;
  if (
    brevoAdsListId !== undefined &&
    (!Number.isInteger(brevoAdsListId) || brevoAdsListId <= 0)
  ) {
    throw new Error("BREVO_ADS_LIST_ID must be a positive integer");
  }
  const brevoNewsletterListId = environment.BREVO_NEWSLETTER_LIST_ID
    ? Number(environment.BREVO_NEWSLETTER_LIST_ID)
    : undefined;
  const brevoLeadMagnetsListId = environment.BREVO_LEAD_MAGNETS_LIST_ID
    ? Number(environment.BREVO_LEAD_MAGNETS_LIST_ID)
    : undefined;
  for (const [name, value] of [
    ["BREVO_NEWSLETTER_LIST_ID", brevoNewsletterListId],
    ["BREVO_LEAD_MAGNETS_LIST_ID", brevoLeadMagnetsListId],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
  const brevoConfig =
    environment.BREVO_API_KEY && brevoAdsListId
      ? {
          apiKey: environment.BREVO_API_KEY,
          adsListId: brevoAdsListId,
          newsletterListId: brevoNewsletterListId,
          leadMagnetsListId: brevoLeadMagnetsListId,
        }
      : undefined;
  const twentyClient: TwentyClient = {
    fetch: runtime.fetch,
    origin: twentyOrigin,
    apiKey: twentyApiKey,
  };
  const salesAppointmentAdapter =
    createTwentySalesAppointmentAdapter(twentyClient);
  const resolveAutomationGuard = async (
    event: BookingCompletedEvent | BookingRescheduledEvent,
  ) => {
    if (event.eventType === "booking_completed") {
      return {
        salesAppointmentId: await salesAppointmentIdFor(
          event.payload.booking.uid,
        ),
        automationGeneration: 1,
      };
    }
    const version = await salesAppointmentAdapter.findBookingVersion(
      event.payload.booking.uid,
    );
    if (!version) {
      throw new Error(
        "Replacement BookingVersion is unavailable for automation guard",
      );
    }
    const appointment = await salesAppointmentAdapter.getSalesAppointment(
      version.salesAppointmentId,
    );
    if (!appointment?.automationGeneration) {
      throw new Error("Sales Appointment automation generation is unavailable");
    }
    return {
      salesAppointmentId: appointment.id,
      automationGeneration: appointment.automationGeneration,
    };
  };
  const closedStageValues = new Set(
    (environment.TWENTY_CLOSED_STAGE_VALUES ?? "WON,LOST,CLOSED")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const capturePostHogLifecycle = environment.POSTHOG_PROJECT_KEY
    ? createPostHogLifecycleCapture(
        {
          apiKey: environment.POSTHOG_PROJECT_KEY,
          host: environment.POSTHOG_HOST ?? "https://us.i.posthog.com",
        },
        { fetch: runtime.fetch },
      )
    : undefined;
  const capturePostHogPersonLink = environment.POSTHOG_PROJECT_KEY
    ? createPostHogPersonLinkCapture(
        {
          apiKey: environment.POSTHOG_PROJECT_KEY,
          host: environment.POSTHOG_HOST ?? "https://us.i.posthog.com",
        },
        { fetch: runtime.fetch },
      )
    : undefined;
  const executeWithRetry: AdapterExecutor =
    runtime.executeAdapter ??
    ((context, operation) =>
      retry.onThrow(
        async ({ attempt }) => {
          runtime.log.info("Running funnel destination adapter", {
            destination: context.destination,
            operation: context.operation,
            attempt,
          });
          return operation();
        },
        {
          maxAttempts: context.destination === "slack" ? 3 : 5,
          factor: 2,
          minTimeoutInMs: 1_000,
          maxTimeoutInMs: 30_000,
          randomize: true,
        },
      ));
  const alertTwentyFailure = async (context: TwentyFailureContext) => {
    const runReference = runtime.run
      ? `<${runtime.run.url}|${runtime.run.id}>`
      : "unavailable";
    await executeWithRetry(
      { destination: "slack", operation: "alert_twenty_failure" },
      async () => {
        const response = await runtime.fetch(slackFailureWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [
              ":rotating_light: Twenty delivery exhausted retries",
              `Environment: ${context.environment}`,
              `Funnel: ${context.funnelId}`,
              `Event type: ${context.eventType}`,
              `Submission: ${context.submissionId}`,
              `Operation: ${displayOperation(context.operation)}`,
              `Trigger.dev run: ${runReference}`,
            ].join("\n"),
          }),
        });
        if (!response.ok) {
          throw new Error(`Slack alert delivery failed (${response.status})`);
        }
      },
    );
  };
  const alertDestinationFailure = async (
    event: BrevoLifecycleEvent,
    operation: AdapterOperation,
  ) => {
    const runReference = runtime.run
      ? `<${runtime.run.url}|${runtime.run.id}>`
      : "unavailable";
    await executeWithRetry(
      { destination: "slack", operation: "alert_destination_failure" },
      async () => {
        const response = await runtime.fetch(slackFailureWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [
              ":rotating_light: Lifecycle destination exhausted retries",
              `Environment: ${event.environment}`,
              `Destination: brevo`,
              `Operation: ${displayOperation(operation)}`,
              `Lead Journey: ${event.submissionId}`,
              ...("booking" in event.payload
                ? [`Cal UID: ${event.payload.booking.uid}`]
                : []),
              `Trigger.dev run: ${runReference}`,
            ].join("\n"),
          }),
        });
        if (!response.ok) {
          throw new Error(`Slack alert delivery failed (${response.status})`);
        }
      },
    );
  };
  const internalCanaryConfiguration =
    parseInternalCanaryConfiguration(environment);

  return {
    ...(internalCanaryConfiguration
      ? { internalCanary: internalCanaryConfiguration }
      : {}),
    assertEnvironment: (eventEnvironment) => {
      if (eventEnvironment !== automationEnvironment) {
        throw new Error("Funnel event environment does not match destinations");
      }
    },
    upsertTwentyPerson: (event) => upsertTwentyPerson(event, twentyClient),
    recordTwentyApplication: (event, personId, options) =>
      recordTwentyApplication(
        event,
        personId,
        twentyClient,
        environment.TWENTY_QUALIFIED_STAGE_VALUE,
        closedStageValues,
        options ?? { internalCanary: false },
      ),
    recordTwentyBooking: (event, personId, options) =>
      recordTwentyBooking(
        event,
        personId,
        twentyClient,
        environment.TWENTY_QUALIFIED_STAGE_VALUE,
        environment.TWENTY_CALL_BOOKED_STAGE_VALUE,
        closedStageValues,
        salesAppointmentAdapter,
        options ?? { internalCanary: false },
      ),
    projectSalesAppointment: (event) =>
      projectSalesAppointmentLifecycle(event, {}, salesAppointmentAdapter),
    sendMetaLead: (event) =>
      sendMetaLead(
        event,
        runtime.fetch,
        graphVersion,
        pixelId,
        metaToken,
        metaTestEventCode,
      ),
    sendMetaApplication: (event) =>
      sendMetaApplication(
        event,
        runtime.fetch,
        graphVersion,
        pixelId,
        metaToken,
        metaTestEventCode,
      ),
    sendMetaSchedule: (event) =>
      sendMetaSchedule(
        event,
        runtime.fetch,
        graphVersion,
        pixelId,
        metaToken,
        metaTestEventCode,
      ),
    ...(slackConfig
      ? {
          postSlackLead: (event: ContactSubmittedEvent) =>
            executeWithRetry(
              { destination: "slack", operation: "deliver_slack_lead" },
              () => postSlackLead(event, slackConfig, runtime.fetch),
            ),
          postSlackBooking: (event: BookingCompletedEvent) =>
            executeWithRetry(
              { destination: "slack", operation: "deliver_slack_booking" },
              () => postSlackBooking(event, slackConfig, runtime.fetch),
            ),
        }
      : {}),
    ...(brevoConfig
      ? {
          publishBrevoLifecycle: async (event: BrevoLifecycleEvent) => {
            try {
              return await executeWithRetry(
                {
                  destination: "brevo",
                  operation: "publish_brevo_lifecycle",
                },
                () => publishBrevoLifecycle(event, brevoConfig, runtime.fetch),
              );
            } catch (error) {
              try {
                await alertDestinationFailure(event, "publish_brevo_lifecycle");
              } catch {
                runtime.log.info("Brevo failure alert delivery failed", {
                  submissionId: event.submissionId,
                  eventId: event.eventId,
                });
              }
              throw error;
            }
          },
        }
      : {}),
    ...(environment.CAL_API_KEY
      ? {
          scheduleMeetingReminders: async (
            event: BookingCompletedEvent | BookingRescheduledEvent,
            target: ReminderScheduleTarget,
          ) =>
            executeWithRetry(
              {
                destination: "trigger",
                operation: "schedule_meeting_reminders",
              },
              async () =>
                scheduleMeetingReminders(
                  event,
                  target,
                  (payload, options) =>
                    sendMeetingReminderTask.trigger(payload, options),
                  undefined,
                  undefined,
                  await resolveAutomationGuard(event),
                ),
            ),
        }
      : {}),
    ...(environment.PRECALL_EMAILS_ENABLED === "true" && environment.CAL_API_KEY
      ? {
          schedulePrecallSequence: async (
            event: BookingCompletedEvent | BookingRescheduledEvent,
          ) => {
            const payload = precallPayloadFromBooking(
              event,
              await resolveAutomationGuard(event),
            );
            return executeWithRetry(
              {
                destination: "trigger",
                operation: "schedule_meeting_reminders",
              },
              () =>
                runPrecallSequenceTask.trigger(payload, {
                  idempotencyKey: `precall-run:${payload.sequenceId}`,
                  idempotencyKeyTTL: "1y",
                }),
            );
          },
        }
      : {}),
    executeAdapter: executeWithRetry,
    alertTwentyFailure,
    ...(capturePostHogLifecycle ? { capturePostHogLifecycle } : {}),
    ...(capturePostHogPersonLink ? { capturePostHogPersonLink } : {}),
    log: runtime.log,
  };
}

export const processFunnelEventTask = schemaTask({
  id: "process-funnel-event",
  schema: funnelEventSchema,
  // Serial execution closes the read-then-create race for the single open
  // Opportunity invariant. Revisit with a per-Person queue if volume requires.
  queue: { concurrencyLimit: 1 },
  retry: {
    // Destination adapters retry independently inside the run. Keeping the
    // outer task single-attempt avoids repeating an adapter that already won.
    maxAttempts: 1,
  },
  run: async (event, { ctx }) =>
    processFunnelEvent(
      event,
      createProcessorDependencies(
        {
          TWENTY_API_KEY: process.env.TWENTY_API_KEY,
          TWENTY_API_ORIGIN: process.env.TWENTY_API_ORIGIN,
          TWENTY_QUALIFIED_STAGE_VALUE:
            process.env.TWENTY_QUALIFIED_STAGE_VALUE,
          TWENTY_CALL_BOOKED_STAGE_VALUE:
            process.env.TWENTY_CALL_BOOKED_STAGE_VALUE,
          TWENTY_CLOSED_STAGE_VALUES: process.env.TWENTY_CLOSED_STAGE_VALUES,
          ...resolveMetaEnvironment(process.env, event.funnelId),
          META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
          POSTHOG_PROJECT_KEY: process.env.POSTHOG_PROJECT_KEY,
          POSTHOG_HOST: process.env.POSTHOG_HOST,
          SLACK_FAILURE_WEBHOOK_URL: process.env.SLACK_FAILURE_WEBHOOK_URL,
          SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
          SLACK_LEADS_CHANNEL_ID: process.env.SLACK_LEADS_CHANNEL_ID,
          CAL_INTERNAL_BOOKING_BASE_URL:
            process.env.CAL_INTERNAL_BOOKING_BASE_URL,
          BREVO_API_KEY: process.env.BREVO_API_KEY,
          BREVO_ADS_LIST_ID: process.env.BREVO_ADS_LIST_ID,
          BREVO_NEWSLETTER_LIST_ID: process.env.BREVO_NEWSLETTER_LIST_ID,
          BREVO_LEAD_MAGNETS_LIST_ID: process.env.BREVO_LEAD_MAGNETS_LIST_ID,
          BREVO_PRECALL_SENDER_EMAIL: process.env.BREVO_PRECALL_SENDER_EMAIL,
          BREVO_PRECALL_SENDER_NAME: process.env.BREVO_PRECALL_SENDER_NAME,
          BREVO_PRECALL_REPLY_TO_EMAIL:
            process.env.BREVO_PRECALL_REPLY_TO_EMAIL,
          PRECALL_EMAILS_ENABLED: process.env.PRECALL_EMAILS_ENABLED,
          PRECALL_PUBLIC_ORIGIN: process.env.PRECALL_PUBLIC_ORIGIN,
          PULPSENSE_BUSINESS_POSTAL_ADDRESS:
            process.env.PULPSENSE_BUSINESS_POSTAL_ADDRESS,
          PRECALL_OPT_OUT_TOKEN_SECRET:
            process.env.PRECALL_OPT_OUT_TOKEN_SECRET,
          CAL_API_KEY: process.env.CAL_API_KEY,
          PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS:
            process.env.PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS,
          GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL:
            process.env
              .GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL,
          PULPSENSE_AUTOMATION_ENVIRONMENT: process.env
            .PULPSENSE_AUTOMATION_ENVIRONMENT as
            | FunnelEvent["environment"]
            | undefined,
        },
        {
          fetch,
          log: logger,
          run: {
            id: ctx.run.id,
            url: `https://cloud.trigger.dev/projects/v3/${encodeURIComponent(ctx.project.ref)}/runs/${encodeURIComponent(ctx.run.id)}`,
          },
        },
      ),
    ),
});
