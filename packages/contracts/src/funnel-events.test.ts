import { describe, expect, it } from "vitest";

import {
  applicationSubmittedEventSchema,
  bookingCompletedEventSchema,
  contactSubmittedEventSchema,
  funnelEventSchema,
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
  it("accepts the contact event consumed by both apps", () => {
    expect(contactSubmittedEventSchema.parse(acceptedEvent)).toEqual(
      acceptedEvent,
    );
  });

  it("rejects unsupported schema versions at task execution", () => {
    expect(
      contactSubmittedEventSchema.safeParse({
        ...acceptedEvent,
        schemaVersion: 2,
      }).success,
    ).toBe(false);
  });

  it("accepts a server-qualified application event in the shared union", () => {
    const applicationEvent = {
      ...acceptedEvent,
      eventType: "application_submitted",
      eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
      payload: {
        ...acceptedEvent.payload,
        application: {
          brandUrl: "https://brand.com",
          paidSocialSpend: "$20k - $50k/month",
          winnerStatus: "Yes, one clear winner",
          platforms: ["Meta"],
          deliveryTimeline: "This week",
        },
      },
      qualificationStatus: "qualified",
      companyDomain: "brand.com",
    };

    expect(applicationSubmittedEventSchema.parse(applicationEvent)).toEqual(
      applicationEvent,
    );
    expect(funnelEventSchema.parse(applicationEvent)).toEqual(applicationEvent);
  });

  it("accepts an authoritative verified booking in the shared union", () => {
    const bookingEvent = {
      ...acceptedEvent,
      eventType: "booking_completed",
      eventId: "booking_completed:cal_booking_123",
      payload: {
        ...acceptedEvent.payload,
        booking: {
          uid: "cal_booking_123",
          title: "Creative Multiplier Sprint Fit Call",
          startTime: "2026-08-10T14:00:00.000Z",
          endTime: "2026-08-10T14:15:00.000Z",
        },
      },
      qualificationStatus: "qualified",
    };

    expect(bookingCompletedEventSchema.parse(bookingEvent)).toEqual(
      bookingEvent,
    );
    expect(funnelEventSchema.parse(bookingEvent)).toEqual(bookingEvent);
    expect(
      bookingCompletedEventSchema.safeParse({
        ...bookingEvent,
        eventId: "booking_completed:different_booking",
      }).success,
    ).toBe(false);
  });
});
