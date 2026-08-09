import type {
  ApplicationSubmittedEvent,
  ContactSubmittedEvent,
} from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import { createPostHogLifecycleCapture } from "./posthog-lifecycle.js";

const contactEvent: ContactSubmittedEvent = {
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
      landingPage: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      referrer: "https://partner.example/review",
    },
    lastTouch: { utmSource: "newsletter" },
  },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "Test Browser",
    sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    analyticsId: "311de7bf-a46f-49f9-a107-5cc030e960c3",
  },
  environment: "preview",
};

const applicationEvent: ApplicationSubmittedEvent = {
  ...contactEvent,
  eventType: "application_submitted",
  eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  payload: {
    ...contactEvent.payload,
    application: {
      brandUrl: "https://brand.com/private-product",
      paidSocialSpend: "$50k - $150k/month",
      winnerStatus: "Yes, one clear winner",
      platforms: ["Meta"],
      deliveryTimeline: "This week",
    },
  },
  qualificationStatus: "qualified",
  companyDomain: "brand.com",
};

describe("createPostHogLifecycleCapture", () => {
  it("captures lifecycle attribution without contact or answer payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const capture = createPostHogLifecycleCapture(
      {
        apiKey: "phc_preview",
        host: "https://eu.i.posthog.com/",
      },
      { fetch: fetchMock },
    );

    await capture(applicationEvent);

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      api_key: "phc_preview",
      event: "funnel_application_submitted",
      timestamp: applicationEvent.occurredAt,
      properties: {
        distinct_id: applicationEvent.requestContext.analyticsId,
        funnel_id: applicationEvent.funnelId,
        submission_id: applicationEvent.submissionId,
        event_id: applicationEvent.eventId,
        $insert_id: applicationEvent.eventId,
        environment: "preview",
        qualification_status: "qualified",
        first_utm_source: "meta",
        first_utm_campaign: "creative-sprint",
        first_referrer_host: "partner.example",
        last_utm_source: "newsletter",
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(contactEvent.payload.email);
    expect(serialized).not.toContain(contactEvent.payload.phone);
    expect(serialized).not.toContain("private-product");
    expect(serialized).not.toContain("$50k");
  });
});
