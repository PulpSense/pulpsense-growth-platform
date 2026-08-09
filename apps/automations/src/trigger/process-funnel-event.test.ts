import type {
  ApplicationSubmittedEvent,
  BookingCompletedEvent,
  ContactSubmittedEvent,
} from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createProcessorDependencies,
  processFunnelEvent,
} from "./process-funnel-event.js";

const event: ContactSubmittedEvent = {
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
  attribution: {
    firstTouch: { utmSource: "meta" },
    lastTouch: { utmSource: "newsletter" },
  },
  requestContext: {
    clientIp: "203.0.113.10",
    userAgent: "Test Browser",
    sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    fbp: "fb.1.123.456",
  },
  environment: "preview",
};

const applicationEvent: ApplicationSubmittedEvent = {
  schemaVersion: 1,
  eventType: "application_submitted",
  funnelId: "creative-multiplier-sprint",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  eventId: "application_submitted:b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  occurredAt: "2026-08-08T12:05:00.000Z",
  payload: {
    ...event.payload,
    application: {
      brandUrl: "https://www.brand.com/products",
      paidSocialSpend: "Less than $20k/month",
      winnerStatus: "Yes, several winners",
      platforms: ["Meta", "TikTok"],
      deliveryTimeline: "Next 2 weeks",
    },
  },
  qualificationStatus: "unqualified",
  companyDomain: "brand.com",
  attribution: event.attribution,
  requestContext: event.requestContext,
  environment: "preview",
};

const qualifiedApplicationEvent: ApplicationSubmittedEvent = {
  ...applicationEvent,
  payload: {
    ...applicationEvent.payload,
    application: {
      ...applicationEvent.payload.application,
      paidSocialSpend: "$50k - $150k/month",
    },
  },
  qualificationStatus: "qualified",
};

const bookingEvent: BookingCompletedEvent = {
  schemaVersion: 1,
  eventType: "booking_completed",
  funnelId: "creative-multiplier-sprint",
  submissionId: applicationEvent.submissionId,
  eventId: "booking_completed:cal_booking_123",
  occurredAt: "2026-08-09T12:00:00.000Z",
  payload: {
    firstName: event.payload.firstName,
    lastName: event.payload.lastName,
    email: event.payload.email,
    phone: event.payload.phone,
    emailVerification: { status: "verified", result: "business" },
    booking: {
      uid: "cal_booking_123",
      title: "Creative Multiplier Sprint Fit Call",
      startTime: "2026-08-10T14:00:00.000Z",
      endTime: "2026-08-10T14:15:00.000Z",
    },
  },
  qualificationStatus: "qualified",
  attribution: event.attribution,
  requestContext: event.requestContext,
  environment: "preview",
};

describe("process-funnel-event", () => {
  it("advances the matching Opportunity and emits Schedule for a verified booking", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const recordTwentyBooking = vi.fn().mockResolvedValue({
      activityId: bookingEvent.payload.booking.uid,
      opportunityId: "opportunity_123",
    });
    const sendMetaSchedule = vi.fn().mockResolvedValue({ eventsReceived: 1 });

    const result = await processFunnelEvent(bookingEvent, {
      upsertTwentyPerson,
      recordTwentyBooking,
      sendMetaSchedule,
      sendMetaLead: vi.fn(),
      log: { info: vi.fn() },
    });

    expect(result).toEqual({
      ok: true,
      personId: "person_123",
      activityId: "cal_booking_123",
      opportunityId: "opportunity_123",
      metaEventId: "booking_completed:cal_booking_123",
    });
    expect(recordTwentyBooking).toHaveBeenCalledWith(
      bookingEvent,
      "person_123",
    );
    expect(sendMetaSchedule).toHaveBeenCalledWith(bookingEvent);
  });

  it("writes a stable booking activity, advances Call Booked, and sends the matching CAPI event", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [
                {
                  node: {
                    id: "opportunity_qualified",
                    stage: "QUALIFIED_AWAITING_BOOKING",
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_CALL_BOOKED_STAGE_VALUE: "CALL_BOOKED",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(bookingEvent, dependencies);

    expect(result).toMatchObject({
      activityId: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      opportunityId: "opportunity_qualified",
      metaEventId: bookingEvent.eventId,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      id: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      title: "Booking cal_booking_123",
      bodyV2: {
        markdown: expect.stringContaining(
          "Creative Multiplier Sprint Fit Call",
        ),
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({
      id: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      noteId: "b702e143-bcbf-5f5e-8fdd-0c4c58f2fe80",
      targetPersonId: "person_existing",
    });
    expect(fetchMock.mock.calls[5]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body))).toEqual({
      stage: "CALL_BOOKED",
    });
    const metaBody = JSON.parse(String(fetchMock.mock.calls[6]?.[1]?.body));
    expect(metaBody.data).toEqual([
      expect.objectContaining({
        event_name: "Schedule",
        event_id: bookingEvent.eventId,
      }),
    ]);
  });

  it("records every unqualified application on the Person and sends one SubmitApplication event", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const recordTwentyApplication = vi.fn().mockResolvedValue({
      activityId: applicationEvent.submissionId,
    });
    const sendMetaApplication = vi
      .fn()
      .mockResolvedValue({ eventsReceived: 1 });

    const result = await processFunnelEvent(applicationEvent, {
      upsertTwentyPerson,
      recordTwentyApplication,
      sendMetaApplication,
      sendMetaLead: vi.fn(),
      log: { info: vi.fn() },
    });

    expect(result).toEqual({
      ok: true,
      personId: "person_123",
      activityId: applicationEvent.submissionId,
      metaEventId: applicationEvent.eventId,
    });
    expect(recordTwentyApplication).toHaveBeenCalledWith(
      applicationEvent,
      "person_123",
    );
    expect(sendMetaApplication).toHaveBeenCalledOnce();
    expect(sendMetaApplication).toHaveBeenCalledWith(applicationEvent);
  });

  it("persists an unqualified application without creating an Opportunity", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_existing" } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            companies: { edges: [{ node: { id: "company_brand" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createNote: { id: applicationEvent.submissionId } },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createNoteTarget: { id: applicationEvent.submissionId } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(applicationEvent, dependencies);

    expect(result).toMatchObject({
      activityId: applicationEvent.submissionId,
      personId: "person_existing",
    });
    expect(result).not.toHaveProperty("opportunityId");
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const requests = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));
    expect(requests).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining("opportunities"),
        }),
      ]),
    );
    expect(requests).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining("/rest/companies"),
          method: "POST",
        }),
      ]),
    );
    expect(requests[2]?.body).toMatchObject({
      variables: { domainUrl: "https://brand.com" },
    });
    expect(requests[3]?.body).toMatchObject({
      id: applicationEvent.submissionId,
      title: `Application ${applicationEvent.submissionId}`,
      bodyV2: {
        markdown: expect.stringContaining(
          '"paidSocialSpend": "Less than $20k/month"',
        ),
      },
    });
    expect(requests[4]?.body).toEqual({
      id: applicationEvent.submissionId,
      noteId: applicationEvent.submissionId,
      targetPersonId: "person_existing",
    });
    expect(requests[5]?.body.data).toEqual([
      expect.objectContaining({
        event_name: "SubmitApplication",
        event_id: applicationEvent.eventId,
        custom_data: { qualification_status: "unqualified" },
      }),
    ]);
    expect(JSON.stringify(requests[5]?.body)).not.toContain(
      applicationEvent.payload.application.paidSocialSpend,
    );
  });

  it("creates an awaiting-booking Opportunity for a qualified application", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_existing" } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            companies: { edges: [{ node: { id: "company_brand" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: { createNote: {} } }))
      .mockResolvedValueOnce(Response.json({ data: { createNoteTarget: {} } }))
      .mockResolvedValueOnce(
        Response.json({ data: { opportunities: { edges: [] } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createOpportunity: { id: "opportunity_new" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(result).toMatchObject({ opportunityId: "opportunity_new" });
    const opportunityLookup = JSON.parse(
      String(fetchMock.mock.calls[5]?.[1]?.body),
    );
    expect(opportunityLookup).toMatchObject({
      variables: { personId: "person_existing" },
    });
    const [createUrl, createInit] = fetchMock.mock.calls[6]!;
    expect(String(createUrl)).toBe(
      "https://twenty.sandbox.example/rest/opportunities",
    );
    expect(createInit?.method).toBe("POST");
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: "Creative Multiplier Sprint – brand.com",
      stage: "QUALIFIED_AWAITING_BOOKING",
      pointOfContactId: "person_existing",
      companyId: "company_brand",
      brandUrl: {
        primaryLinkUrl: "https://www.brand.com/products",
        primaryLinkLabel: "www.brand.com",
        secondaryLinks: null,
      },
      paidSocialSpend: "FROM_50K_TO_150K_MONTH",
      winnerStatus: "SEVERAL_WINNERS",
      platforms: ["META", "TIKTOK"],
      deliveryTimeline: "NEXT_2_WEEKS",
    });
  });

  it("updates the existing open Opportunity for a repeat qualified application", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            companies: { edges: [{ node: { id: "company_brand" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [
                {
                  node: {
                    id: "opportunity_open",
                    stage: "CALL_BOOKED",
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(result).toMatchObject({ opportunityId: "opportunity_open" });
    const [updateUrl, updateInit] = fetchMock.mock.calls[6]!;
    expect(String(updateUrl)).toBe(
      "https://twenty.sandbox.example/rest/opportunities/opportunity_open",
    );
    expect(updateInit?.method).toBe("PATCH");
    expect(JSON.parse(String(updateInit?.body))).not.toHaveProperty("stage");
  });

  it("creates a new Opportunity when all prior Opportunities are closed", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(
        Response.json({ data: { companies: { edges: [] } } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [{ node: { id: "opportunity_won", stage: "WON" } }],
              pageInfo: { hasNextPage: true, endCursor: "page_2" },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            opportunities: {
              edges: [{ node: { id: "opportunity_lost", stage: "LOST" } }],
              pageInfo: { hasNextPage: false },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { createOpportunity: { id: "opportunity_new_attempt" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        TWENTY_QUALIFIED_STAGE_VALUE: "QUALIFIED_AWAITING_BOOKING",
        TWENTY_CLOSED_STAGE_VALUES: "WON,LOST",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(
      qualifiedApplicationEvent,
      dependencies,
    );

    expect(result).toMatchObject({
      opportunityId: "opportunity_new_attempt",
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[6]?.[1]?.body)),
    ).toMatchObject({ variables: { after: "page_2" } });
    expect(fetchMock.mock.calls[7]?.[1]?.method).toBe("POST");
  });

  it("upserts one Twenty person and sends the matching Meta Lead event", async () => {
    const upsertTwentyPerson = vi
      .fn()
      .mockResolvedValue({ personId: "person_123" });
    const sendMetaLead = vi.fn().mockResolvedValue({ eventsReceived: 1 });
    const log = { info: vi.fn() };

    const result = await processFunnelEvent(event, {
      upsertTwentyPerson,
      sendMetaLead,
      log,
    });

    expect(result).toEqual({
      ok: true,
      personId: "person_123",
      metaEventId: event.eventId,
    });
    expect(upsertTwentyPerson).toHaveBeenCalledOnce();
    expect(upsertTwentyPerson).toHaveBeenCalledWith(event);
    expect(sendMetaLead).toHaveBeenCalledOnce();
    expect(sendMetaLead).toHaveBeenCalledWith(event);

    const routineLogs = JSON.stringify(log.info.mock.calls);
    expect(routineLogs).toContain(event.submissionId);
    expect(routineLogs).not.toContain(event.payload.email);
    expect(routineLogs).not.toContain(event.payload.phone);
    expect(routineLogs).not.toContain(event.payload.firstName);
  });

  it("updates the existing Twenty person by normalized email and sends CAPI with the same event ID", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_existing" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { updatePerson: { id: "person_existing" } } }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const log = { info: vi.fn() };
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log },
    );

    await processFunnelEvent(event, dependencies);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [findUrl, findInit] = fetchMock.mock.calls[0]!;
    expect(String(findUrl)).toBe("https://twenty.sandbox.example/graphql");
    expect(JSON.parse(String(findInit?.body))).toMatchObject({
      variables: { email: "maya@brand.com" },
    });

    const [updateUrl, updateInit] = fetchMock.mock.calls[1]!;
    expect(String(updateUrl)).toBe(
      "https://twenty.sandbox.example/rest/people/person_existing",
    );
    expect(updateInit?.method).toBe("PATCH");
    expect(JSON.parse(String(updateInit?.body))).toMatchObject({
      name: { firstName: "Maya", lastName: "Chen" },
      emails: { primaryEmail: "maya@brand.com" },
    });

    const [metaUrl, metaInit] = fetchMock.mock.calls[2]!;
    expect(String(metaUrl)).toContain("/v26.0/pixel_123/events");
    const metaBody = JSON.parse(String(metaInit?.body)) as {
      data: Array<{ event_name: string; event_id: string }>;
    };
    expect(metaBody.data).toEqual([
      expect.objectContaining({
        event_name: "Lead",
        event_id: event.eventId,
      }),
    ]);
  });

  it("recovers from a concurrent Twenty create without creating a duplicate person", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: { people: { edges: [] } } }))
      .mockResolvedValueOnce(new Response("conflict", { status: 409 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            people: { edges: [{ node: { id: "person_concurrent" } }] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { updatePerson: { id: "person_concurrent" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ events_received: 1 }));
    const dependencies = createProcessorDependencies(
      {
        TWENTY_API_KEY: "twenty-sandbox-key",
        TWENTY_API_ORIGIN: "https://twenty.sandbox.example",
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-sandbox-token",
        META_GRAPH_API_VERSION: "v26.0",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
      },
      { fetch: fetchMock, log: { info: vi.fn() } },
    );

    const result = await processFunnelEvent(event, dependencies);

    expect(result.personId).toBe("person_concurrent");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe("PATCH");
  });
});
