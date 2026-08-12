import { describe, expect, it } from "vitest";

import {
  applicationSubmittedEventSchema,
  bookingCancelledEventSchema,
  bookingCompletedEventSchema,
  bookingRescheduledEventSchema,
  contactSubmittedEventSchema,
  funnelEventSchema,
} from "./funnel-events.js";

const acceptedEvent = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "ai-seo",
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
    sourceUrl: "https://preview.pulpsense.com/ai-seo/",
  },
  environment: "preview",
};

describe("funnel event contract", () => {
  it("accepts the contact event consumed by both apps", () => {
    expect(contactSubmittedEventSchema.parse(acceptedEvent)).toEqual(
      acceptedEvent,
    );
  });

  it("normalizes an omitted AI SEO last name and accepts its owner qualification", () => {
    const aiSeoContact = contactSubmittedEventSchema.parse({
      ...acceptedEvent,
      funnelId: "ai-seo",
      payload: {
        firstName: "Maya",
        email: "maya@brand.com",
        phone: "+1 555 123 4567",
        emailVerification: { status: "verified", result: "business" },
      },
      requestContext: {
        ...acceptedEvent.requestContext,
        sourceUrl: "https://preview.pulpsense.com/ai-seo/",
      },
    });
    expect(aiSeoContact.payload.lastName).toBe("");

    expect(
      applicationSubmittedEventSchema.parse({
        ...aiSeoContact,
        eventType: "application_submitted",
        eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
        payload: {
          ...aiSeoContact.payload,
          application: {
            businessOwner: "yes",
            marketingBudget: "$1,500+/month",
            investmentIntent: "Yes, if the numbers make sense",
          },
        },
        qualificationStatus: "qualified",
        companyDomain: "brand.com",
      }),
    ).toMatchObject({
      funnelId: "ai-seo",
      payload: {
        application: {
          businessOwner: "yes",
          marketingBudget: "$1,500+/month",
          investmentIntent: "Yes, if the numbers make sense",
        },
      },
    });
  });

  it("accepts the dentist AI SEO identity with the shared AI SEO payload", () => {
    const dentistContact = contactSubmittedEventSchema.parse({
      ...acceptedEvent,
      funnelId: "ai-seo-dentists",
      requestContext: {
        ...acceptedEvent.requestContext,
        sourceUrl: "https://preview.pulpsense.com/ai-seo/",
      },
    });

    expect(
      applicationSubmittedEventSchema.parse({
        ...dentistContact,
        eventType: "application_submitted",
        eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
        payload: {
          ...dentistContact.payload,
          application: {
            businessOwner: "yes",
            marketingBudget: "$1,500+/month",
            investmentIntent: "Yes, if the numbers make sense",
          },
        },
        qualificationStatus: "qualified",
        companyDomain: "brand.com",
      }),
    ).toMatchObject({
      funnelId: "ai-seo-dentists",
      payload: {
        application: {
          businessOwner: "yes",
          marketingBudget: "$1,500+/month",
          investmentIntent: "Yes, if the numbers make sense",
        },
      },
    });
  });

  it("rejects unsupported schema versions at task execution", () => {
    expect(
      contactSubmittedEventSchema.safeParse({
        ...acceptedEvent,
        schemaVersion: 2,
      }).success,
    ).toBe(false);
  });

  it("accepts an AI SEO application event in the shared union", () => {
    const applicationEvent = {
      ...acceptedEvent,
      eventType: "application_submitted",
      eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
      payload: {
        ...acceptedEvent.payload,
        application: {
          businessOwner: "yes",
          marketingBudget: "$1,500+/month",
          investmentIntent: "Yes, if the numbers make sense",
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
          title: "AI SEO Fit Call",
          startTime: "2026-08-10T14:00:00.000Z",
          endTime: "2026-08-10T14:15:00.000Z",
          attendeeTimeZone: "America/New_York",
          meetingUrl: "https://meet.example.com/cal_booking_123",
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

    const rescheduledEvent = {
      ...bookingEvent,
      eventType: "booking_rescheduled",
      eventId: "booking_rescheduled:cal_booking_456",
      payload: {
        ...bookingEvent.payload,
        booking: {
          ...bookingEvent.payload.booking,
          uid: "cal_booking_456",
          previousUid: "cal_booking_123",
          previousStartTime: bookingEvent.payload.booking.startTime,
          previousEndTime: bookingEvent.payload.booking.endTime,
          startTime: "2026-08-11T14:00:00.000Z",
          endTime: "2026-08-11T14:15:00.000Z",
        },
      },
    } as const;
    expect(bookingRescheduledEventSchema.parse(rescheduledEvent)).toEqual(
      rescheduledEvent,
    );
    expect(funnelEventSchema.parse(rescheduledEvent)).toEqual(rescheduledEvent);

    const cancelledEvent = {
      ...bookingEvent,
      eventType: "booking_cancelled",
      eventId: "booking_cancelled:cal_booking_123",
      payload: {
        ...bookingEvent.payload,
        booking: {
          ...bookingEvent.payload.booking,
          cancellationReason: "No longer available",
        },
      },
    } as const;
    expect(bookingCancelledEventSchema.parse(cancelledEvent)).toEqual(
      cancelledEvent,
    );
    expect(funnelEventSchema.parse(cancelledEvent)).toEqual(cancelledEvent);
  });
});
