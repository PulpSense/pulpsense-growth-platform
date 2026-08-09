import type { ContactSubmittedEvent } from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import { processFunnelEvent } from "./process-funnel-event.js";

const event: ContactSubmittedEvent = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "creative-multiplier-sprint",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  eventId: "contact_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-09T12:00:00.000Z",
  payload: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@brand.com",
    phone: "+1 555 123 4567",
    emailVerification: { status: "verified", result: "business" },
  },
  attribution: { firstTouch: {}, lastTouch: {} },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "Test Browser",
    sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
  },
  environment: "preview",
};

describe("processFunnelEvent measurement", () => {
  it("keeps lifecycle processing successful when PostHog delivery fails", async () => {
    const capturePostHogLifecycle = vi
      .fn()
      .mockRejectedValue(new Error("PostHog unavailable"));
    const log = { info: vi.fn() };

    await expect(
      processFunnelEvent(event, {
        upsertTwentyPerson: vi
          .fn()
          .mockResolvedValue({ personId: "person_123" }),
        sendMetaLead: vi.fn().mockResolvedValue({ eventsReceived: 1 }),
        capturePostHogLifecycle,
        log,
      }),
    ).resolves.toMatchObject({ ok: true, personId: "person_123" });

    expect(capturePostHogLifecycle).toHaveBeenCalledWith(event);
    expect(log.info).toHaveBeenCalledWith("PostHog lifecycle delivery failed", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      eventType: event.eventType,
    });
    expect(JSON.stringify(log.info.mock.calls)).not.toContain(
      event.payload.email,
    );
  });
});
