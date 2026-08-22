import type {
  SalesAppointmentRecord,
  SalesAppointmentSynchronizationStatus,
} from "./sales-appointment-ledger.js";

export type CalendarReconciliationMode = "off" | "observe" | "reconcile";

export type GoogleCalendarEvent = {
  id: string;
  iCalUID?: string;
  etag: string;
  sequence: number;
  status: "confirmed" | "cancelled";
  start: string;
  description?: string;
};

export type CalBooking = {
  uid: string;
  title: string;
  status: string;
  start: string;
  end: string;
  meetingUrl?: string;
  hosts: Array<{ email: string }>;
  attendees: Array<{
    name: string;
    email: string;
    phoneNumber?: string;
    timeZone: string;
  }>;
  rescheduledToUid?: string;
};

export type CalBookingReference = {
  type: string;
  eventUid: string;
  destinationCalendarId: string;
};

export type GoogleMapping = {
  calendarId: string;
  eventId: string;
};

export type RescheduleInput = {
  bookingUid: string;
  start: string;
  rescheduledBy: string;
  rescheduleWithSameHost: true;
  allowConflicts: true;
  allowBookingOutOfBounds: true;
  skipBookingLimits: true;
};

export type LifecycleRepairInput = {
  salesAppointment: SalesAppointmentRecord;
  previousBooking: CalBooking;
  replacementBooking: CalBooking;
};

export type ReconciliationAlert = {
  salesAppointment: SalesAppointmentRecord;
  revision: string;
  classification: string;
  oldStart: string;
  intendedStart: string;
  retryState: string;
  repairAction: string;
  threadTs?: string;
  recovered?: boolean;
};

export type CalendarReconciliationAdapters = {
  getSalesAppointment(id: string): Promise<SalesAppointmentRecord | undefined>;
  updateSalesAppointment(
    id: string,
    patch: Partial<SalesAppointmentRecord>,
  ): Promise<void>;
  resolveGoogleMapping(bookingUid: string): Promise<GoogleMapping | undefined>;
  getGoogleEvent(
    calendarId: string,
    eventId: string,
  ): Promise<GoogleCalendarEvent | undefined>;
  getCalBooking(bookingUid: string): Promise<CalBooking | undefined>;
  getCalBookingReferences(bookingUid: string): Promise<CalBookingReference[]>;
  rescheduleCalBooking(input: RescheduleInput): Promise<CalBooking>;
  waitForStability(): Promise<void>;
  waitForRetry(attempt: number): Promise<void>;
  waitForCanonicalWebhook(): Promise<void>;
  enqueueLifecycleRepair(input: LifecycleRepairInput): Promise<void>;
  sendAlert(input: ReconciliationAlert): Promise<{ threadTs?: string }>;
  now(): Date;
};

export type ReconciliationOptions = {
  mode: CalendarReconciliationMode;
  allowedBookingUids: ReadonlySet<string>;
  hostEmail: string;
  canaryOnly: boolean;
  canaryAttendeeEmail?: string;
};

export type ReconciliationOutcome =
  | "off"
  | "ineligible"
  | "mapping_pending"
  | "google_event_missing"
  | "unchanged"
  | "observed_difference"
  | "canary_blocked"
  | "unstable"
  | "concurrent_cal_change"
  | "past_time_rejected"
  | "provider_already_converged"
  | "webhook_confirmed"
  | "repair_enqueued"
  | "needs_attention";

const sameInstant = (left: string, right: string) =>
  Date.parse(left) === Date.parse(right);

const isTransientProviderError = (error: unknown) => {
  const status = (error as { status?: unknown })?.status;
  return (
    typeof status !== "number" ||
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
};

export const googleRevision = (event: GoogleCalendarEvent) =>
  [
    event.id,
    event.etag,
    event.sequence,
    new Date(event.start).toISOString(),
  ].join(":");

export const selectEligibleSalesAppointments = (
  appointments: SalesAppointmentRecord[],
  now = new Date(),
) => {
  const lowerBound = now.getTime() - 7 * 24 * 60 * 60_000;
  const upperBound = now.getTime() + 180 * 24 * 60 * 60_000;
  return appointments.filter((appointment) => {
    if (
      appointment.status === "CANCELLED" ||
      appointment.status === "COMPLETED"
    ) {
      return false;
    }
    const start = Date.parse(appointment.scheduledStartAt);
    const unresolved = [
      "MAPPING_PENDING",
      "OBSERVED_DIFFERENCE",
      "RECONCILIATION_PENDING",
      "RECONCILING",
      "NEEDS_ATTENTION",
    ].includes(appointment.synchronizationStatus ?? "MAPPING_PENDING");
    return unresolved || (start >= lowerBound && start <= upperBound);
  });
};

const googleStatePatch = (
  event: GoogleCalendarEvent,
): Partial<SalesAppointmentRecord> => ({
  googleEventEtag: event.etag,
  googleEventSequence: event.sequence,
  googleObservedStartAt: event.start,
  googleICalUid: event.iCalUID ?? null,
});

const resolveMappedEvent = async (
  appointment: SalesAppointmentRecord,
  adapters: CalendarReconciliationAdapters,
) => {
  let calendarId = appointment.googleCalendarId ?? undefined;
  let eventId = appointment.googleEventId ?? undefined;
  if (!calendarId || !eventId) {
    const mapping = await adapters.resolveGoogleMapping(
      appointment.currentCalBookingUid,
    );
    if (!mapping) return undefined;
    calendarId = mapping.calendarId;
    eventId = mapping.eventId;
    await adapters.updateSalesAppointment(appointment.id, {
      googleCalendarId: calendarId,
      googleEventId: eventId,
      synchronizationStatus: "MAPPING_PENDING",
    });
  }
  const event = await adapters.getGoogleEvent(calendarId, eventId);
  return { calendarId, eventId, event };
};

const alertTransition = async (
  appointment: SalesAppointmentRecord,
  revision: string,
  classification: string,
  intendedStart: string,
  retryState: string,
  repairAction: string,
  adapters: CalendarReconciliationAdapters,
) => {
  const current =
    (await adapters.getSalesAppointment(appointment.id)) ?? appointment;
  const alertState = `${revision}|${classification}|${retryState}`;
  if (current.reconciliationAlertRevision === alertState) return;
  const { threadTs } = await adapters.sendAlert({
    salesAppointment: current,
    revision,
    classification,
    oldStart: appointment.scheduledStartAt,
    intendedStart,
    retryState,
    repairAction,
    ...(current.reconciliationAlertThreadTs
      ? { threadTs: current.reconciliationAlertThreadTs }
      : {}),
    ...(classification === "recovered" ? { recovered: true } : {}),
  });
  await adapters.updateSalesAppointment(current.id, {
    reconciliationAlertRevision: alertState,
    reconciliationAlertThreadTs:
      threadTs ?? current.reconciliationAlertThreadTs ?? null,
  });
};

const markNeedsAttention = async (
  appointment: SalesAppointmentRecord,
  revision: string,
  classification: string,
  intendedStart: string,
  retryState: string,
  repairAction: string,
  adapters: CalendarReconciliationAdapters,
) => {
  await adapters.updateSalesAppointment(appointment.id, {
    synchronizationStatus: "NEEDS_ATTENTION",
    intendedStartAt: intendedStart,
  });
  await alertTransition(
    appointment,
    revision,
    classification,
    intendedStart,
    retryState,
    repairAction,
    adapters,
  );
};

const preflight = async (
  appointmentId: string,
  candidate: GoogleCalendarEvent,
  adapters: CalendarReconciliationAdapters,
) => {
  const appointment = await adapters.getSalesAppointment(appointmentId);
  if (!appointment) return { outcome: "appointment_missing" as const };
  if (
    appointment.status === "CANCELLED" ||
    appointment.status === "COMPLETED"
  ) {
    return { outcome: "terminal" as const, appointment };
  }
  if (appointment.acceptedGoogleRevision !== googleRevision(candidate)) {
    return { outcome: "revision_advanced" as const, appointment };
  }
  if (
    appointment.intendedStartAt !== candidate.start ||
    !["RECONCILIATION_PENDING", "RECONCILING"].includes(
      appointment.synchronizationStatus ?? "SYNCHRONIZED",
    )
  ) {
    return { outcome: "canonical_advanced" as const, appointment };
  }
  const google = await adapters.getGoogleEvent(
    appointment.googleCalendarId!,
    appointment.googleEventId!,
  );
  if (!google || googleRevision(google) !== googleRevision(candidate)) {
    return { outcome: "google_advanced" as const, appointment };
  }
  const cal = await adapters.getCalBooking(appointment.currentCalBookingUid);
  if (!cal) return { outcome: "cal_missing" as const, appointment };
  if (cal.rescheduledToUid) {
    const replacement = await adapters.getCalBooking(cal.rescheduledToUid);
    if (replacement && sameInstant(replacement.start, candidate.start)) {
      return {
        outcome: "provider_converged" as const,
        appointment,
        google,
        cal: replacement,
        previousCal: cal,
      };
    }
    return {
      outcome: "cal_advanced" as const,
      appointment,
      cal: replacement ?? cal,
    };
  }
  if (sameInstant(cal.start, candidate.start)) {
    return { outcome: "provider_converged" as const, appointment, google, cal };
  }
  if (
    cal.uid !== appointment.currentCalBookingUid ||
    !sameInstant(cal.start, appointment.scheduledStartAt)
  ) {
    return { outcome: "cal_advanced" as const, appointment, cal };
  }
  return { outcome: "ready" as const, appointment, google, cal };
};

const readBackGoogleMapping = async (
  previousMapping: GoogleMapping,
  replacementUid: string,
  intendedStart: string,
  adapters: CalendarReconciliationAdapters,
) => {
  const references = await adapters.getCalBookingReferences(replacementUid);
  const reference = references.find(
    (candidate) =>
      candidate.type === "google_calendar" &&
      candidate.eventUid &&
      candidate.destinationCalendarId,
  );
  if (!reference) throw new Error("replacement_google_reference_missing");
  const replacementMapping = {
    calendarId: reference.destinationCalendarId,
    eventId: reference.eventUid,
  };
  const replacementEvent = await adapters.getGoogleEvent(
    replacementMapping.calendarId,
    replacementMapping.eventId,
  );
  if (
    !replacementEvent ||
    replacementEvent.status === "cancelled" ||
    !sameInstant(replacementEvent.start, intendedStart)
  ) {
    throw new Error("replacement_google_event_invalid");
  }
  if (
    replacementMapping.calendarId !== previousMapping.calendarId ||
    replacementMapping.eventId !== previousMapping.eventId
  ) {
    const previousEvent = await adapters.getGoogleEvent(
      previousMapping.calendarId,
      previousMapping.eventId,
    );
    if (previousEvent && previousEvent.status !== "cancelled") {
      throw new Error("two_active_google_events");
    }
  }
  return { mapping: replacementMapping, event: replacementEvent };
};

const completeProviderSuccess = async (
  acceptedAppointment: SalesAppointmentRecord,
  previousBooking: CalBooking,
  replacementBooking: CalBooking,
  intendedStart: string,
  mapping: GoogleMapping,
  event: GoogleCalendarEvent,
  revision: string,
  adapters: CalendarReconciliationAdapters,
): Promise<ReconciliationOutcome> => {
  await adapters.updateSalesAppointment(acceptedAppointment.id, {
    googleCalendarId: mapping.calendarId,
    googleEventId: mapping.eventId,
    ...googleStatePatch(event),
  });
  await adapters.waitForCanonicalWebhook();
  const canonical = await adapters.getSalesAppointment(acceptedAppointment.id);
  if (
    canonical &&
    canonical.currentCalBookingUid === replacementBooking.uid &&
    sameInstant(canonical.scheduledStartAt, intendedStart)
  ) {
    await adapters.updateSalesAppointment(canonical.id, {
      synchronizationStatus: "SYNCHRONIZED",
      intendedStartAt: null,
    });
    const alertRevision =
      canonical.reconciliationAlertRevision ??
      acceptedAppointment.reconciliationAlertRevision;
    if (alertRevision?.startsWith(`${revision}|`)) {
      await alertTransition(
        canonical,
        revision,
        "recovered",
        intendedStart,
        "canonical webhook confirmed",
        "No further action is required.",
        adapters,
      );
    }
    return "webhook_confirmed";
  }
  if (
    canonical &&
    canonical.currentCalBookingUid !== acceptedAppointment.currentCalBookingUid &&
    canonical.currentCalBookingUid !== replacementBooking.uid
  ) {
    return "concurrent_cal_change";
  }
  await adapters.enqueueLifecycleRepair({
    salesAppointment: acceptedAppointment,
    previousBooking,
    replacementBooking,
  });
  return "repair_enqueued";
};

/**
 * The single Sales Appointment-level reconciliation interface. Provider and
 * persistence details remain behind injected adapters so callers only select
 * an appointment ID and interpret a classified outcome.
 */
export const reconcileSalesAppointment = async (
  appointmentId: string,
  options: ReconciliationOptions,
  adapters: CalendarReconciliationAdapters,
): Promise<{ outcome: ReconciliationOutcome; revision?: string }> => {
  if (options.mode === "off") return { outcome: "off" };
  let appointment = await adapters.getSalesAppointment(appointmentId);
  if (
    !appointment ||
    appointment.status === "CANCELLED" ||
    appointment.status === "COMPLETED"
  ) {
    return { outcome: "ineligible" };
  }

  let mapped: Awaited<ReturnType<typeof resolveMappedEvent>>;
  try {
    mapped = await resolveMappedEvent(appointment, adapters);
  } catch {
    await markNeedsAttention(
      appointment,
      `mapping:${appointment.currentCalBookingUid}`,
      "mapping_lookup_failed",
      appointment.scheduledStartAt,
      "will retry on next poll",
      "Verify the Cal booking references and Google OAuth access.",
      adapters,
    );
    return { outcome: "needs_attention" };
  }
  if (!mapped) {
    await adapters.updateSalesAppointment(appointment.id, {
      synchronizationStatus: "MAPPING_PENDING",
    });
    return { outcome: "mapping_pending" };
  }
  if (!mapped.event || mapped.event.status === "cancelled") {
    await markNeedsAttention(
      appointment,
      `missing:${mapped.eventId}`,
      "google_event_missing",
      appointment.scheduledStartAt,
      "polling retained",
      "Restore or manually remap the Google event; no event was deleted.",
      adapters,
    );
    return { outcome: "google_event_missing" };
  }

  const observed = mapped.event;
  const revision = googleRevision(observed);
  await adapters.updateSalesAppointment(
    appointment.id,
    googleStatePatch(observed),
  );
  if (sameInstant(observed.start, appointment.scheduledStartAt)) {
    if (appointment.reconciliationAlertRevision?.startsWith(`${revision}|`)) {
      await alertTransition(
        appointment,
        revision,
        "recovered",
        observed.start,
        "Google and the canonical Sales Appointment agree",
        "No further action is required.",
        adapters,
      );
    }
    await adapters.updateSalesAppointment(appointment.id, {
      synchronizationStatus: "SYNCHRONIZED",
      intendedStartAt: null,
    });
    return { outcome: "unchanged", revision };
  }
  if (options.mode === "observe") {
    await adapters.updateSalesAppointment(appointment.id, {
      synchronizationStatus: "OBSERVED_DIFFERENCE",
    });
    return { outcome: "observed_difference", revision };
  }
  if (
    options.canaryOnly &&
    !options.allowedBookingUids.has(appointment.currentCalBookingUid)
  ) {
    return { outcome: "canary_blocked", revision };
  }

  let initialCal: CalBooking | undefined;
  try {
    initialCal = await adapters.getCalBooking(appointment.currentCalBookingUid);
  } catch {
    await markNeedsAttention(
      appointment,
      revision,
      "cal_preflight_read_failed",
      observed.start,
      "mutation not attempted",
      "Verify Cal API availability and credentials.",
      adapters,
    );
    return { outcome: "needs_attention", revision };
  }
  if (
    appointment.acceptedGoogleRevision === revision &&
    appointment.synchronizationStatus === "NEEDS_ATTENTION"
  ) {
    const replacement = initialCal?.rescheduledToUid
      ? await adapters.getCalBooking(initialCal.rescheduledToUid)
      : undefined;
    const manuallyConverged = [initialCal, replacement].some(
      (booking) => booking && sameInstant(booking.start, observed.start),
    );
    if (manuallyConverged) {
      await alertTransition(
        appointment,
        revision,
        "manual_repair_detected",
        observed.start,
        "provider now matches the intended Google time",
        "Confirm the signed lifecycle webhook advances Twenty; the reconciler remains read-only for this revision.",
        adapters,
      );
    }
    return { outcome: "needs_attention", revision };
  }
  const hostMatches = initialCal?.hosts.some(
    ({ email }) => email.toLowerCase() === options.hostEmail.toLowerCase(),
  );
  if (!initialCal || !hostMatches) {
    await markNeedsAttention(
      appointment,
      revision,
      "host_assertion_failed",
      observed.start,
      "mutation blocked",
      "Verify the current Cal booking and configured authenticated host email.",
      adapters,
    );
    return { outcome: "needs_attention", revision };
  }

  if (options.canaryOnly) {
    const canaryAttendeeEmail = options.canaryAttendeeEmail?.toLowerCase();
    const attendeeMatches = initialCal.attendees.some(
      ({ email }) => email.toLowerCase() === canaryAttendeeEmail,
    );
    if (!canaryAttendeeEmail || !attendeeMatches) {
      await markNeedsAttention(
        appointment,
        revision,
        "canary_attendee_assertion_failed",
        observed.start,
        "mutation blocked",
        "Use an explicitly configured internal attendee for the live canary.",
        adapters,
      );
      return { outcome: "needs_attention", revision };
    }
  }

  await adapters.updateSalesAppointment(appointment.id, {
    synchronizationStatus: "OBSERVED_DIFFERENCE",
    intendedStartAt: observed.start,
  });
  await adapters.waitForStability();
  let stable: GoogleCalendarEvent | undefined;
  try {
    stable = await adapters.getGoogleEvent(mapped.calendarId, mapped.eventId);
  } catch {
    await markNeedsAttention(
      appointment,
      revision,
      "google_stability_read_failed",
      observed.start,
      "mutation not attempted; existing automation generation remains active",
      "Verify Google OAuth access and retry the direct event read.",
      adapters,
    );
    return { outcome: "needs_attention", revision };
  }
  if (!stable || googleRevision(stable) !== revision) {
    return { outcome: "unstable", revision };
  }
  const acceptedAppointment = await adapters.getSalesAppointment(
    appointment.id,
  );
  if (
    !acceptedAppointment ||
    acceptedAppointment.status === "CANCELLED" ||
    acceptedAppointment.status === "COMPLETED" ||
    acceptedAppointment.currentCalBookingUid !==
      appointment.currentCalBookingUid ||
    !sameInstant(
      acceptedAppointment.scheduledStartAt,
      appointment.scheduledStartAt,
    )
  ) {
    return { outcome: "concurrent_cal_change", revision };
  }
  appointment = acceptedAppointment;
  const generation =
    appointment.acceptedGoogleRevision === revision
      ? (appointment.automationGeneration ?? 1)
      : (appointment.automationGeneration ?? 1) + 1;
  await adapters.updateSalesAppointment(appointment.id, {
    synchronizationStatus: "RECONCILIATION_PENDING",
    acceptedGoogleRevision: revision,
    intendedStartAt: stable.start,
    automationGeneration: generation,
  });
  appointment = { ...appointment, automationGeneration: generation };
  if (Date.parse(stable.start) <= adapters.now().getTime()) {
    await markNeedsAttention(
      appointment,
      revision,
      "past_time_candidate",
      stable.start,
      "mutation blocked; old automation generation suppressed",
      "Move the Google event to a future time or repair the Sales Appointment manually.",
      adapters,
    );
    return { outcome: "past_time_rejected", revision };
  }

  try {
    let previousBooking = initialCal;
    let replacementBooking: CalBooking | undefined;
    let providerWasConverged = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const checked = await preflight(appointment.id, stable, adapters);
      if (checked.outcome === "provider_converged") {
        previousBooking = checked.previousCal ?? previousBooking;
        replacementBooking = checked.cal;
        providerWasConverged = true;
        break;
      }
      if (checked.outcome !== "ready") {
        if (
          checked.outcome === "cal_advanced" ||
          checked.outcome === "canonical_advanced" ||
          checked.outcome === "revision_advanced"
        ) {
          return { outcome: "concurrent_cal_change", revision };
        }
        throw new Error(`preflight_${checked.outcome}`);
      }
      previousBooking = checked.cal;
      await adapters.updateSalesAppointment(appointment.id, {
        synchronizationStatus: "RECONCILING",
      });
      try {
        replacementBooking = await adapters.rescheduleCalBooking({
          bookingUid: checked.cal.uid,
          start: stable.start,
          rescheduledBy: options.hostEmail,
          rescheduleWithSameHost: true,
          allowConflicts: true,
          allowBookingOutOfBounds: true,
          skipBookingLimits: true,
        });
        break;
      } catch (error) {
        if (attempt === 3 || !isTransientProviderError(error)) throw error;
        await alertTransition(
          appointment,
          revision,
          "cal_reschedule_retry",
          stable.start,
          `attempt ${attempt} failed; retrying`,
          "No action is required while automatic retries continue.",
          adapters,
        );
        await adapters.waitForRetry(attempt);
      }
    }
    if (!replacementBooking) throw new Error("cal_reschedule_omitted_booking");
    const readBack = await readBackGoogleMapping(
      { calendarId: mapped.calendarId, eventId: mapped.eventId },
      replacementBooking.uid,
      stable.start,
      adapters,
    );
    const outcome = await completeProviderSuccess(
      appointment,
      previousBooking,
      replacementBooking,
      stable.start,
      readBack.mapping,
      readBack.event,
      revision,
      adapters,
    );
    return {
      outcome: providerWasConverged ? "provider_already_converged" : outcome,
      revision,
    };
  } catch (error) {
    const classification =
      error instanceof Error ? error.message : "unknown_reconciliation_failure";
    await markNeedsAttention(
      appointment,
      revision,
      classification,
      stable.start,
      "three read-before-write attempts exhausted",
      "Google remains authoritative; inspect Cal, Google, and Twenty before retrying.",
      adapters,
    );
    return { outcome: "needs_attention", revision };
  }
};

export const synchronizationStatusNeedsObservation = (
  value: SalesAppointmentSynchronizationStatus | undefined,
) => value !== "SYNCHRONIZED";
