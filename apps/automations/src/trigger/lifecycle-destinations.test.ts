import type {
  ApplicationSubmittedEvent,
  BookingCompletedEvent,
  ContactSubmittedEvent,
} from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  postSlackBooking,
  postSlackLead,
  publishBrevoLifecycle,
} from "./lifecycle-destinations.js";

const contactEvent: ContactSubmittedEvent = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "ai-seo",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  eventId: "contact_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-10T10:00:00.000Z",
  payload: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@brand.com",
    phone: "+1 555 123 4567",
    emailVerification: { status: "verified", result: "business" },
  },
  attribution: {
    firstTouch: { utmSource: "meta" },
    lastTouch: {
      utmSource: "meta",
      utmMedium: "paid-social",
      utmCampaign: "audit",
    },
  },
  requestContext: {
    clientIp: "203.0.113.9",
    userAgent: "Browser secret",
    sourceUrl: "https://example.com/ai-seo/",
    fbc: "sensitive-click-id",
  },
  environment: "preview",
};

const applicationEvent: ApplicationSubmittedEvent = {
  ...contactEvent,
  funnelId: "ai-seo",
  eventType: "application_submitted",
  eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-10T10:01:00.000Z",
  payload: {
    ...contactEvent.payload,
    application: {
      businessOwner: "yes",
      marketingBudget: "$1,500+/month",
      investmentIntent: "Yes, if the numbers make sense",
    },
  },
  qualificationStatus: "qualified",
  companyDomain: "brand.com",
  bookingLink:
    "https://cal.com/pulpsense/ads?email=maya%40brand.com&metadata%5BpulpsenseBookingToken%5D=opaque",
};

const bookingEvent: BookingCompletedEvent = {
  ...contactEvent,
  eventType: "booking_completed",
  eventId: "booking_completed:cal_uid_123",
  occurredAt: "2026-08-10T10:02:00.000Z",
  payload: {
    ...contactEvent.payload,
    emailVerification: { status: "verified", result: "business" },
    booking: {
      uid: "cal_uid_123",
      title: "AI SEO Audit",
      startTime: "2026-08-12T14:00:00.000Z",
      endTime: "2026-08-12T14:30:00.000Z",
      attendeeTimeZone: "America/New_York",
      meetingUrl: "https://meet.example.com/cal_uid_123",
    },
  },
  qualificationStatus: "qualified",
};

const slackConfig = {
  botToken: "xoxb-test",
  channelId: "C123",
  internalBookingBaseUrl: "https://app.cal.com/booking",
};

describe("Slack lead journey delivery", () => {
  it("posts the approved contact allowlist with durable journey metadata", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ ok: true, messages: [], response_metadata: {} }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "100.200" }));

    await expect(
      postSlackLead(contactEvent, slackConfig, fetcher),
    ).resolves.toEqual({ threadTs: "100.200", created: true });
    const body = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(body).toMatchObject({
      channel: "C123",
      metadata: {
        event_type: "pulpsense_lead_journey",
        event_payload: { lead_journey_id: contactEvent.submissionId },
      },
    });
    expect(body.text).toContain("maya@brand.com");
    expect(body.text).toContain("+1 555 123 4567");
    expect(body.text).toContain("brand.com");
    expect(body.text).not.toContain(contactEvent.requestContext.clientIp);
    expect(body.text).not.toContain(contactEvent.requestContext.fbc);
  });

  it("reuses an existing root and posts one booking reply", async () => {
    const root = {
      ts: "100.200",
      metadata: {
        event_type: "pulpsense_lead_journey",
        event_payload: { lead_journey_id: contactEvent.submissionId },
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ ok: true, messages: [root], response_metadata: {} }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, messages: [root], response_metadata: {} }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "100.300" }));

    await postSlackBooking(bookingEvent, slackConfig, fetcher);
    const body = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body));
    expect(body).toMatchObject({
      channel: "C123",
      thread_ts: "100.200",
      metadata: {
        event_type: "pulpsense_booking",
        event_payload: { event_id: bookingEvent.eventId },
      },
    });
    expect(body.text).toContain("Booked");
    expect(body.text).toContain("Open booking");
    expect(body.text).not.toContain(bookingEvent.payload.email);
  });

  it("posts the booking when Slack cannot inspect a stale thread", async () => {
    const root = {
      ts: "100.200",
      metadata: {
        event_type: "pulpsense_lead_journey",
        event_payload: { lead_journey_id: contactEvent.submissionId },
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ ok: true, messages: [root], response_metadata: {} }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "invalid_arguments" }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "100.300" }));

    await expect(
      postSlackBooking(bookingEvent, slackConfig, fetcher),
    ).resolves.toMatchObject({ threadTs: "100.200", duplicate: false });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("Brevo lifecycle delivery", () => {
  it("includes a bounded Brevo validation response in a failed upsert", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        Response.json(
          { code: "invalid_parameter", message: "Unknown attribute" },
          { status: 400 },
        ),
      );

    await expect(
      publishBrevoLifecycle(
        applicationEvent,
        { apiKey: "brevo-test", adsListId: 7 },
        fetcher,
      ),
    ).rejects.toThrow(
      'Brevo contact upsert failed (400): {"code":"invalid_parameter","message":"Unknown attribute"}',
    );
  });

  it("retries without SMS when Brevo rejects the phone number", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        Response.json(
          { code: "invalid_parameter", message: "Invalid phone number" },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const invalidPhoneEvent = {
      ...applicationEvent,
      payload: { ...applicationEvent.payload, phone: "+1 (342) 342-3423" },
    };

    await expect(
      publishBrevoLifecycle(
        invalidPhoneEvent,
        { apiKey: "brevo-test", adsListId: 7 },
        fetcher,
      ),
    ).resolves.toEqual({
      published: true,
      eventName: "pulpsense_qualified_unbooked",
    });

    const retryBody = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body));
    expect(retryBody.attributes.SMS).toBeUndefined();
  });

  it("upserts only owned attributes and publishes the qualified event", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      publishBrevoLifecycle(
        applicationEvent,
        { apiKey: "brevo-test", adsListId: 7 },
        fetcher,
      ),
    ).resolves.toMatchObject({
      published: true,
      eventName: "pulpsense_qualified_unbooked",
    });
    const contactBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    const eventBody = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body));
    expect(contactBody).toMatchObject({
      email: "maya@brand.com",
      listIds: [7],
      updateEnabled: true,
      attributes: {
        FIRSTNAME: "Maya",
        LASTNAME: "Chen",
        SMS: "+15551234567",
        PULPSENSE_COMPANY_DOMAIN: "brand.com",
        PULPSENSE_LIFECYCLE_STATE: "qualified_unbooked",
      },
    });
    expect(eventBody.event_name).toBe("pulpsense_qualified_unbooked");
    expect(JSON.stringify([contactBody, eventBody])).not.toContain(
      contactEvent.requestContext.clientIp,
    );
    expect(JSON.stringify([contactBody, eventBody])).not.toContain(
      contactEvent.requestContext.fbc,
    );
  });

  it("does not regress a booked recipient into unbooked nurture", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        attributes: {
          PULPSENSE_LIFECYCLE_STATE: "booked",
          PULPSENSE_LIFECYCLE_AT: "2026-08-10T09:00:00.000Z",
        },
      }),
    );

    await expect(
      publishBrevoLifecycle(
        applicationEvent,
        { apiKey: "brevo-test", adsListId: 7 },
        fetcher,
      ),
    ).resolves.toEqual({ skipped: "stale_or_already_active" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
