import { describe, expect, it, vi } from "vitest";

import {
  accumulatedPrecallSentMask,
  deliverPrecallSequence,
  formatPrecallFailureAlert,
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
  it("formats the affected lead, failed email, progress, and impact", () => {
    const text = formatPrecallFailureAlert(
      {
        ...payload,
        salesAppointmentId: "22222222-2222-4222-8222-222222222222",
      },
      { TWENTY_API_ORIGIN: "https://pulpsense.twenty.com" },
      "https://cloud.trigger.dev/runs/run-1",
      {
        moduleId: "what-we-will-inspect",
        delivered: 2,
        total: 7,
        operation: "send",
      },
      "run-1",
    );

    expect(text).toContain("*Pre-call nurture stopped for Ada Prospect*");
    expect(text).toContain("Send what we will inspect email");
    expect(text).not.toContain("Is this just another SEO audit?");
    expect(text).toContain("2 of 7 messages delivered in this run");
    expect(text).toContain("Remaining pre-call nurture messages will not send");
    expect(text).toContain(
      "*Retry:* Exhausted — manual investigation required",
    );
    expect(text).toContain("Open appointment");
    expect(text).toContain("Journey 8d13929c");
    expect(text).toContain("Run run-1");
    expect(text).not.toContain("`production`");
  });

  it("distinguishes a delivered email from a failed state update", () => {
    const text = formatPrecallFailureAlert(
      payload,
      {},
      "https://cloud.trigger.dev/runs/run-1",
      {
        moduleId: "what-we-will-inspect",
        delivered: 3,
        total: 7,
        operation: "persist_delivery",
      },
    );

    expect(text).toContain("Record delivery of what we will inspect email");
    expect(text).toContain("3 of 7 messages delivered in this run");
    expect(text).toContain("The email was delivered");
  });

  it("labels eligibility failures without claiming an email send failed", () => {
    const text = formatPrecallFailureAlert(
      payload,
      {},
      "https://cloud.trigger.dev/runs/run-1",
      {
        moduleId: "what-we-will-inspect",
        delivered: 2,
        total: 7,
        operation: "verify_eligibility",
      },
    );

    expect(text).toContain("Verify eligibility for what we will inspect email");
    expect(text).not.toContain("*Failed step:* Send");
  });

  it("reports initial preflight failures with zero delivery progress", () => {
    const text = formatPrecallFailureAlert(
      payload,
      {},
      "https://cloud.trigger.dev/runs/run-1",
      { delivered: 0, total: 0, operation: "initial_preflight" },
    );

    expect(text).toContain(
      "Verify initial Brevo and Sales Appointment eligibility",
    );
    expect(text).toContain("0 messages delivered; schedule not started");
  });

  it("sets initial preflight before reading provider state", async () => {
    const onStep = vi.fn();
    await expect(
      deliverPrecallSequence(
        payload,
        {
          PULPSENSE_AUTOMATION_ENVIRONMENT: "production",
          PRECALL_EMAILS_ENABLED: "true",
          BREVO_API_KEY: "brevo",
          CAL_API_KEY: "cal",
        },
        {
          fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
          now: () => new Date("2026-09-01T00:00:00.000Z"),
          onStep,
        },
      ),
    ).rejects.toThrow("offline");
    expect(onStep).toHaveBeenCalledWith({
      delivered: 0,
      total: 0,
      operation: "initial_preflight",
    });
  });

  it("sets initial preflight before validating the environment", async () => {
    const onStep = vi.fn();
    await expect(
      deliverPrecallSequence(
        payload,
        {
          PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
          PRECALL_EMAILS_ENABLED: "true",
        },
        { fetch: vi.fn(), onStep },
      ),
    ).rejects.toThrow("environment does not match");
    expect(onStep).toHaveBeenCalledWith({
      delivered: 0,
      total: 0,
      operation: "initial_preflight",
    });
  });

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

  it("retries stale Brevo state after Twenty proves the replacement is current", async () => {
    let brevoReads = 0;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("twenty.example.com")) {
        return Response.json({
          salesAppointment: {
            automationGeneration: 2,
            currentCalBookingUid: payload.bookingUid,
            scheduledStartAt: payload.expectedStartTime,
            synchronizationStatus: "SYNCHRONIZED",
          },
        });
      }
      brevoReads += 1;
      return Response.json({
        emailBlacklisted: brevoReads >= 3,
        attributes: {
          PULPSENSE_PRECALL_SEQUENCE_ID:
            brevoReads >= 3 ? payload.sequenceId : "precall:old",
        },
      });
    });
    const attempt = async <Result>(operation: () => Promise<Result>) => {
      try {
        return await operation();
      } catch {
        return operation();
      }
    };

    await expect(
      deliverPrecallSequence(
        {
          ...payload,
          salesAppointmentId: "22222222-2222-4222-8222-222222222222",
          automationGeneration: 2,
        },
        {
          PULPSENSE_AUTOMATION_ENVIRONMENT: "production",
          PRECALL_EMAILS_ENABLED: "true",
          BREVO_API_KEY: "brevo",
          CAL_API_KEY: "cal",
          TWENTY_API_ORIGIN: "https://twenty.example.com",
          TWENTY_API_KEY: "twenty",
          GOOGLE_CALENDAR_RECONCILIATION_MODE: "reconcile",
          GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY: "false",
        },
        {
          fetch: fetcher,
          attempt,
          now: () => new Date("2026-09-01T00:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({ skipped: "suppressed" });
    expect(brevoReads).toBe(3);
  });
});
