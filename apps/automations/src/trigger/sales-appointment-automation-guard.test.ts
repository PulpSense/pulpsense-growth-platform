import { describe, expect, it, vi } from "vitest";

import { verifySalesAppointmentAutomationGuard } from "./sales-appointment-automation-guard.js";

const guardedWork = {
  salesAppointmentId: "22222222-2222-4222-8222-222222222222",
  automationGeneration: 3,
  bookingUid: "cal-current",
  expectedStartTime: "2026-09-20T15:00:00.000Z",
};

describe("Sales Appointment automation guard", () => {
  it("fails closed without canonical identity", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      verifySalesAppointmentAutomationGuard(
        {
          bookingUid: guardedWork.bookingUid,
          expectedStartTime: guardedWork.expectedStartTime,
        },
        {},
        fetcher,
        "test",
      ),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("throws when Twenty cannot be used to prove guarded work is current", async () => {
    await expect(
      verifySalesAppointmentAutomationGuard(
        guardedWork,
        {},
        vi.fn<typeof fetch>(),
        "test",
      ),
    ).rejects.toThrow("Twenty test generation verification is not configured");
  });

  it("authorizes only the current synchronized generation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          salesAppointment: {
            automationGeneration: guardedWork.automationGeneration,
            currentCalBookingUid: guardedWork.bookingUid,
            scheduledStartAt: guardedWork.expectedStartTime,
            synchronizationStatus: "SYNCHRONIZED",
          },
        },
      }),
    );
    await expect(
      verifySalesAppointmentAutomationGuard(
        guardedWork,
        {
          TWENTY_API_ORIGIN: "https://twenty.example.com/",
          TWENTY_API_KEY: "secret",
        },
        fetcher,
        "test",
      ),
    ).resolves.toBe(true);
  });
});
