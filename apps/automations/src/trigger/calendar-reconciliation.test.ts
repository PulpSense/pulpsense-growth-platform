import { describe, expect, it, vi } from "vitest";

import {
  type CalBooking,
  type CalendarReconciliationAdapters,
  type GoogleCalendarEvent,
  googleRevision,
  reconcileSalesAppointment,
  selectEligibleSalesAppointments,
} from "./calendar-reconciliation.js";
import type { SalesAppointmentRecord } from "./sales-appointment-ledger.js";

const appointmentId = "8e864291-38b5-4fb6-8f25-664c6db9dc61";
const oldStart = "2026-09-10T15:00:00.000Z";
const intendedStart = "2026-09-11T16:00:00.000Z";

const appointment = (
  patch: Partial<SalesAppointmentRecord> = {},
): SalesAppointmentRecord => ({
  id: appointmentId,
  name: "Sales call",
  rootCalBookingUid: "cal-old",
  currentCalBookingUid: "cal-old",
  currentBookingVersionId: "version-old",
  originatingLeadJourneyId: "f18cd350-48e6-4f8b-8ed0-dfd804cd47c5",
  initialConfirmedAt: "2026-08-20T12:00:00.000Z",
  scheduledStartAt: oldStart,
  scheduledEndAt: "2026-09-10T15:25:00.000Z",
  status: "SCHEDULED",
  funnelId: "ai-seo-med-spas",
  environment: "production",
  personId: "229999e1-f189-4e0a-a512-87c1be1c2ae9",
  opportunityId: "8509935c-e0f5-4508-9527-26cba48cab12",
  googleCalendarId: "primary",
  googleEventId: "google-event",
  synchronizationStatus: "SYNCHRONIZED",
  automationGeneration: 3,
  ...patch,
});

const googleEvent = (
  patch: Partial<GoogleCalendarEvent> = {},
): GoogleCalendarEvent => ({
  id: "google-event",
  iCalUID: "ical-lineage",
  etag: '"etag-2"',
  sequence: 2,
  status: "confirmed",
  start: intendedStart,
  ...patch,
});

const calBooking = (patch: Partial<CalBooking> = {}): CalBooking => ({
  uid: "cal-old",
  title: "Sales call",
  status: "accepted",
  start: oldStart,
  end: "2026-09-10T15:25:00.000Z",
  hosts: [{ email: "host@pulpsense.com" }],
  attendees: [
    {
      name: "Ada Prospect",
      email: "ada@example.com",
      phoneNumber: "+15555550123",
      timeZone: "America/New_York",
    },
  ],
  ...patch,
});

const harness = (
  initialAppointment = appointment(),
  initialGoogle = googleEvent(),
) => {
  let stored = structuredClone(initialAppointment);
  let google = structuredClone(initialGoogle);
  let cal = calBooking();
  let replacement: CalBooking | undefined;
  const updates: Array<Partial<SalesAppointmentRecord>> = [];
  const adapters: CalendarReconciliationAdapters = {
    getSalesAppointment: vi.fn(async () => structuredClone(stored)),
    updateSalesAppointment: vi.fn(async (_id, patch) => {
      updates.push(patch);
      stored = { ...stored, ...patch };
    }),
    resolveGoogleMapping: vi.fn(async () => ({
      calendarId: "primary",
      eventId: "google-event",
    })),
    getGoogleEvent: vi.fn(async () => structuredClone(google)),
    getCalBooking: vi.fn(async (uid) => {
      if (replacement?.uid === uid) return structuredClone(replacement);
      return structuredClone(cal);
    }),
    getCalBookingReferences: vi.fn(async () => [
      {
        type: "google_calendar",
        eventUid: "google-event",
        destinationCalendarId: "primary",
      },
    ]),
    rescheduleCalBooking: vi.fn(async (input) => {
      replacement = calBooking({
        uid: "cal-new",
        start: input.start,
        end: "2026-09-11T16:25:00.000Z",
      });
      return structuredClone(replacement);
    }),
    waitForStability: vi.fn(async () => undefined),
    waitForRetry: vi.fn(async () => undefined),
    waitForCanonicalWebhook: vi.fn(async () => {
      if (!replacement) return;
      stored = {
        ...stored,
        currentCalBookingUid: replacement.uid,
        scheduledStartAt: replacement.start,
        scheduledEndAt: replacement.end,
        intendedStartAt: null,
        synchronizationStatus: "SYNCHRONIZED",
      };
    }),
    enqueueLifecycleRepair: vi.fn(async () => undefined),
    sendAlert: vi.fn(async () => ({ threadTs: "1700000000.0001" })),
    now: () => new Date("2026-09-01T12:00:00.000Z"),
  };
  return {
    adapters,
    updates,
    stored: () => stored,
    setStored: (value: SalesAppointmentRecord) => {
      stored = value;
    },
    setGoogle: (value: GoogleCalendarEvent) => {
      google = value;
    },
    setCal: (value: CalBooking) => {
      cal = value;
    },
  };
};

const options = {
  mode: "reconcile" as const,
  allowedBookingUids: new Set(["cal-old"]),
  hostEmail: "host@pulpsense.com",
  canaryOnly: true,
  canaryAttendeeEmail: "ada@example.com",
};

describe("Sales Appointment polling selection", () => {
  const now = new Date("2026-09-01T00:00:00.000Z");

  it("uses the current time when a manual schedule run omits its timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const selected = selectEligibleSalesAppointments(
        [appointment({ id: "inside", scheduledStartAt: now.toISOString() })],
        undefined as unknown as Date,
      );
      expect(selected.map(({ id }) => id)).toEqual(["inside"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("selects the seven-day lookback through 180-day horizon", () => {
    const selected = selectEligibleSalesAppointments(
      [
        appointment({ id: "inside", scheduledStartAt: "2026-08-25T00:00:00Z" }),
        appointment({ id: "future", scheduledStartAt: "2027-02-28T00:00:00Z" }),
        appointment({ id: "old", scheduledStartAt: "2026-08-24T23:59:59Z" }),
      ],
      now,
    );
    expect(selected.map(({ id }) => id)).toEqual(["inside", "future"]);
  });

  it("keeps unresolved records observable and excludes terminal lineages", () => {
    const selected = selectEligibleSalesAppointments(
      [
        appointment({
          id: "pending",
          scheduledStartAt: "2020-01-01T00:00:00Z",
          synchronizationStatus: "NEEDS_ATTENTION",
        }),
        appointment({ id: "cancelled", status: "CANCELLED" }),
        appointment({ id: "completed", status: "COMPLETED" }),
      ],
      now,
    );
    expect(selected.map(({ id }) => id)).toEqual(["pending"]);
  });
});

describe("reconcileSalesAppointment", () => {
  it("is disabled by default without reading provider state", async () => {
    const { adapters } = harness();
    await expect(
      reconcileSalesAppointment(
        appointmentId,
        { ...options, mode: "off" },
        adapters,
      ),
    ).resolves.toEqual({ outcome: "off" });
    expect(adapters.getSalesAppointment).not.toHaveBeenCalled();
  });

  it("does nothing when the direct Google event start already agrees", async () => {
    const { adapters, stored } = harness(
      appointment(),
      googleEvent({ start: oldStart }),
    );
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "unchanged" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
    expect(stored().synchronizationStatus).toBe("SYNCHRONIZED");
  });

  it("threads recovery when Google returns to the canonical time", async () => {
    const event = googleEvent({ start: oldStart });
    const revision = googleRevision(event);
    const { adapters } = harness(
      appointment({
        acceptedGoogleRevision: revision,
        reconciliationAlertRevision: `${revision}|provider_failure|exhausted`,
        reconciliationAlertThreadTs: "1700000000.0001",
      }),
      event,
    );
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "unchanged" });
    expect(adapters.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "recovered",
        recovered: true,
        threadTs: "1700000000.0001",
      }),
    );
  });

  it("records differences in observe mode without suppressing or mutating", async () => {
    const { adapters, stored } = harness();
    await expect(
      reconcileSalesAppointment(
        appointmentId,
        { ...options, mode: "observe" },
        adapters,
      ),
    ).resolves.toMatchObject({ outcome: "observed_difference" });
    expect(stored().automationGeneration).toBe(3);
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
  });

  it("requires the exact current Cal UID during canarying", async () => {
    const { adapters } = harness();
    await expect(
      reconcileSalesAppointment(
        appointmentId,
        { ...options, allowedBookingUids: new Set(["another-uid"]) },
        adapters,
      ),
    ).resolves.toMatchObject({ outcome: "canary_blocked" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
  });

  it("requires the configured internal attendee during canarying", async () => {
    const { adapters } = harness();
    await expect(
      reconcileSalesAppointment(
        appointmentId,
        { ...options, canaryAttendeeEmail: "internal@example.com" },
        adapters,
      ),
    ).resolves.toMatchObject({ outcome: "needs_attention" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
    expect(adapters.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "canary_attendee_assertion_failed",
      }),
    );
  });

  it("allows eligible appointments after canary restrictions are disabled", async () => {
    const { adapters } = harness();
    await expect(
      reconcileSalesAppointment(
        appointmentId,
        {
          ...options,
          canaryOnly: false,
          allowedBookingUids: new Set(),
          canaryAttendeeEmail: undefined,
        },
        adapters,
      ),
    ).resolves.toMatchObject({ outcome: "webhook_confirmed" });
    expect(adapters.rescheduleCalBooking).toHaveBeenCalledOnce();
  });

  it("suppresses the old generation then sends all host override controls", async () => {
    const { adapters, stored } = harness();
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "webhook_confirmed" });
    expect(adapters.rescheduleCalBooking).toHaveBeenCalledWith({
      bookingUid: "cal-old",
      start: intendedStart,
      rescheduledBy: "host@pulpsense.com",
      rescheduleWithSameHost: true,
      allowConflicts: true,
      allowBookingOutOfBounds: true,
      skipBookingLimits: true,
    });
    expect(stored()).toMatchObject({
      currentCalBookingUid: "cal-new",
      automationGeneration: 4,
      synchronizationStatus: "SYNCHRONIZED",
    });
    expect(adapters.enqueueLifecycleRepair).not.toHaveBeenCalled();
  });

  it("coalesces rapid Google changes through the stable revision reread", async () => {
    const { adapters, setGoogle, stored } = harness();
    vi.mocked(adapters.waitForStability).mockImplementation(async () => {
      setGoogle(
        googleEvent({
          etag: '"etag-3"',
          sequence: 3,
          start: "2026-09-12T17:00:00.000Z",
        }),
      );
    });
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "unstable" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
    expect(stored().automationGeneration).toBe(3);
  });

  it("rejects and alerts on a stable move into the past", async () => {
    const past = "2026-08-31T10:00:00.000Z";
    const { adapters, stored } = harness(
      appointment(),
      googleEvent({ start: past }),
    );
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "past_time_rejected" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
    expect(adapters.sendAlert).toHaveBeenCalledTimes(1);
    expect(stored()).toMatchObject({
      synchronizationStatus: "NEEDS_ATTENTION",
      intendedStartAt: past,
      automationGeneration: 4,
    });
  });

  it("never revives a cancelled Sales Appointment", async () => {
    const { adapters } = harness(appointment({ status: "CANCELLED" }));
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toEqual({ outcome: "ineligible" });
    expect(adapters.getGoogleEvent).not.toHaveBeenCalled();
  });

  it("lets a concurrent canonical Cal reschedule win", async () => {
    const { adapters, stored, setStored, setCal } = harness();
    vi.mocked(adapters.waitForStability).mockImplementation(async () => {
      setStored({
        ...stored(),
        currentCalBookingUid: "attendee-new",
        scheduledStartAt: "2026-09-13T18:00:00.000Z",
        intendedStartAt: null,
        synchronizationStatus: "SYNCHRONIZED",
      });
      setCal(
        calBooking({
          uid: "attendee-new",
          start: "2026-09-13T18:00:00.000Z",
        }),
      );
    });
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "concurrent_cal_change" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
  });

  it("threads retry states and stops mutating an exhausted revision", async () => {
    const { adapters, stored } = harness();
    vi.mocked(adapters.rescheduleCalBooking).mockRejectedValue(
      new Error("Cal booking reschedule failed (503)"),
    );
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "needs_attention" });
    expect(adapters.rescheduleCalBooking).toHaveBeenCalledTimes(3);
    expect(adapters.waitForRetry).toHaveBeenCalledTimes(2);
    expect(adapters.getCalBooking).toHaveBeenCalledTimes(4);
    expect(adapters.sendAlert).toHaveBeenCalledTimes(3);
    expect(adapters.sendAlert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ threadTs: "1700000000.0001" }),
    );

    await reconcileSalesAppointment(appointmentId, options, adapters);
    expect(adapters.rescheduleCalBooking).toHaveBeenCalledTimes(3);
    expect(adapters.sendAlert).toHaveBeenCalledTimes(3);
    expect(
      stored().reconciliationAlertRevision?.startsWith(
        `${googleRevision(googleEvent())}|`,
      ),
    ).toBe(true);
  });

  it("threads a manual provider repair without mutating the exhausted revision", async () => {
    const revision = googleRevision(googleEvent());
    const { adapters, setCal } = harness(
      appointment({
        acceptedGoogleRevision: revision,
        synchronizationStatus: "NEEDS_ATTENTION",
        intendedStartAt: intendedStart,
        reconciliationAlertRevision: `${revision}|provider_failure|exhausted`,
        reconciliationAlertThreadTs: "1700000000.0001",
      }),
    );
    setCal(calBooking({ start: intendedStart }));
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "needs_attention" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
    expect(adapters.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "manual_repair_detected",
        threadTs: "1700000000.0001",
      }),
    );
  });

  it("detects a lost Cal response from the replacement UID before writing again", async () => {
    const { adapters } = harness();
    vi.mocked(adapters.getCalBooking).mockImplementation(async (uid) => {
      if (uid === "cal-new") {
        return calBooking({ uid: "cal-new", start: intendedStart });
      }
      return calBooking({ status: "cancelled", rescheduledToUid: "cal-new" });
    });
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "provider_already_converged" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
    expect(adapters.enqueueLifecycleRepair).toHaveBeenCalledTimes(1);
  });

  it("lets a provider-side replacement with a different start win", async () => {
    const providerStart = "2026-09-13T18:00:00.000Z";
    const { adapters } = harness();
    vi.mocked(adapters.getCalBooking).mockImplementation(async (uid) => {
      if (uid === "attendee-new") {
        return calBooking({ uid: "attendee-new", start: providerStart });
      }
      return calBooking({
        status: "cancelled",
        rescheduledToUid: "attendee-new",
      });
    });
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "concurrent_cal_change" });
    expect(adapters.rescheduleCalBooking).not.toHaveBeenCalled();
  });

  it("fails closed when a replacement leaves two active Google events", async () => {
    const { adapters } = harness();
    vi.mocked(adapters.getCalBookingReferences).mockResolvedValue([
      {
        type: "google_calendar",
        eventUid: "replacement-google-event",
        destinationCalendarId: "primary",
      },
    ]);
    vi.mocked(adapters.getGoogleEvent).mockImplementation(
      async (_calendarId, eventId) =>
        googleEvent({ id: eventId, start: intendedStart }),
    );
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "needs_attention" });
    expect(adapters.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ classification: "two_active_google_events" }),
    );
  });

  it("enqueues deterministic repair when the signed webhook is absent", async () => {
    const { adapters } = harness();
    vi.mocked(adapters.waitForCanonicalWebhook).mockResolvedValue(undefined);
    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "repair_enqueued" });
    expect(adapters.enqueueLifecycleRepair).toHaveBeenCalledWith(
      expect.objectContaining({
        previousBooking: expect.objectContaining({ uid: "cal-old" }),
        replacementBooking: expect.objectContaining({ uid: "cal-new" }),
      }),
    );
  });

  it("does not repair an older reschedule after the canonical lineage advances again", async () => {
    const { adapters, setStored } = harness();
    vi.mocked(adapters.waitForCanonicalWebhook).mockImplementation(async () => {
      setStored(
        appointment({
          currentCalBookingUid: "cal-newer",
          scheduledStartAt: "2026-09-12T16:00:00.000Z",
          automationGeneration: 5,
        }),
      );
    });

    await expect(
      reconcileSalesAppointment(appointmentId, options, adapters),
    ).resolves.toMatchObject({ outcome: "concurrent_cal_change" });
    expect(adapters.enqueueLifecycleRepair).not.toHaveBeenCalled();
  });
});
