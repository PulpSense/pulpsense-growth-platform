import type {
  ApplicationSubmittedEvent,
  ContactSubmittedEvent,
} from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createPostHogLifecycleCapture,
  createPostHogPersonLinkCapture,
} from "./posthog-lifecycle.js";

const contactEvent: ContactSubmittedEvent = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "ai-seo",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  prospectId:
    "prospect_v1_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
      utmCampaign: "ai-seo",
      landingPage: "https://preview.pulpsense.com/ai-seo/",
      referrer: "https://partner.example/review",
    },
    lastTouch: { utmSource: "newsletter" },
  },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "Test Browser",
    sourceUrl: "https://preview.pulpsense.com/ai-seo/",
    analyticsId: "311de7bf-a46f-49f9-a107-5cc030e960c3",
    sessionId: "411de7bf-a46f-49f9-a107-5cc030e960c3",
  },
  environment: "preview",
};

const applicationEvent: ApplicationSubmittedEvent = {
  ...contactEvent,
  eventType: "application_submitted",
  funnelId: "ai-seo",
  eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
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
};

describe("createPostHogLifecycleCapture", () => {
  it("joins lifecycle events to the Prospect, session, and searchable properties", async () => {
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
        distinct_id: applicationEvent.prospectId,
        funnel_id: applicationEvent.funnelId,
        submission_id: applicationEvent.submissionId,
        event_id: applicationEvent.eventId,
        $insert_id: applicationEvent.eventId,
        environment: "preview",
        qualification_status: "qualified",
        $session_id: applicationEvent.requestContext.sessionId,
        first_utm_source: "meta",
        first_utm_campaign: "ai-seo",
        first_referrer_host: "partner.example",
        last_utm_source: "newsletter",
        $set: {
          email: "maya@brand.com",
          name: "Maya Chen",
          phone: "+1 555 123 4567",
          company_domain: "brand.com",
          funnel_id: "creative-multiplier-sprint",
          lead_journey_id: applicationEvent.submissionId,
          last_utm_source: "newsletter",
        },
        $set_once: expect.objectContaining({
          first_utm_source: "meta",
          first_utm_campaign: "creative-sprint",
        }),
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("private-product");
    expect(serialized).not.toContain("$50k");
  });
});

describe("createPostHogPersonLinkCapture", () => {
  it("attaches Twenty's native Person ID to the Prospect", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const capture = createPostHogPersonLinkCapture(
      { apiKey: "phc_preview", host: "https://eu.i.posthog.com" },
      { fetch: fetchMock },
    );

    await capture(contactEvent, "person_123");

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      event: "funnel_crm_person_linked",
      properties: {
        distinct_id: contactEvent.prospectId,
        $set: { twenty_person_id: "person_123" },
      },
    });
  });
});
