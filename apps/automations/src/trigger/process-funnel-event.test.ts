import type { ContactSubmittedEvent } from "@pulpsense/contracts";
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

describe("process-funnel-event", () => {
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
