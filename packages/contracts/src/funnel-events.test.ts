import { describe, expect, it } from "vitest";

import {
  contactSubmissionRequestSchema,
  contactSubmittedEventSchema,
} from "./funnel-events.js";

const acceptedEvent = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "creative-multiplier-sprint",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  eventId: "contact_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-08T12:00:00.000Z",
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

describe("funnel event contract", () => {
  it("normalizes browser contact input before creating a durable event", () => {
    const request = contactSubmissionRequestSchema.parse({
      schemaVersion: 1,
      eventType: "contact_submitted",
      funnelId: "creative-multiplier-sprint",
      attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
      turnstileToken: "token",
      payload: {
        firstName: " Maya ",
        lastName: " Chen ",
        email: "MAYA@BRAND.COM",
        phone: "+1 555 123 4567",
      },
      attribution: { firstTouch: {}, lastTouch: {} },
      sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    });

    expect(request.payload).toMatchObject({
      firstName: "Maya",
      lastName: "Chen",
      email: "maya@brand.com",
    });
    expect(contactSubmittedEventSchema.parse(acceptedEvent)).toEqual(
      acceptedEvent,
    );
  });

  it("rejects unsupported schema versions at ingress and task execution", () => {
    expect(
      contactSubmissionRequestSchema.safeParse({
        ...acceptedEvent,
        schemaVersion: 2,
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
        turnstileToken: "token",
      }).success,
    ).toBe(false);
    expect(
      contactSubmittedEventSchema.safeParse({
        ...acceptedEvent,
        schemaVersion: 2,
      }).success,
    ).toBe(false);
  });
});
