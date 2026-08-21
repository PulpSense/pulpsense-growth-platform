import type {
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingRescheduledEvent,
} from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  projectSalesAppointmentLifecycle,
  type NewBookingVersion,
  type NewSalesAppointment,
  type SalesAppointmentLedgerAdapter,
  type SalesAppointmentStatus,
} from "./sales-appointment-ledger.js";

const completed: BookingCompletedEvent = {
  schemaVersion: 1,
  eventType: "booking_completed",
  funnelId: "ai-seo",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  prospectId:
    "prospect_v1_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  eventId: "booking_completed:cal-1",
  occurredAt: "2026-08-20T09:00:00.000Z",
  qualificationStatus: "qualified",
  attribution: { firstTouch: {}, lastTouch: {} },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "test",
    sourceUrl: "https://example.com",
  },
  environment: "production",
  payload: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@example.com",
    phone: "+15551234567",
    emailVerification: { status: "verified", result: "business" },
    booking: {
      uid: "cal-1",
      title: "Sales call",
      startTime: "2026-08-22T09:00:00.000Z",
      endTime: "2026-08-22T09:30:00.000Z",
      attendeeTimeZone: "Europe/Budapest",
    },
  },
};

const rescheduled: BookingRescheduledEvent = {
  ...completed,
  eventType: "booking_rescheduled",
  eventId: "booking_rescheduled:cal-2",
  occurredAt: "2026-08-20T10:00:00.000Z",
  payload: {
    ...completed.payload,
    booking: {
      ...completed.payload.booking,
      uid: "cal-2",
      previousUid: "cal-1",
      previousStartTime: completed.payload.booking.startTime,
      previousEndTime: completed.payload.booking.endTime,
      startTime: "2026-08-24T10:00:00.000Z",
      endTime: "2026-08-24T10:30:00.000Z",
    },
  },
};

const cancelled = (uid: string): BookingCancelledEvent => ({
  ...completed,
  eventType: "booking_cancelled",
  eventId: `booking_cancelled:${uid}`,
  payload: {
    ...completed.payload,
    booking: { ...completed.payload.booking, uid },
  },
});

const memoryAdapter = () => {
  const appointments = new Map<string, NewSalesAppointment>();
  const versions = new Map<string, NewBookingVersion>();
  const adapter: SalesAppointmentLedgerAdapter = {
    async findBookingVersion(uid) {
      return [...versions.values()].find(
        (version) => version.calBookingUid === uid,
      );
    },
    async getSalesAppointment(id) {
      return appointments.get(id);
    },
    async createSalesAppointment(input) {
      if (appointments.has(input.id)) return;
      appointments.set(input.id, { ...input });
    },
    async updateSalesAppointment(id, input) {
      const current = appointments.get(id);
      if (!current) throw new Error("missing appointment");
      appointments.set(id, { ...current, ...input });
    },
    async createBookingVersion(input) {
      if (
        [...versions.values()].some(
          (version) => version.calBookingUid === input.calBookingUid,
        )
      )
        return;
      versions.set(input.id, { ...input });
    },
    async updateBookingVersion(id, input) {
      const current = versions.get(id);
      if (!current) throw new Error("missing version");
      versions.set(id, { ...current, ...input } as NewBookingVersion);
    },
  };
  return { adapter, appointments, versions };
};

const createInitial = async (memory: ReturnType<typeof memoryAdapter>) =>
  projectSalesAppointmentLifecycle(
    completed,
    { personId: "person-1", opportunityId: "opportunity-1" },
    memory.adapter,
  );

describe("Sales Appointment lifecycle projection", () => {
  it("creates one production Sales Appointment and one active BookingVersion idempotently", async () => {
    const memory = memoryAdapter();
    const first = await createInitial(memory);
    const replay = await projectSalesAppointmentLifecycle(
      completed,
      {},
      memory.adapter,
    );

    expect(memory.appointments).toHaveLength(1);
    expect(memory.versions).toHaveLength(1);
    expect(first.outcome).toBe("created");
    expect(first).toMatchObject({
      salesAppointmentId: "d2f8156a-0111-5370-a2a9-026bc4c58893",
      bookingVersionId: "6b258d28-1f9d-510a-8780-ce69193b5059",
    });
    expect(replay).toMatchObject({
      salesAppointmentId: first.salesAppointmentId,
      bookingVersionId: first.bookingVersionId,
      opportunityId: "opportunity-1",
      outcome: "duplicate",
    });
    expect(memory.appointments.get(first.salesAppointmentId)).toMatchObject({
      rootCalBookingUid: "cal-1",
      currentCalBookingUid: "cal-1",
      initialConfirmedAt: completed.occurredAt,
      classification: "PRODUCTION_COMMERCIAL",
      isTest: false,
      isCommercial: true,
      originatingLeadJourneyId: completed.submissionId,
      personId: "person-1",
      opportunityId: "opportunity-1",
      status: "SCHEDULED",
    });
  });

  it("classifies an explicitly approved production canary as non-commercial test data", async () => {
    const memory = memoryAdapter();
    const projection = await projectSalesAppointmentLifecycle(
      completed,
      {
        personId: "person-canary",
        opportunityId: "opportunity-canary",
        classification: {
          classification: "NON_PRODUCTION",
          isTest: true,
          isCommercial: false,
        },
      },
      memory.adapter,
    );

    expect(memory.appointments.get(projection.salesAppointmentId)).toMatchObject({
      classification: "NON_PRODUCTION",
      isTest: true,
      isCommercial: false,
    });
  });

  it("repairs an appointment-only partial create without advancing another Opportunity", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    memory.versions.delete(initial.bookingVersionId);
    await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
      currentBookingVersionId: undefined,
    });
    const resolveCreationContext = vi.fn().mockResolvedValue({
      personId: "person-1",
      opportunityId: "opportunity-newer",
    });

    const replay = await projectSalesAppointmentLifecycle(
      completed,
      { resolveCreationContext },
      memory.adapter,
    );

    expect(resolveCreationContext).not.toHaveBeenCalled();
    expect(replay).toMatchObject({
      salesAppointmentId: initial.salesAppointmentId,
      bookingVersionId: initial.bookingVersionId,
      opportunityId: "opportunity-1",
      outcome: "duplicate",
    });
    expect(memory.versions).toHaveLength(1);
    expect(memory.appointments.get(initial.salesAppointmentId)).toMatchObject({
      currentBookingVersionId: initial.bookingVersionId,
      opportunityId: "opportunity-1",
    });
  });

  it("adds one replacement version, preserves initial confirmation, and never creates another appointment", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    const moved = await projectSalesAppointmentLifecycle(
      rescheduled,
      {},
      memory.adapter,
    );
    const replay = await projectSalesAppointmentLifecycle(
      rescheduled,
      {},
      memory.adapter,
    );

    expect(memory.appointments).toHaveLength(1);
    expect(memory.versions).toHaveLength(2);
    expect(moved.outcome).toBe("rescheduled");
    expect(replay.outcome).toBe("duplicate");
    expect(memory.appointments.get(initial.salesAppointmentId)).toMatchObject({
      initialConfirmedAt: completed.occurredAt,
      currentCalBookingUid: "cal-2",
      currentBookingVersionId: moved.bookingVersionId,
      scheduledStartAt: rescheduled.payload.booking.startTime,
    });
    expect(
      [...memory.versions.values()].find(
        (version) => version.calBookingUid === "cal-1",
      ),
    ).toMatchObject({
      state: "SUPERSEDED",
      replacementBookingVersionId: moved.bookingVersionId,
    });
  });

  it("rejects a stale reschedule instead of overwriting the current lineage", async () => {
    const memory = memoryAdapter();
    await createInitial(memory);
    await projectSalesAppointmentLifecycle(rescheduled, {}, memory.adapter);
    await expect(
      projectSalesAppointmentLifecycle(
        {
          ...rescheduled,
          eventId: "booking_rescheduled:cal-3",
          payload: {
            ...rescheduled.payload,
            booking: { ...rescheduled.payload.booking, uid: "cal-3" },
          },
        },
        {},
        memory.adapter,
      ),
    ).rejects.toThrow("stale");
    expect(memory.versions).toHaveLength(2);
  });

  it("treats a delayed original completion as a no-op after rescheduling", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    const moved = await projectSalesAppointmentLifecycle(
      rescheduled,
      {},
      memory.adapter,
    );

    await expect(createInitial(memory)).resolves.toMatchObject({
      salesAppointmentId: initial.salesAppointmentId,
      bookingVersionId: initial.bookingVersionId,
      outcome: "duplicate",
    });
    expect(memory.appointments.get(initial.salesAppointmentId)).toMatchObject({
      currentCalBookingUid: "cal-2",
      currentBookingVersionId: moved.bookingVersionId,
      scheduledStartAt: rescheduled.payload.booking.startTime,
      scheduledEndAt: rescheduled.payload.booking.endTime,
      status: "SCHEDULED",
    });
  });

  it("does not rewind a rescheduled lineage whose current relation is missing", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    await projectSalesAppointmentLifecycle(rescheduled, {}, memory.adapter);
    await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
      currentBookingVersionId: undefined,
    });

    await expect(createInitial(memory)).resolves.toMatchObject({
      outcome: "duplicate",
    });
    expect(memory.appointments.get(initial.salesAppointmentId)).toMatchObject({
      currentBookingVersionId: undefined,
      currentCalBookingUid: "cal-2",
      scheduledStartAt: rescheduled.payload.booking.startTime,
      scheduledEndAt: rescheduled.payload.booking.endTime,
    });
  });

  it.each<SalesAppointmentStatus>(["NO_SHOW", "COMPLETED", "CANCELLED"])(
    "preserves %s while repairing a missing initial relation on completion replay",
    async (status) => {
      const memory = memoryAdapter();
      const initial = await createInitial(memory);
      await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
        currentBookingVersionId: undefined,
        status,
      });
      if (status === "CANCELLED") {
        await memory.adapter.updateBookingVersion(initial.bookingVersionId, {
          state: "CANCELLED",
        });
      }

      await expect(createInitial(memory)).resolves.toMatchObject({
        outcome: "duplicate",
      });
      expect(memory.appointments.get(initial.salesAppointmentId)).toMatchObject(
        {
          currentBookingVersionId: initial.bookingVersionId,
          status,
        },
      );
    },
  );

  it("cancels only the current BookingVersion and treats a superseded cancellation as a no-op", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    const moved = await projectSalesAppointmentLifecycle(
      rescheduled,
      {},
      memory.adapter,
    );

    await expect(
      projectSalesAppointmentLifecycle(cancelled("cal-1"), {}, memory.adapter),
    ).resolves.toMatchObject({
      outcome: "stale_cancellation",
    });
    expect(memory.appointments.get(initial.salesAppointmentId)?.status).toBe(
      "SCHEDULED",
    );

    const currentCancellation = await projectSalesAppointmentLifecycle(
      cancelled("cal-2"),
      {},
      memory.adapter,
    );
    const replay = await projectSalesAppointmentLifecycle(
      cancelled("cal-2"),
      {},
      memory.adapter,
    );
    expect(currentCancellation).toMatchObject({
      bookingVersionId: moved.bookingVersionId,
      outcome: "cancelled",
    });
    expect(replay.outcome).toBe("duplicate");
    expect(memory.appointments.get(initial.salesAppointmentId)?.status).toBe(
      "CANCELLED",
    );
    expect(memory.versions.get(moved.bookingVersionId)?.state).toBe(
      "CANCELLED",
    );
  });

  it("treats a superseded cancellation as stale before a partial reschedule advances the pointer", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    await projectSalesAppointmentLifecycle(rescheduled, {}, memory.adapter);
    await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
      currentBookingVersionId: initial.bookingVersionId,
      currentCalBookingUid: "cal-1",
      scheduledStartAt: completed.payload.booking.startTime,
      scheduledEndAt: completed.payload.booking.endTime,
    });

    await expect(
      projectSalesAppointmentLifecycle(cancelled("cal-1"), {}, memory.adapter),
    ).resolves.toMatchObject({ outcome: "stale_cancellation" });
    expect(memory.versions.get(initial.bookingVersionId)?.state).toBe(
      "SUPERSEDED",
    );
    expect(memory.appointments.get(initial.salesAppointmentId)?.status).toBe(
      "SCHEDULED",
    );
  });

  it("repairs an unlinked initial version before applying cancellation", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
      currentBookingVersionId: undefined,
    });

    await expect(
      projectSalesAppointmentLifecycle(cancelled("cal-1"), {}, memory.adapter),
    ).resolves.toMatchObject({
      salesAppointmentId: initial.salesAppointmentId,
      bookingVersionId: initial.bookingVersionId,
      outcome: "cancelled",
    });
    expect(memory.appointments.get(initial.salesAppointmentId)).toMatchObject({
      currentBookingVersionId: initial.bookingVersionId,
      status: "CANCELLED",
    });
    expect(memory.versions.get(initial.bookingVersionId)?.state).toBe(
      "CANCELLED",
    );

    await expect(createInitial(memory)).resolves.toMatchObject({
      outcome: "duplicate",
    });
    expect(memory.appointments.get(initial.salesAppointmentId)?.status).toBe(
      "CANCELLED",
    );
  });

  it("returns a no-show appointment to scheduled on a canonical reschedule", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
      status: "NO_SHOW",
    });
    await projectSalesAppointmentLifecycle(rescheduled, {}, memory.adapter);
    expect(memory.appointments.get(initial.salesAppointmentId)?.status).toBe(
      "SCHEDULED",
    );
  });

  it("does not revive a no-show when the replacement start is not in the future", async () => {
    const memory = memoryAdapter();
    const initial = await createInitial(memory);
    await memory.adapter.updateSalesAppointment(initial.salesAppointmentId, {
      status: "NO_SHOW",
    });
    await projectSalesAppointmentLifecycle(
      {
        ...rescheduled,
        payload: {
          ...rescheduled.payload,
          booking: {
            ...rescheduled.payload.booking,
            startTime: "2026-08-20T09:30:00.000Z",
            endTime: "2026-08-20T10:00:00.000Z",
          },
        },
      },
      {},
      memory.adapter,
    );
    expect(memory.appointments.get(initial.salesAppointmentId)?.status).toBe(
      "NO_SHOW",
    );
  });

  it("fails safely when a BookingVersion points to missing or conflicting lineage", async () => {
    const missing = memoryAdapter();
    missing.versions.set("orphan", {
      id: "orphan",
      name: "cal-1",
      calBookingUid: "cal-1",
      salesAppointmentId: "missing",
      scheduledStartAt: completed.payload.booking.startTime,
      scheduledEndAt: completed.payload.booking.endTime,
      lifecycleOccurredAt: completed.occurredAt,
      state: "ACTIVE",
    });
    await expect(createInitial(missing)).rejects.toThrow(
      "missing Sales Appointment",
    );
  });
});
