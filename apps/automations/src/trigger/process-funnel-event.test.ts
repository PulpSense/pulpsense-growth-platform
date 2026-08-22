import type {
  ApplicationSubmittedEvent,
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingRescheduledEvent,
  ContactSubmittedEvent,
  FunnelEvent,
} from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  type AdapterExecutor,
  createProcessorDependencies,
  formatBrevoFailureAlert,
  formatTwentyFailureAlert,
  normalizeMetaName,
  parseInternalCanaryConfiguration,
  processFunnelEvent,
  shouldAdvanceOpportunityToCallBooked,
} from "./process-funnel-event.js";
import { triggerRunUrl } from "./trigger-dashboard.js";

const retryImmediately =
  (maxAttempts: number): AdapterExecutor =>
  async (_context, operation) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

describe("normalizeMetaName", () => {
  it("lowercases names and removes punctuation before hashing", () => {
    expect(normalizeMetaName("  Mary-Jane O’Connor  ")).toBe("maryjaneoconnor");
  });
});

describe("Opportunity booking-stage policy", () => {
  it.each([
    ["QUALIFIED_AWAITING_BOOKING", true],
    ["CALL_BOOKED", false],
    ["PROPOSAL", false],
    ["WON", false],
    ["LOST", false],
  ] as const)("allows advancement from %s: %s", (currentStage, expected) => {
    expect(
      shouldAdvanceOpportunityToCallBooked(
        currentStage,
        "QUALIFIED_AWAITING_BOOKING",
        "CALL_BOOKED",
      ),
    ).toBe(expected);
  });
});

const event: ContactSubmittedEvent = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "ai-seo",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  prospectId:
    "prospect_v1_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  eventId: "contact_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-08T12:00:00.000Z",
  payload: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@brand.com",
    phone: "+1 555 123 4567",
    emailVerification: { status: "verified", result: "business" },
  },
  attribution: {
    firstTouch: {
      utmSource: "meta",
      utmMedium: "paid-social",
      utmCampaign: "ai-seo-audit",
      utmContent: "founder-video-1",
      landingPage: "https://preview.pulpsense.com/ai-seo/",
    },
    lastTouch: {
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "qualified-lead-nurture",
      utmContent: "case-study-cta",
      landingPage: "https://preview.pulpsense.com/ai-seo/apply",
    },
  },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "Test Browser",
    sourceUrl: "https://preview.pulpsense.com/ai-seo/",
    fbp: "fb.1.123.456",
  },
  environment: "preview",
};

const expectedTwentyFirstTouchAttribution = {
  firstTouchSource: "meta",
  firstTouchMedium: "paid-social",
  firstTouchCampaign: "ai-seo-audit",
  firstTouchContent: "Law Firms · founder-video-1",
  firstTouchLandingPage: "https://preview.pulpsense.com/ai-seo/",
};

const expectedTwentyLastTouchAttribution = {
  lastTouchSource: "newsletter",
  lastTouchMedium: "email",
  lastTouchCampaign: "qualified-lead-nurture",
  lastTouchContent: "Law Firms · case-study-cta",
  lastTouchLandingPage: "https://preview.pulpsense.com/ai-seo/apply",
};

const expectedTwentyDirectLastTouchAttribution = {
  lastTouchSource: null,
  lastTouchMedium: null,
  lastTouchCampaign: null,
  lastTouchContent: "Law Firms",
  lastTouchLandingPage: "https://preview.pulpsense.com/ai-seo/direct",
};

const expectedTwentyAttribution = {
  ...expectedTwentyFirstTouchAttribution,
  ...expectedTwentyLastTouchAttribution,
};

const expectNoTwentyFirstTouch = (input: unknown) => {
  for (const field of Object.keys(expectedTwentyFirstTouchAttribution)) {
    expect(input).not.toHaveProperty(field);
  }
};

const directContactEvent: ContactSubmittedEvent = {
  ...event,
  attribution: {
    firstTouch: event.attribution.firstTouch,
    lastTouch: {
      landingPage:
        expectedTwentyDirectLastTouchAttribution.lastTouchLandingPage,
    },
  },
};

const applicationEvent: ApplicationSubmittedEvent = {
  schemaVersion: 1,
  eventType: "application_submitted",
  funnelId: "ai-seo",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  prospectId: event.prospectId,
  eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-08T12:05:00.000Z",
  payload: {
    ...event.payload,
    application: {
      businessOwner: "yes",
      marketingBudget: "Under $500/month or not set yet",
      investmentIntent: "Yes, if the numbers make sense",
    },
  },
  qualificationStatus: "unqualified",
  companyDomain: "brand.com",
  attribution: event.attribution,
  requestContext: event.requestContext,
  environment: "preview",
};

const qualifiedApplicationEvent: ApplicationSubmittedEvent = {
  ...applicationEvent,
  payload: {
    ...applicationEvent.payload,
    application: {
      ...applicationEvent.payload.application,
      marketingBudget: "$1,500+/month",
    },
  },
  qualificationStatus: "qualified",
};

const bookingEvent: BookingCompletedEvent = {
  schemaVersion: 1,
  eventType: "booking_completed",
  funnelId: "ai-seo",
  submissionId: applicationEvent.submissionId,
  prospectId: applicationEvent.prospectId,
  eventId: "booking_completed:cal_booking_123",
  occurredAt: "2026-08-09T12:00:00.000Z",
  payload: {
    firstName: event.payload.firstName,
    lastName: event.payload.lastName,
    email: event.payload.email,
    phone: event.payload.phone,
    emailVerification: { status: "verified", result: "business" },
    booking: {
      uid: "cal_booking_123",
      title: "AI SEO Fit Call",
      startTime: "2026-08-10T14:00:00.000Z",
      endTime: "2026-08-10T14:15:00.000Z",
      attendeeTimeZone: "America/New_York",
      meetingUrl: "https://meet.example.com/cal_booking_123",
    },
  },
  qualificationStatus: "qualified",
  attribution: event.attribution,
  requestContext: event.requestContext,
  environment: "preview",
};

const rescheduledEvent: BookingRescheduledEvent = {
  ...bookingEvent,
  eventType: "booking_rescheduled",
  eventId: "booking_rescheduled:cal_booking_456",
  occurredAt: "2026-08-09T13:00:00.000Z",
  payload: {
    ...bookingEvent.payload,
    booking: {
      ...bookingEvent.payload.booking,
      uid: "cal_booking_456",
      previousUid: bookingEvent.payload.booking.uid,
      previousStartTime: bookingEvent.payload.booking.startTime,
      previousEndTime: bookingEvent.payload.booking.endTime,
      startTime: "2026-08-11T14:00:00.000Z",
      endTime: "2026-08-11T14:15:00.000Z",
      meetingUrl: "https://meet.example.com/cal_booking_456",
    },
  },
};

const cancelledEvent: BookingCancelledEvent = {
  ...bookingEvent,
  eventType: "booking_cancelled",
  eventId: `booking_cancelled:${bookingEvent.payload.booking.uid}`,
  payload: {
    ...bookingEvent.payload,
    booking: {
      ...bookingEvent.payload.booking,
      cancellationReason: "No longer needed",
    },
  },
};

describe("process-funnel-event", () => {
  it.each(["santi@pulpsense.com", "me@santileoni.com"])(
    "suppresses every external destination for internal test lead %s",
    async (email) => {
      const externalDestinations = {
        upsertTwentyPerson: vi.fn(),
        sendMetaLead: vi.fn(),
        recordTwentyApplication: vi.fn(),
        sendMetaApplication: vi.fn(),
        recordTwentyBooking: vi.fn(),
        sendMetaSchedule: vi.fn(),
        postSlackLead: vi.fn(),
        postSlackBooking: vi.fn(),
        publishBrevoLifecycle: vi.fn(),
        scheduleMeetingReminders: vi.fn(),
        schedulePrecallSequence: vi.fn(),
        capturePostHogLifecycle: vi.fn(),
        capturePostHogPersonLink: vi.fn(),
      };
      const log = { info: vi.fn() };
      const lifecycleEvents: FunnelEvent[] = [
        event,
        qualifiedApplicationEvent,
        bookingEvent,
        rescheduledEvent,
        cancelledEvent,
      ].map((lifecycleEvent) => ({
        ...lifecycleEvent,
        payload: { ...lifecycleEvent.payload, email },
        environment: "production",
      })) as FunnelEvent[];

      for (const internalEvent of lifecycleEvents) {
        await expect(
          processFunnelEvent(internalEvent, {
            ...externalDestinations,
            log,
          }),
        ).resolves.toEqual({ ok: true, skipped: "internal_test_lead" });
        expect(log.info).toHaveBeenLastCalledWith(
          "Skipped internal test lead",
          {
            submissionId: internalEvent.submissionId,
            eventId: internalEvent.eventId,
            eventType: internalEvent.eventType,
            environment: "production",
          },
        );
      }

      for (const destination of Object.values(externalDestinations)) {
        expect(destination).not.toHaveBeenCalled();
      }
    },
  );

  it("requires an exact submission and attendee for internal canary processing", () => {
    expect(
      parseInternalCanaryConfiguration({
        PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS:
          "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
        GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL:
          "SANTI@PULPSENSE.COM",
      }),
    ).toEqual({
      submissionIds: new Set([
        "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
      ]),
      attendeeEmail: "santi@pulpsense.com",
    });
    expect(
      parseInternalCanaryConfiguration({
        PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS:
          "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
      }),
    ).toBeUndefined();
  });

  it("creates canonical internal canary state without emitting commercial measurement", async () => {
    const canary = {
      submissionIds: new Set([bookingEvent.submissionId]),
      attendeeEmail: "santi@pulpsense.com",
    };
    const internalContact = {
      ...event,
      payload: { ...event.payload, email: canary.attendeeEmail },
      environment: "production",
    } as ContactSubmittedEvent;
    const internalApplication = {
      ...qualifiedApplicationEvent,
      payload: {
        ...qualifiedApplicationEvent.payload,
        email: canary.attendeeEmail,
      },
      environment: "production",
    } as ApplicationSubmittedEvent;
    const internalBooking = {
      ...bookingEvent,
      payload: { ...bookingEvent.payload, email: canary.attendeeEmail },
      environment: "production",
    } as BookingCompletedEvent;
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_canary" });
    const recordTwentyApplication = vi.fn().mockResolvedValue({
      activityId: internalApplication.submissionId,
      opportunityId: "opportunity_canary",
    });
    const recordTwentyBooking = vi.fn().mockResolvedValue({
      salesAppointmentId: "appointment_canary",
      opportunityId: "opportunity_canary",
    });
    const sendMetaLead = vi.fn();
    const sendMetaApplication = vi.fn();
    const sendMetaSchedule = vi.fn();
    const postSlackLead = vi.fn();
    const postSlackBooking = vi.fn();
    const capturePostHogLifecycle = vi.fn();
    const capturePostHogPersonLink = vi.fn();
    const scheduleMeetingReminders = vi.fn().mockResolvedValue({});
    const schedulePrecallSequence = vi.fn().mockResolvedValue({});
    const publishBrevoLifecycle = vi.fn().mockResolvedValue({});
    const dependencies = {
      internalCanary: canary,
      upsertTwentyPerson,
      recordTwentyApplication,
      recordTwentyBooking,
      sendMetaLead,
      sendMetaApplication,
      sendMetaSchedule,
      postSlackLead,
      postSlackBooking,
      capturePostHogLifecycle,
      capturePostHogPersonLink,
      scheduleMeetingReminders,
      schedulePrecallSequence,
      publishBrevoLifecycle,
      log: { info: vi.fn() },
    };

    await expect(processFunnelEvent(internalContact, dependencies)).resolves.toMatchObject({
      ok: true,
      internalCanary: true,
      personId: "person_canary",
    });
    await expect(
      processFunnelEvent(internalApplication, dependencies),
    ).resolves.toMatchObject({
      ok: true,
      internalCanary: true,
      opportunityId: "opportunity_canary",
    });
    await expect(processFunnelEvent(internalBooking, dependencies)).resolves.toMatchObject({
      ok: true,
      internalCanary: true,
      salesAppointmentId: "appointment_canary",
    });

    expect(recordTwentyApplication).toHaveBeenCalledWith(
      internalApplication,
      "person_canary",
      { internalCanary: true },
    );
    expect(recordTwentyBooking).toHaveBeenCalledWith(
      internalBooking,
      "person_canary",
      { internalCanary: true },
    );
    expect(scheduleMeetingReminders).toHaveBeenCalledWith(internalBooking, {
      channel: "gmail",
    });
    expect(schedulePrecallSequence).toHaveBeenCalledWith(internalBooking);
    expect(publishBrevoLifecycle).toHaveBeenCalledWith(internalBooking);
    for (const destination of [
      sendMetaLead,
      sendMetaApplication,
      sendMetaSchedule,
      postSlackLead,
      postSlackBooking,
      capturePostHogLifecycle,
      capturePostHogPersonLink,
    ]) {
      expect(destination).not.toHaveBeenCalled();
    }
  });

  it("links to the canonical Trigger dashboard run page", () => {
    expect(triggerRunUrl("prod", "run_123")).toBe(
      "https://cloud.trigger.dev/orgs/pulpsense-55f9/projects/internal-automations--Y9w/env/prod/runs/run_123",
    );
  });

  it("formats compact, scannable Slack failure alerts", () => {
    expect(
      formatBrevoFailureAlert(
        bookingEvent,
        "https://cloud.trigger.dev/runs/run_123",
      ),
    ).toBe(
      [
        ":rotating_light: *Brevo lifecycle sync failed* — preview",
        "Journey: `b0a10d9a-68bb-4d73-95c3-3e03560f8550` · Booking: `cal_booking_123`",
        "<https://cloud.trigger.dev/runs/run_123|Open in Trigger>",
      ].join("\n"),
    );
    expect(
      formatTwentyFailureAlert(
        {
          submissionId: event.submissionId,
          eventId: event.eventId,
          eventType: event.eventType,
          funnelId: event.funnelId,
          environment: event.environment,
          operation: "upsert_person",
        },
        "https://cloud.trigger.dev/runs/run_123",
      ),
    ).toContain(":rotating_light: *Twenty CRM sync failed* — preview");
  });

  it("rejects startup without the required Twenty failure alert destination", () => {
    expect(() =>
      createProcessorDependencies(
        {
          TWENTY_API_KEY: "twenty-sandbox-key",
          TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
          META_PIXEL_ID: "pixel_123",
          META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
          META_GRAPH_API_VERSION: "v26.0",
          PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
        },
        { fetch, log: { info: vi.fn() } },
      ),
    ).toThrow("SLACK_FAILURE_WEBHOOK_URL is not configured");
  });

  it("retries Meta independently without re-running successful Twenty effects", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const sendMetaLead = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary Meta outage"))
      .mockResolvedValueOnce({ eventsReceived: 1 });

    const result = await processFunnelEvent(event, {
      upsertTwentyPerson,
      sendMetaLead,
      executeAdapter: retryImmediately(3),
      log: { info: vi.fn() },
    });

    expect(result).toMatchObject({ ok: true, personId: "person_123" });
    expect(upsertTwentyPerson).toHaveBeenCalledOnce();
    expect(sendMetaLead).toHaveBeenCalledTimes(2);
  });

  it("attempts Slack even when the independent Twenty path fails", async () => {
    const postSlackLead = vi.fn().mockResolvedValue({ threadTs: "100.200" });
    const upsertTwentyPerson = vi
      .fn()
      .mockRejectedValue(new Error("Twenty unavailable"));

    await expect(
      processFunnelEvent(event, {
        upsertTwentyPerson,
        sendMetaLead: vi.fn(),
        postSlackLead,
        log: { info: vi.fn() },
      }),
    ).rejects.toThrow("Twenty unavailable");
    expect(postSlackLead).toHaveBeenCalledOnce();
  });

  it("re-anchors Brevo and reminder schedules without repeating booking sales effects", async () => {
    const publishBrevoLifecycle = vi
      .fn()
      .mockResolvedValue({ published: true });
    const scheduleMeetingReminders = vi
      .fn()
      .mockResolvedValue({ scheduled: ["24h", "2h", "15m"] });
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const projectSalesAppointment = vi.fn().mockResolvedValue({
      salesAppointmentId: "appointment_123",
      bookingVersionId: "version_456",
      outcome: "rescheduled",
    });
    const refreshGoogleRescheduleLink = vi.fn().mockResolvedValue({
      id: "link-refresh-run",
    });

    await expect(
      processFunnelEvent(rescheduledEvent, {
        upsertTwentyPerson,
        sendMetaLead: vi.fn(),
        publishBrevoLifecycle,
        scheduleMeetingReminders,
        projectSalesAppointment,
        refreshGoogleRescheduleLink,
        log: { info: vi.fn() },
      }),
    ).resolves.toEqual({ ok: true, bookingUid: "cal_booking_456" });
    expect(publishBrevoLifecycle).toHaveBeenCalledWith(rescheduledEvent);
    expect(scheduleMeetingReminders).toHaveBeenCalledWith(rescheduledEvent, {
      channel: "gmail",
    });
    expect(scheduleMeetingReminders).toHaveBeenCalledWith(rescheduledEvent, {
      channel: "sms",
      personId: "person_123",
    });
    expect(upsertTwentyPerson).toHaveBeenCalledWith(rescheduledEvent);
    expect(projectSalesAppointment).toHaveBeenCalledWith(rescheduledEvent);
    expect(refreshGoogleRescheduleLink).toHaveBeenCalledWith(rescheduledEvent);
  });

  it("projects a verified cancellation before completing lifecycle handling", async () => {
    const projectSalesAppointment = vi.fn().mockResolvedValue({
      salesAppointmentId: "appointment_123",
      bookingVersionId: "version_123",
      outcome: "cancelled",
    });
    await expect(
      processFunnelEvent(cancelledEvent, {
        upsertTwentyPerson: vi.fn(),
        sendMetaLead: vi.fn(),
        projectSalesAppointment,
        log: { info: vi.fn() },
      }),
    ).resolves.toEqual({ ok: true, bookingUid: "cal_booking_123" });
    expect(projectSalesAppointment).toHaveBeenCalledWith(cancelledEvent);
  });

  it("retries a delayed booking prerequisite without repeating Person upsert", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const recordTwentyBooking = vi
      .fn()
      .mockRejectedValueOnce(new Error("Opportunity is not available yet"))
      .mockResolvedValueOnce({
        salesAppointmentId: "booking_activity_123",
        opportunityId: "opportunity_123",
      });
    const sendMetaSchedule = vi.fn().mockResolvedValue({ eventsReceived: 1 });

    const result = await processFunnelEvent(bookingEvent, {
      upsertTwentyPerson,
      recordTwentyBooking,
      sendMetaSchedule,
      sendMetaLead: vi.fn(),
      executeAdapter: retryImmediately(3),
      log: { info: vi.fn() },
    });

    expect(result).toMatchObject({
      salesAppointmentId: "booking_activity_123",
      opportunityId: "opportunity_123",
    });
    expect(upsertTwentyPerson).toHaveBeenCalledOnce();
    expect(recordTwentyBooking).toHaveBeenCalledTimes(2);
    expect(sendMetaSchedule).toHaveBeenCalledOnce();
  });

  it("schedules reminders after Person upsert even when Meta delivery fails", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const recordTwentyBooking = vi.fn().mockResolvedValue({
      salesAppointmentId: "booking_activity_123",
      opportunityId: "opportunity_123",
    });
    const sendMetaSchedule = vi
      .fn()
      .mockRejectedValue(new Error("Meta unavailable"));
    const scheduleMeetingReminders = vi
      .fn()
      .mockResolvedValue({ scheduled: [] });

    await expect(
      processFunnelEvent(bookingEvent, {
        upsertTwentyPerson,
        recordTwentyBooking,
        sendMetaSchedule,
        scheduleMeetingReminders,
        sendMetaLead: vi.fn(),
        executeAdapter: retryImmediately(1),
        log: { info: vi.fn() },
      }),
    ).rejects.toThrow("Meta unavailable");

    expect(scheduleMeetingReminders).toHaveBeenCalledWith(bookingEvent, {
      channel: "gmail",
    });
    expect(scheduleMeetingReminders).toHaveBeenCalledWith(bookingEvent, {
      channel: "sms",
      personId: "person_123",
    });
  });

  it.each([bookingEvent, rescheduledEvent])(
    "still schedules Gmail reminders when Twenty Person upsert fails for $eventType",
    async (failedEvent) => {
      const scheduleMeetingReminders = vi
        .fn()
        .mockResolvedValue({ scheduled: [] });

      await expect(
        processFunnelEvent(failedEvent, {
          upsertTwentyPerson: vi
            .fn()
            .mockRejectedValue(new Error("Twenty unavailable")),
          recordTwentyBooking: vi.fn(),
          sendMetaSchedule: vi.fn(),
          sendMetaLead: vi.fn(),
          scheduleMeetingReminders,
          executeAdapter: retryImmediately(1),
          log: { info: vi.fn() },
        }),
      ).rejects.toThrow("Twenty unavailable");

      expect(scheduleMeetingReminders).toHaveBeenCalledWith(failedEvent, {
        channel: "gmail",
      });
      expect(scheduleMeetingReminders).not.toHaveBeenCalledWith(
        failedEvent,
        expect.objectContaining({ channel: "sms" }),
      );
    },
  );

  it("alerts Slack with redacted run identifiers after Twenty retry exhaustion", async () => {
    const slackBodies: Array<Record<string, unknown>> = [];
    let slackAttempts = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://hooks.slack.test/twenty-failures") {
        slackAttempts += 1;
        if (slackAttempts === 1) {
          return new Response("temporary Slack outage", { status: 503 });
        }
        slackBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 200 });
      }
      return new Response("temporary Twenty outage", { status: 503 });
    });
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      {
        fetch: fetchMock,
        log: { info: vi.fn() },
        executeAdapter: retryImmediately(3),
        run: {
          id: "run_01recovery",
          url: "https://cloud.trigger.dev/projects/v3/proj_test/runs/run_01recovery",
        },
      },
    );

    await expect(processFunnelEvent(event, dependencies)).rejects.toThrow(
      "Twenty person lookup failed",
    );

    expect(slackBodies).toHaveLength(1);
    expect(slackAttempts).toBe(2);
    const alert = JSON.stringify(slackBodies[0]);
    expect(alert).toContain("Upsert person");
    expect(alert).toContain(event.submissionId);
    expect(alert).not.toContain(event.eventId);
    expect(alert).toContain("run_01recovery");
    expect(alert).toContain("preview");
    expect(alert).not.toContain(event.payload.email);
    expect(alert).not.toContain(event.payload.phone);
    expect(alert).not.toContain(event.payload.firstName);
  });

  it("replays contact delivery without duplicating the Person or Meta identity", async () => {
    let personId: string | undefined;
    let personCreates = 0;
    const personWrites: Array<Record<string, unknown>> = [];
    const metaEventIds: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://twenty.sandbox.example/graphql") {
        return Response.json({
          data: {
            people: {
              edges: personId ? [{ node: { id: personId } }] : [],
            },
          },
        });
      }
      if (url === "https://twenty.sandbox.example/rest/people") {
        personCreates += 1;
        personWrites.push(JSON.parse(String(init?.body)));
        personId = "person_replay_safe";
        return Response.json({ data: { createPerson: { id: personId } } });
      }
      if (url.endsWith("/rest/people/person_replay_safe")) {
        personWrites.push(JSON.parse(String(init?.body)));
        return Response.json({ data: { updatePerson: { id: personId } } });
      }
      if (url.includes("graph.facebook.com")) {
        const body = JSON.parse(String(init?.body)) as {
          data: Array<{ event_id: string }>;
        };
        metaEventIds.push(body.data[0]!.event_id);
        return Response.json({ events_received: 1 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const first = await processFunnelEvent(event, dependencies);
    const replay = await processFunnelEvent(event, dependencies);

    expect(first).toMatchObject({ personId: "person_replay_safe" });
    expect(replay).toMatchObject({ personId: "person_replay_safe" });
    expect(personCreates).toBe(1);
    expect(personWrites[0]).toMatchObject(expectedTwentyAttribution);
    expect(personWrites[1]).toMatchObject(expectedTwentyLastTouchAttribution);
    expectNoTwentyFirstTouch(personWrites[1]);
    expect(metaEventIds).toEqual([event.eventId, event.eventId]);
  });

  it("replays an application after Meta recovery without duplicating Twenty records", async () => {
    let personId: string | undefined;
    let activityId: string | undefined;
    let opportunityId: string | undefined;
    let personCreates = 0;
    let activityCreates = 0;
    let opportunityCreates = 0;
    const upsertTwentyPerson = vi.fn(async () => {
      if (!personId) {
        personCreates += 1;
        personId = "person_recovered";
      }
      return { personId };
    });
    const recordTwentyApplication = vi.fn(async () => {
      if (!activityId) {
        activityCreates += 1;
        activityId = qualifiedApplicationEvent.submissionId;
      }
      if (!opportunityId) {
        opportunityCreates += 1;
        opportunityId = "opportunity_recovered";
      }
      return { activityId, opportunityId };
    });
    const metaEventIds: string[] = [];
    const sendMetaApplication = vi.fn(async (deliveredEvent) => {
      metaEventIds.push(deliveredEvent.eventId);
      if (metaEventIds.length === 1) {
        throw new Error("Meta unavailable");
      }
      return { eventsReceived: 1 };
    });
    const dependencies = {
      upsertTwentyPerson,
      recordTwentyApplication,
      sendMetaApplication,
      sendMetaLead: vi.fn(),
      executeAdapter: retryImmediately(1),
      log: { info: vi.fn() },
    };

    await expect(
      processFunnelEvent(qualifiedApplicationEvent, dependencies),
    ).rejects.toThrow("Meta unavailable");
    const recovered = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(recovered).toMatchObject({
      personId: "person_recovered",
      activityId: qualifiedApplicationEvent.submissionId,
      opportunityId: "opportunity_recovered",
      metaEventId: qualifiedApplicationEvent.eventId,
    });
    expect(upsertTwentyPerson).toHaveBeenCalledTimes(2);
    expect(recordTwentyApplication).toHaveBeenCalledTimes(2);
    expect(personCreates).toBe(1);
    expect(activityCreates).toBe(1);
    expect(opportunityCreates).toBe(1);
    expect(metaEventIds).toEqual([
      qualifiedApplicationEvent.eventId,
      qualifiedApplicationEvent.eventId,
    ]);
  });

  it("advances the matching Opportunity and emits Schedule for a verified booking", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const recordTwentyBooking = vi.fn().mockResolvedValue({
      salesAppointmentId: bookingEvent.payload.booking.uid,
      opportunityId: "opportunity_123",
    });
    const sendMetaSchedule = vi.fn().mockResolvedValue({ eventsReceived: 1 });
    const scheduleMeetingReminders = vi
      .fn()
      .mockResolvedValue({ scheduled: [] });

    const result = await processFunnelEvent(bookingEvent, {
      upsertTwentyPerson,
      recordTwentyBooking,
      sendMetaSchedule,
      scheduleMeetingReminders,
      sendMetaLead: vi.fn(),
      log: { info: vi.fn() },
    });

    expect(result).toEqual({
      ok: true,
      personId: "person_123",
      salesAppointmentId: "cal_booking_123",
      opportunityId: "opportunity_123",
      metaEventId: "booking_completed:cal_booking_123",
    });
    expect(recordTwentyBooking).toHaveBeenCalledWith(
      bookingEvent,
      "person_123",
    );
    expect(sendMetaSchedule).toHaveBeenCalledWith(bookingEvent);
    expect(scheduleMeetingReminders).toHaveBeenCalledWith(bookingEvent, {
      channel: "gmail",
    });
    expect(scheduleMeetingReminders).toHaveBeenCalledWith(bookingEvent, {
      channel: "sms",
      personId: "person_123",
    });
  });

  it("writes a stable booking activity, advances Call Booked, and sends the matching CAPI event", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({ data: { bookingVersions: { edges: [] } } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [
                {
                  node: {
                    id: "opportunity_qualified",
                    stage: "QUALIFIED_AWAITING_BOOKING",
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            salesAppointment: {
              id: "1c8466e7-f7dc-52c9-9f83-a8246ef6eeef",
              rootCalBookingUid: "cal_booking_123",
              currentCalBookingUid: "cal_booking_123",
              originatingLeadJourneyId: bookingEvent.submissionId,
              initialConfirmedAt: bookingEvent.occurredAt,
              scheduledStartAt: bookingEvent.payload.booking.startTime,
              scheduledEndAt: bookingEvent.payload.booking.endTime,
              status: "SCHEDULED",
              opportunityId: "opportunity_qualified",
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunity: {
              id: "opportunity_qualified",
              stage: "QUALIFIED_AWAITING_BOOKING",
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        TWENTY_CALL_BOOKED_STAGE_VALUE: "CALL_BOOKED",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_TEST_EVENT_CODE: "LAWYER_TEST",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(bookingEvent, dependencies);

    expect(result).toMatchObject({
      salesAppointmentId: "1c8466e7-f7dc-52c9-9f83-a8246ef6eeef",
      opportunityId: "opportunity_qualified",
      metaEventId: bookingEvent.eventId,
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      smsConsentStatus: "OPTED_IN",
      smsConsentSource: "PULPSENSE_ADS_FUNNEL_BOOKING",
      smsConsentUpdatedAt: bookingEvent.occurredAt,
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body)),
    ).toMatchObject({
      id: "1c8466e7-f7dc-52c9-9f83-a8246ef6eeef",
      rootCalBookingUid: "cal_booking_123",
      currentCalBookingUid: "cal_booking_123",
      initialConfirmedAt: bookingEvent.occurredAt,
      classification: "NON_PRODUCTION",
      isCommercial: true,
      isTest: true,
      personId: "person_existing",
      opportunityId: "opportunity_qualified",
    });
    expect(String(fetchMock.mock.calls[5]?.[0])).toContain(
      "/rest/salesAppointments",
    );
    expect(fetchMock.mock.calls[5]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(fetchMock.mock.calls[11]?.[1]?.body))).toEqual({
      id: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      title: "Booking cal_booking_123",
      bodyV2: {
        markdown: expect.stringContaining("AI SEO Fit Call"),
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[12]?.[1]?.body))).toEqual({
      id: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      noteId: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      targetPersonId: "person_existing",
    });
    expect(fetchMock.mock.calls[10]?.[1]?.method).toBe("PATCH");
    expect(String(fetchMock.mock.calls[10]?.[0])).toContain(
      "/rest/opportunities/opportunity_qualified",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[10]?.[1]?.body))).toEqual({
      stage: "CALL_BOOKED",
    });
    const metaBody = JSON.parse(String(fetchMock.mock.calls[13]?.[1]?.body));
    expect(metaBody.data).toEqual([
      expect.objectContaining({
        event_name: "Schedule",
        event_id: bookingEvent.eventId,
        user_data: expect.objectContaining({
          external_id: [
            "eeda5bcf31640b053335aec80fb29f5781240b79107f3cb7cbf31d35ad87d6d5",
          ],
          fn: [
            "a95db5b0ac159e4384ff55ef91c94a98dc563d66a88e7b027fcd5190c0f5bed5",
          ],
          ln: [
            "3abd72ec6352d6085d85e34f0478dca7d14ef8048f3c1986e28106d654713946",
          ],
        }),
      }),
    ]);
    expect(metaBody.test_event_code).toBe("LAWYER_TEST");
  });

  it("finishes Opportunity advancement from a durably stored appointment on retry", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            bookingVersions: {
              edges: [
                {
                  node: {
                    id: "c6a2e6b6-8131-52cd-ae7e-afc1a243e2bd",
                    calBookingUid: "cal_booking_123",
                    salesAppointmentId: "1c8466e7-f7dc-52c9-9f83-a8246ef6eeef",
                    state: "ACTIVE",
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            salesAppointment: {
              id: "1c8466e7-f7dc-52c9-9f83-a8246ef6eeef",
              rootCalBookingUid: "cal_booking_123",
              currentCalBookingUid: "cal_booking_123",
              currentBookingVersionId: "c6a2e6b6-8131-52cd-ae7e-afc1a243e2bd",
              originatingLeadJourneyId: bookingEvent.submissionId,
              initialConfirmedAt: bookingEvent.occurredAt,
              scheduledStartAt: bookingEvent.payload.booking.startTime,
              scheduledEndAt: bookingEvent.payload.booking.endTime,
              status: "SCHEDULED",
              opportunityId: "opportunity_original",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunity: {
              id: "opportunity_original",
              stage: "QUALIFIED_AWAITING_BOOKING",
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        TWENTY_CALL_BOOKED_STAGE_VALUE: "CALL_BOOKED",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(bookingEvent, dependencies);

    expect(result).toMatchObject({
      salesAppointmentId: "1c8466e7-f7dc-52c9-9f83-a8246ef6eeef",
      opportunityId: "opportunity_original",
      metaEventId: bookingEvent.eventId,
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[6]?.[1]?.body)),
    ).toMatchObject({ id: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80" });
    expect(JSON.parse(String(fetchMock.mock.calls[8]?.[1]?.body)).data).toEqual(
      [expect.objectContaining({ event_id: bookingEvent.eventId })],
    );
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[1]?.body).includes("opportunities("),
      ),
    ).toBe(false);
    expect(String(fetchMock.mock.calls[5]?.[0])).toContain(
      "/rest/opportunities/opportunity_original",
    );
    expect(fetchMock.mock.calls[5]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body))).toEqual({
      stage: "CALL_BOOKED",
    });
  });

  it("accepts an application before contact by upserting its Person prerequisite", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const recordTwentyApplication = vi.fn().mockResolvedValue({
      activityId: applicationEvent.submissionId,
    });
    const sendMetaApplication = vi
      .fn()
      .mockResolvedValue({ eventsReceived: 1 });

    const result = await processFunnelEvent(applicationEvent, {
      upsertTwentyPerson,
      recordTwentyApplication,
      sendMetaApplication,
      sendMetaLead: vi.fn(),
      log: { info: vi.fn() },
    });

    expect(result).toEqual({
      ok: true,
      personId: "person_123",
      activityId: applicationEvent.submissionId,
      metaEventId: applicationEvent.eventId,
    });
    expect(recordTwentyApplication).toHaveBeenCalledWith(
      applicationEvent,
      "person_123",
    );
    expect(sendMetaApplication).toHaveBeenCalledOnce();
    expect(sendMetaApplication).toHaveBeenCalledWith(applicationEvent);
  });

  it("persists an unqualified application without creating an Opportunity", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_existing" } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            companies: { edges: [{ node: { id: "company_brand" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createNote: { id: applicationEvent.submissionId } },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createNoteTarget: { id: applicationEvent.submissionId } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(applicationEvent, dependencies);

    expect(result).toMatchObject({
      activityId: applicationEvent.submissionId,
      personId: "person_existing",
    });
    expect(result).not.toHaveProperty("opportunityId");
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const requests = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));
    expect(requests).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining("opportunities"),
        }),
      ]),
    );
    expect(requests).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining("/rest/companies"),
          method: "POST",
        }),
      ]),
    );
    expect(requests[2]?.body).toMatchObject({
      variables: { domainUrl: "https://brand.com" },
    });
    expect(requests[1]?.body).toMatchObject(expectedTwentyLastTouchAttribution);
    expectNoTwentyFirstTouch(requests[1]?.body);
    expect(requests[3]?.body).toMatchObject({
      id: applicationEvent.submissionId,
      title: `Application ${applicationEvent.submissionId}`,
      bodyV2: {
        markdown: expect.stringContaining(
          '"marketingBudget": "Under $500/month or not set yet"',
        ),
      },
    });
    expect(requests[4]?.body).toEqual({
      id: applicationEvent.submissionId,
      noteId: applicationEvent.submissionId,
      targetPersonId: "person_existing",
    });
    expect(requests[5]?.body.data).toEqual([
      expect.objectContaining({
        event_name: "SubmitApplication",
        event_id: applicationEvent.eventId,
        custom_data: { qualification_status: "unqualified" },
      }),
    ]);
    expect(JSON.stringify(requests[5]?.body)).not.toContain(
      "Under $500/month or not set yet",
    );
  });

  it("creates an awaiting-booking Opportunity for a qualified application", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_existing" } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            companies: { edges: [{ node: { id: "company_brand" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: { createNote: {} } }))
      .mockResolvedValueOnce(Response.json({ data: { createNoteTarget: {} } }))
      .mockResolvedValueOnce(
        Response.json({ data: { opportunities: { edges: [] } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createOpportunity: { id: "opportunity_new" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(result).toMatchObject({ opportunityId: "opportunity_new" });
    const opportunityLookup = JSON.parse(
      String(fetchMock.mock.calls[5]?.[1]?.body),
    );
    expect(opportunityLookup).toMatchObject({
      variables: { personId: "person_existing" },
    });
    const [createUrl, createInit] = fetchMock.mock.calls[6]!;
    expect(String(createUrl)).toBe(
      "https://twenty.sandbox.example/rest/opportunities",
    );
    expect(createInit?.method).toBe("POST");
    expect(JSON.parse(String(createInit?.body))).toEqual({
      id: "400953f0-8304-58d1-a36e-afe0e2282e9d",
      name: "AI SEO – brand.com",
      stage: "QUALIFIED_AWAITING_BOOKING",
      originatingLeadJourneyId: qualifiedApplicationEvent.submissionId,
      pointOfContactId: "person_existing",
      companyId: "company_brand",
      ...expectedTwentyAttribution,
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[6]?.[1]?.body)),
    ).toMatchObject({ id: "400953f0-8304-58d1-a36e-afe0e2282e9d" });
  });

  it("creates a dedicated test Opportunity for an allowlisted internal canary", async () => {
    const internalApplication = {
      ...qualifiedApplicationEvent,
      companyDomain: "pulpsense.com",
      payload: {
        ...qualifiedApplicationEvent.payload,
        email: "santi@pulpsense.com",
      },
      environment: "production",
    } as ApplicationSubmittedEvent;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_canary" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_canary" } } }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { companies: { edges: [] } } }),
      )
      .mockResolvedValueOnce(Response.json({ data: { createNote: {} } }))
      .mockResolvedValueOnce(Response.json({ data: { createNoteTarget: {} } }))
      .mockResolvedValueOnce(
        Response.json({
          data: { createOpportunity: { id: "opportunity_canary" } },
        }),
      );
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "production",
        PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS:
          internalApplication.submissionId,
        GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL:
          internalApplication.payload.email,
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    await expect(
      processFunnelEvent(internalApplication, dependencies),
    ).resolves.toMatchObject({
      internalCanary: true,
      opportunityId: "opportunity_canary",
    });

    const opportunityCreate = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/rest/opportunities"),
    );
    expect(opportunityCreate).toBeDefined();
    expect(JSON.parse(String(opportunityCreate?.[1]?.body))).toMatchObject({
      id: "400953f0-8304-58d1-a36e-afe0e2282e9d",
      isTest: true,
      pointOfContactId: "person_canary",
      originatingLeadJourneyId: internalApplication.submissionId,
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("graph.facebook.com"),
      ),
    ).toBe(false);
  });

  it("updates the existing open Opportunity for a repeat qualified application", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            companies: { edges: [{ node: { id: "company_brand" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { messages: ["A duplicate entry was detected"] },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { messages: ["A duplicate entry was detected"] },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [
                {
                  node: {
                    id: "opportunity_open",
                    stage: "CALL_BOOKED",
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(result).toMatchObject({ opportunityId: "opportunity_open" });
    const [updateUrl, updateInit] = fetchMock.mock.calls[6]!;
    expect(String(updateUrl)).toBe(
      "https://twenty.sandbox.example/rest/opportunities/opportunity_open",
    );
    expect(updateInit?.method).toBe("PATCH");
    expect(JSON.parse(String(updateInit?.body))).not.toHaveProperty("stage");
  });

  it("creates a new Opportunity when all prior Opportunities are closed", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({ data: { companies: { edges: [] } } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [{ node: { id: "opportunity_won", stage: "WON" } }],
              pageInfo: { hasNextPage: true, endCursor: "page_2" },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [{ node: { id: "opportunity_lost", stage: "LOST" } }],
              pageInfo: { hasNextPage: false },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createOpportunity: { id: "opportunity_new_attempt" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        TWENTY_CLOSED_STAGE_VALUES: "WON,LOST",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(result).toMatchObject({
      opportunityId: "opportunity_new_attempt",
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[6]?.[1]?.body)),
    ).toMatchObject({ variables: { after: "page_2" } });
    expect(fetchMock.mock.calls[7]?.[1]?.method).toBe("POST");
  });

  it("upserts one Twenty person and sends the matching Meta Lead event", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const sendMetaLead = vi.fn().mockResolvedValue({ eventsReceived: 1 });
    const log = { info: vi.fn() };

    const result = await processFunnelEvent(event, {
      upsertTwentyPerson,
      sendMetaLead,
      log,
    });

    expect(result).toEqual({
      ok: true,
      personId: "person_123",
      metaEventId: event.eventId,
    });
    expect(upsertTwentyPerson).toHaveBeenCalledOnce();
    expect(upsertTwentyPerson).toHaveBeenCalledWith(event);
    expect(sendMetaLead).toHaveBeenCalledOnce();
    expect(sendMetaLead).toHaveBeenCalledWith(event);

    const routineLogs = JSON.stringify(log.info.mock.calls);
    expect(routineLogs).toContain(event.submissionId);
    expect(routineLogs).not.toContain(event.payload.email);
    expect(routineLogs).not.toContain(event.payload.phone);
    expect(routineLogs).not.toContain(event.payload.firstName);
  });

  it("updates the existing Twenty person without retaining stale last-touch attribution", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_existing" } } }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const log = { info: vi.fn() };
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log },
    );

    await processFunnelEvent(directContactEvent, dependencies);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [findUrl, findInit] = fetchMock.mock.calls[0]!;
    expect(String(findUrl)).toBe("https://twenty.sandbox.example/graphql");
    expect(JSON.parse(String(findInit?.body))).toMatchObject({
      variables: { email: "maya@brand.com" },
    });

    const [updateUrl, updateInit] = fetchMock.mock.calls[1]!;
    expect(String(updateUrl)).toBe(
      "https://twenty.sandbox.example/rest/people/person_existing",
    );
    expect(updateInit?.method).toBe("PATCH");
    const updateBody = JSON.parse(String(updateInit?.body));
    expect(updateBody).toMatchObject({
      name: { firstName: "Maya", lastName: "Chen" },
      emails: { primaryEmail: "maya@brand.com" },
      prospectId: event.prospectId,
      ...expectedTwentyDirectLastTouchAttribution,
    });
    expect(updateBody).not.toHaveProperty("smsConsentStatus");
    expect(updateBody).not.toHaveProperty("smsConsentSource");
    expect(updateBody).not.toHaveProperty("smsConsentUpdatedAt");
    expectNoTwentyFirstTouch(updateBody);

    const [metaUrl, metaInit] = fetchMock.mock.calls[2]!;
    expect(String(metaUrl)).toContain("/v26.0/pixel_123/events");
    const metaBody = JSON.parse(String(metaInit?.body)) as {
      data: Array<{ event_name: string; event_id: string }>;
    };
    expect(metaBody.data).toEqual([
      expect.objectContaining({
        event_name: "Lead",
        event_id: event.eventId,
      }),
    ]);
  });

  it("recovers from a concurrent Twenty create without creating a duplicate person", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: { people: { edges: [] } } }))
      .mockResolvedValueOnce(new Response("conflict", { status: 409 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_concurrent" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { updatePerson: { id: "person_concurrent" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(event, dependencies);

    expect(result).toMatchObject({ personId: "person_concurrent" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe("PATCH");
  });

  it("recovers from Twenty's 400 duplicate-entry response without failing the event", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: { people: { edges: [] } } }))
      .mockResolvedValueOnce(
        Response.json(
          { messages: ["A duplicate entry was detected"] },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ data: { people: { edges: [] } } }))
      .mockResolvedValueOnce(
        Response.json({
          data: { people: { edges: [{ node: { id: "person_deleted" } }] } },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { restorePerson: { id: "person_deleted" } } }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_deleted" } } }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        SLACK_FAILURE_WEBHOOK_URL: "https://hooks.slack.test/twenty-failures",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(event, dependencies);

    expect(result).toMatchObject({ personId: "person_deleted" });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[5]?.[1]?.method).toBe("PATCH");
  });
});
