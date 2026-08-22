import type {
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingRescheduledEvent,
} from "@pulpsense/contracts";

export type BookingLifecycleEvent =
  | BookingCompletedEvent
  | BookingRescheduledEvent
  | BookingCancelledEvent;

export type SalesAppointmentStatus =
  | "SCHEDULED"
  | "NO_SHOW"
  | "COMPLETED"
  | "CANCELLED";
export type BookingVersionState = "ACTIVE" | "SUPERSEDED" | "CANCELLED";
export type SalesAppointmentSynchronizationStatus =
  | "MAPPING_PENDING"
  | "OBSERVED_DIFFERENCE"
  | "SYNCHRONIZED"
  | "RECONCILIATION_PENDING"
  | "RECONCILING"
  | "NEEDS_ATTENTION";

export type SalesAppointmentRecord = {
  id: string;
  name?: string;
  rootCalBookingUid: string;
  currentCalBookingUid: string;
  currentBookingVersionId?: string;
  originatingLeadJourneyId: string;
  initialConfirmedAt: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: SalesAppointmentStatus;
  funnelId?: BookingLifecycleEvent["funnelId"];
  environment?: BookingLifecycleEvent["environment"];
  prospectId?: string;
  personId: string;
  opportunityId: string;
  googleCalendarId?: string | null;
  googleEventId?: string | null;
  googleICalUid?: string | null;
  googleEventEtag?: string | null;
  googleEventSequence?: number | null;
  googleObservedStartAt?: string | null;
  synchronizationStatus?: SalesAppointmentSynchronizationStatus;
  acceptedGoogleRevision?: string | null;
  intendedStartAt?: string | null;
  automationGeneration?: number;
  reconciliationAlertRevision?: string | null;
  reconciliationAlertThreadTs?: string | null;
};

export type BookingVersionRecord = {
  id: string;
  calBookingUid: string;
  salesAppointmentId: string;
  state: BookingVersionState;
  previousBookingVersionId?: string;
  replacementBookingVersionId?: string;
};

export type NewSalesAppointment = SalesAppointmentRecord & {
  name: string;
  funnelId: string;
  environment: BookingLifecycleEvent["environment"];
  classification: "PRODUCTION_COMMERCIAL" | "NON_PRODUCTION";
  isTest: boolean;
  isCommercial: boolean;
  prospectId?: string;
  personId: string;
};

export type NewBookingVersion = BookingVersionRecord & {
  name: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  lifecycleOccurredAt: string;
};

export type SalesAppointmentLedgerAdapter = {
  findBookingVersion(
    calBookingUid: string,
  ): Promise<BookingVersionRecord | undefined>;
  getSalesAppointment(id: string): Promise<SalesAppointmentRecord | undefined>;
  createSalesAppointment(input: NewSalesAppointment): Promise<void>;
  updateSalesAppointment(
    id: string,
    input: Partial<SalesAppointmentRecord>,
  ): Promise<void>;
  createBookingVersion(input: NewBookingVersion): Promise<void>;
  updateBookingVersion(
    id: string,
    input: Partial<BookingVersionRecord>,
  ): Promise<void>;
};

export type SalesAppointmentProjectionContext = {
  personId?: string;
  opportunityId?: string;
  classification?: Pick<
    NewSalesAppointment,
    "classification" | "isTest" | "isCommercial"
  >;
  /** Read-only selection; the projector persists these references before callers mutate them. */
  resolveCreationContext?: () => Promise<{
    personId: string;
    opportunityId: string;
  }>;
};

export type SalesAppointmentProjectionOutcome = {
  salesAppointmentId: string;
  bookingVersionId: string;
  opportunityId?: string;
  outcome:
    | "created"
    | "rescheduled"
    | "cancelled"
    | "duplicate"
    | "stale_cancellation";
};

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

export const salesAppointmentIdFor = (rootUid: string) =>
  deterministicUuid(`sales-appointment:${rootUid}`);
const bookingVersionIdFor = (uid: string) =>
  deterministicUuid(`booking-version:${uid}`);

const requireAppointment = async (
  adapter: SalesAppointmentLedgerAdapter,
  version: BookingVersionRecord,
) => {
  const appointment = await adapter.getSalesAppointment(
    version.salesAppointmentId,
  );
  if (!appointment) {
    throw new Error("BookingVersion references a missing Sales Appointment");
  }
  return appointment;
};

const projectCompleted = async (
  event: BookingCompletedEvent,
  context: SalesAppointmentProjectionContext,
  adapter: SalesAppointmentLedgerAdapter,
): Promise<SalesAppointmentProjectionOutcome> => {
  const uid = event.payload.booking.uid;
  const existingVersion = await adapter.findBookingVersion(uid);
  const appointmentId =
    existingVersion?.salesAppointmentId ?? (await salesAppointmentIdFor(uid));
  const bookingVersionId =
    existingVersion?.id ?? (await bookingVersionIdFor(uid));
  let appointment = await adapter.getSalesAppointment(appointmentId);
  const appointmentWasCreated = !appointment;

  if (existingVersion && !appointment) {
    throw new Error("BookingVersion references a missing Sales Appointment");
  }
  if (appointment && appointment.rootCalBookingUid !== uid) {
    throw new Error(
      "Cal UID resolves to a different Sales Appointment lineage",
    );
  }
  if (!appointment) {
    const creationContext = context.resolveCreationContext
      ? await context.resolveCreationContext()
      : context;
    if (!creationContext.personId || !creationContext.opportunityId) {
      throw new Error(
        "Sales Appointment completion requires Person and Opportunity references",
      );
    }
    await adapter.createSalesAppointment({
      id: appointmentId,
      name: event.payload.booking.title,
      rootCalBookingUid: uid,
      currentCalBookingUid: uid,
      originatingLeadJourneyId: event.submissionId,
      initialConfirmedAt: event.occurredAt,
      scheduledStartAt: event.payload.booking.startTime,
      scheduledEndAt: event.payload.booking.endTime,
      status: "SCHEDULED",
      funnelId: event.funnelId,
      environment: event.environment,
      ...(context.classification ?? {
        classification:
          event.environment === "production"
            ? "PRODUCTION_COMMERCIAL"
            : "NON_PRODUCTION",
        isTest: event.environment !== "production",
        isCommercial: true,
      }),
      synchronizationStatus: "MAPPING_PENDING",
      automationGeneration: 1,
      ...(event.prospectId ? { prospectId: event.prospectId } : {}),
      personId: creationContext.personId,
      opportunityId: creationContext.opportunityId,
    });
    appointment = await adapter.getSalesAppointment(appointmentId);
  }
  if (!appointment) {
    throw new Error("Sales Appointment create did not produce readable state");
  }
  if (!existingVersion) {
    await adapter.createBookingVersion({
      id: bookingVersionId,
      name: uid,
      calBookingUid: uid,
      salesAppointmentId: appointmentId,
      scheduledStartAt: event.payload.booking.startTime,
      scheduledEndAt: event.payload.booking.endTime,
      lifecycleOccurredAt: event.occurredAt,
      state: "ACTIVE",
    });
  }
  // A replay may arrive after this lineage has already moved to a replacement
  // UID. Only repair the initial create/link window; never move the canonical
  // pointer backwards from an established current version.
  const canRepairInitialLink =
    appointmentWasCreated ||
    (appointment?.currentCalBookingUid === uid &&
      existingVersion?.state !== "SUPERSEDED");
  if (!appointment?.currentBookingVersionId && canRepairInitialLink) {
    await adapter.updateSalesAppointment(appointmentId, {
      currentBookingVersionId: bookingVersionId,
      currentCalBookingUid: uid,
      scheduledStartAt: event.payload.booking.startTime,
      scheduledEndAt: event.payload.booking.endTime,
    });
  }
  return {
    salesAppointmentId: appointmentId,
    bookingVersionId,
    opportunityId: appointment.opportunityId,
    outcome: appointmentWasCreated ? "created" : "duplicate",
  };
};

const projectRescheduled = async (
  event: BookingRescheduledEvent,
  adapter: SalesAppointmentLedgerAdapter,
): Promise<SalesAppointmentProjectionOutcome> => {
  const { booking } = event.payload;
  const previous = await adapter.findBookingVersion(booking.previousUid);
  if (!previous)
    throw new Error(
      "Previous Cal UID is not present in the Sales Appointment ledger",
    );
  const appointment = await requireAppointment(adapter, previous);
  const replacement = await adapter.findBookingVersion(booking.uid);
  if (replacement && replacement.salesAppointmentId !== appointment.id) {
    throw new Error(
      "Replacement Cal UID belongs to a different Sales Appointment",
    );
  }
  const replacementId =
    replacement?.id ?? (await bookingVersionIdFor(booking.uid));
  if (
    replacement?.salesAppointmentId === appointment.id &&
    previous.state === "SUPERSEDED" &&
    replacement.state === "SUPERSEDED"
  ) {
    return {
      salesAppointmentId: appointment.id,
      bookingVersionId: replacementId,
      outcome: "duplicate",
    };
  }
  if (
    appointment.currentBookingVersionId !== previous.id &&
    appointment.currentBookingVersionId !== replacementId
  ) {
    throw new Error(
      "Reschedule previous UID is stale for the current Sales Appointment",
    );
  }
  if (
    replacement &&
    appointment.currentBookingVersionId === replacementId &&
    previous.state === "SUPERSEDED"
  ) {
    return {
      salesAppointmentId: appointment.id,
      bookingVersionId: replacementId,
      outcome: "duplicate",
    };
  }
  const retryingPartialProjection =
    replacement?.salesAppointmentId === appointment.id &&
    appointment.currentBookingVersionId === previous.id;
  if (
    appointment.status === "CANCELLED" ||
    appointment.status === "COMPLETED" ||
    (previous.state !== "ACTIVE" && !retryingPartialProjection)
  ) {
    throw new Error(
      "Reschedule previous UID is stale for the current Sales Appointment",
    );
  }
  if (!replacement) {
    await adapter.createBookingVersion({
      id: replacementId,
      name: booking.uid,
      calBookingUid: booking.uid,
      salesAppointmentId: appointment.id,
      scheduledStartAt: booking.startTime,
      scheduledEndAt: booking.endTime,
      lifecycleOccurredAt: event.occurredAt,
      previousBookingVersionId: previous.id,
      state: "ACTIVE",
    });
  }
  if (previous.state !== "SUPERSEDED") {
    await adapter.updateBookingVersion(previous.id, {
      state: "SUPERSEDED",
      replacementBookingVersionId: replacementId,
    });
  }
  if (appointment.currentBookingVersionId !== replacementId) {
    const alreadyAcceptedGoogleMove =
      appointment.intendedStartAt === booking.startTime;
    await adapter.updateSalesAppointment(appointment.id, {
      currentBookingVersionId: replacementId,
      currentCalBookingUid: booking.uid,
      scheduledStartAt: booking.startTime,
      scheduledEndAt: booking.endTime,
      synchronizationStatus: appointment.googleEventId
        ? "SYNCHRONIZED"
        : "MAPPING_PENDING",
      intendedStartAt: null,
      automationGeneration: alreadyAcceptedGoogleMove
        ? (appointment.automationGeneration ?? 1)
        : (appointment.automationGeneration ?? 1) + 1,
      ...(appointment.status === "NO_SHOW" &&
      Date.parse(booking.startTime) > Date.parse(event.occurredAt)
        ? { status: "SCHEDULED" }
        : {}),
    });
  }
  return {
    salesAppointmentId: appointment.id,
    bookingVersionId: replacementId,
    outcome:
      replacement && appointment.currentBookingVersionId === replacementId
        ? "duplicate"
        : "rescheduled",
  };
};

const projectCancelled = async (
  event: BookingCancelledEvent,
  adapter: SalesAppointmentLedgerAdapter,
): Promise<SalesAppointmentProjectionOutcome> => {
  const version = await adapter.findBookingVersion(event.payload.booking.uid);
  if (!version)
    throw new Error(
      "Cancelled Cal UID is not present in the Sales Appointment ledger",
    );
  const appointment = await requireAppointment(adapter, version);
  // Cal.com may cancel the provider event for an old UID while a reschedule is
  // between superseding that version and advancing the appointment pointer.
  // The version state is authoritative during that partial-projection window.
  if (version.state === "SUPERSEDED") {
    return {
      salesAppointmentId: appointment.id,
      bookingVersionId: version.id,
      outcome: "stale_cancellation",
    };
  }
  const repairingInitialLink = !appointment.currentBookingVersionId;
  if (
    repairingInitialLink &&
    (appointment.rootCalBookingUid !== version.calBookingUid ||
      (version.state !== "ACTIVE" && version.state !== "CANCELLED"))
  ) {
    throw new Error(
      "Sales Appointment is missing its current BookingVersion relation",
    );
  }
  if (
    appointment.currentBookingVersionId &&
    appointment.currentBookingVersionId !== version.id
  ) {
    return {
      salesAppointmentId: appointment.id,
      bookingVersionId: version.id,
      outcome: "stale_cancellation",
    };
  }
  const duplicate =
    version.state === "CANCELLED" && appointment.status === "CANCELLED";
  if (version.state !== "CANCELLED") {
    await adapter.updateBookingVersion(version.id, { state: "CANCELLED" });
  }
  if (appointment.status !== "CANCELLED" || repairingInitialLink) {
    await adapter.updateSalesAppointment(appointment.id, {
      ...(repairingInitialLink ? { currentBookingVersionId: version.id } : {}),
      status: "CANCELLED",
    });
  }
  return {
    salesAppointmentId: appointment.id,
    bookingVersionId: version.id,
    outcome: duplicate ? "duplicate" : "cancelled",
  };
};

export const projectSalesAppointmentLifecycle = async (
  event: BookingLifecycleEvent,
  context: SalesAppointmentProjectionContext,
  adapter: SalesAppointmentLedgerAdapter,
) => {
  if (event.eventType === "booking_completed") {
    return projectCompleted(event, context, adapter);
  }
  if (event.eventType === "booking_rescheduled") {
    return projectRescheduled(event, adapter);
  }
  return projectCancelled(event, adapter);
};
