import { z } from "zod";

export const salesAppointmentAutomationGuardShape = {
  salesAppointmentId: z.string().uuid().optional(),
  automationGeneration: z.number().int().positive().optional(),
};

export type SalesAppointmentAutomationGuard = {
  salesAppointmentId: string;
  automationGeneration: number;
};

type GuardedAppointmentWork = Partial<SalesAppointmentAutomationGuard> & {
  bookingUid: string;
  expectedStartTime: string;
};

type TwentyGuardEnvironment = {
  TWENTY_API_ORIGIN?: string;
  TWENTY_API_KEY?: string;
  GOOGLE_CALENDAR_RECONCILIATION_MODE?: string;
  GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST?: string;
  GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY?: string;
};

export const verifySalesAppointmentAutomationGuard = async (
  payload: GuardedAppointmentWork,
  environment: TwentyGuardEnvironment,
  fetcher: typeof fetch,
  workLabel: string,
) => {
  if (!payload.salesAppointmentId || !payload.automationGeneration) {
    return false;
  }
  if (!environment.TWENTY_API_ORIGIN || !environment.TWENTY_API_KEY) {
    throw new Error(
      `Twenty ${workLabel} generation verification is not configured`,
    );
  }
  const response = await fetcher(
    `${environment.TWENTY_API_ORIGIN.replace(/\/+$/u, "")}/rest/salesAppointments/${encodeURIComponent(payload.salesAppointmentId)}`,
    {
      headers: {
        Authorization: `Bearer ${environment.TWENTY_API_KEY}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `Twenty ${workLabel} generation verification failed (${response.status})`,
    );
  }
  const result = (await response.json()) as {
    data?: { salesAppointment?: Record<string, unknown> };
    salesAppointment?: Record<string, unknown>;
  };
  const appointment = result.data?.salesAppointment ?? result.salesAppointment;
  const canaryOnly =
    environment.GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY !== "false";
  const uidIsAllowed = new Set(
    (environment.GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
  ).has(payload.bookingUid);
  const reconciliationCanMutateThisBooking =
    environment.GOOGLE_CALENDAR_RECONCILIATION_MODE === "reconcile" &&
    (!canaryOnly || uidIsAllowed);
  const synchronizationAllowsWork =
    !reconciliationCanMutateThisBooking ||
    appointment?.synchronizationStatus === "SYNCHRONIZED";
  return Boolean(
    appointment &&
      appointment.automationGeneration === payload.automationGeneration &&
      appointment.currentCalBookingUid === payload.bookingUid &&
      new Date(String(appointment.scheduledStartAt ?? "invalid")).getTime() ===
        new Date(payload.expectedStartTime).getTime() &&
      synchronizationAllowsWork,
  );
};
