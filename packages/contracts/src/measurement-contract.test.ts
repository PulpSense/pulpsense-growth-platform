import { describe, expect, it } from "vitest";

import { contactSubmittedEventSchema } from "./funnel-events.js";

const measuredContact = {
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
  attribution: {
    firstTouch: {
      utmSource: "meta",
      utmCampaign: "creative-sprint",
      fbclid: "fb-click-123",
      landingPage: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      referrer: "https://partner.example/review",
    },
    lastTouch: {
      utmSource: "newsletter",
      gclid: "google-click-456",
      landingPage: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      referrer: "https://newsletter.example/archive",
    },
  },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "Test Browser",
    sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    referrer: "https://newsletter.example/archive",
    fbp: "fb.1.123.456",
    fbc: "fb.1.123.fb-click-123",
    analyticsId: "311de7bf-a46f-49f9-a107-5cc030e960c3",
  },
  environment: "preview",
} as const;

describe("measurement contract", () => {
  it("keeps first-touch, last-touch, click IDs, and the anonymous analytics ID", () => {
    expect(contactSubmittedEventSchema.parse(measuredContact)).toEqual(
      measuredContact,
    );
  });

  it("rejects a non-UUID analytics identity", () => {
    expect(
      contactSubmittedEventSchema.safeParse({
        ...measuredContact,
        requestContext: {
          ...measuredContact.requestContext,
          analyticsId: "maya@brand.com",
        },
      }).success,
    ).toBe(false);
  });
});
