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
  return Boolean(
    appointment &&
      appointment.automationGeneration === payload.automationGeneration &&
      appointment.currentCalBookingUid === payload.bookingUid &&
      new Date(String(appointment.scheduledStartAt ?? "invalid")).getTime() ===
        new Date(payload.expectedStartTime).getTime() &&
      appointment.synchronizationStatus === "SYNCHRONIZED",
  );
};
