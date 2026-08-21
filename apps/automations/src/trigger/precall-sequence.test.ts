import { describe, expect, it, vi } from "vitest";

import {
  accumulatedPrecallSentMask,
  deliverPrecallSequence,
  type PrecallSequencePayload,
} from "./precall-sequence.js";

const payload: PrecallSequencePayload = {
  submissionId: "8d13929c-6c33-4369-b783-666af66bf2a2",
  firstName: "Ada",
  lastName: "Prospect",
  email: "ada@example.com",
  bookingUid: "cal-new",
  expectedStartTime: "2026-09-20T15:00:00.000Z",
  expectedEndTime: "2026-09-20T15:25:00.000Z",
  attendeeTimeZone: "America/New_York",
  funnelId: "ai-seo-med-spas",
  environment: "production",
  acquisitionSourceLabel: "an ad",
  sequenceId: "precall:cal-new:2026-09-20T15:00:00.000Z:precall-v1",
  sentMask: 0,
  isNewBooking: false,
};

describe("pre-call reschedule guards", () => {
  it("unions the durable educational mask instead of replaying it", () => {
    expect(accumulatedPrecallSentMask(0b0010, 0b0101)).toBe(0b0111);
  });

  it("fails closed when Twenty is configured but a queued run lacks a generation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        emailBlacklisted: false,
        attributes: { PULPSENSE_PRECALL_SEQUENCE_ID: payload.sequenceId },
      }),
    );
    await expect(
      deliverPrecallSequence(
        payload,
        {
          PULPSENSE_AUTOMATION_ENVIRONMENT: "production",
          PRECALL_EMAILS_ENABLED: "true",
          BREVO_API_KEY: "brevo",
          CAL_API_KEY: "cal",
          TWENTY_API_ORIGIN: "https://twenty.example.com",
          TWENTY_API_KEY: "twenty",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-09-01T00:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({ skipped: "sales_appointment_guard_failed" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
