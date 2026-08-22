import { afterEach, describe, expect, it, vi } from "vitest";

import { handleTwentySalesWebhook } from "./twenty-sales-webhook";

afterEach(() => vi.unstubAllGlobals());

const secret = "twenty-webhook-secret";
const workspaceId = "production-workspace";

const sign = async (timestamp: string, body: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}:${body}`),
    ),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const payload = (overrides: Record<string, unknown> = {}) => ({
  targetUrl: "https://go.pulpsense.com/api/webhooks/twenty",
  webhookId: "webhook-1",
  eventName: "opportunity.updated",
  workspaceId,
  objectMetadata: { id: "object-1", nameSingular: "opportunity" },
  eventDate: "2026-08-15T10:00:00.000Z",
  record: {
    id: "opportunity-1",
    pointOfContactId: "person-1",
    prospectId: `prospect_v1_${"a".repeat(64)}`,
    originatingLeadJourneyId: "8be0f734-f3c9-4c8c-b4f8-7897f6285f12",
    stage: "NEW_DEALS_WON",
    amount: { amountMicros: 12_500_000_000, currencyCode: "USD" },
  },
  updatedFields: ["stage"],
  ...overrides,
});

const requestFor = async (value: unknown, timestamp = String(Date.now())) => {
  const body = JSON.stringify(value);
  return new Request("https://go.pulpsense.com/api/webhooks/twenty", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-twenty-webhook-timestamp": timestamp,
      "x-twenty-webhook-signature": await sign(timestamp, body),
    },
    body,
  });
};

const env = {
  TWENTY_WEBHOOK_SECRET: secret,
  TWENTY_PRODUCTION_WORKSPACE_ID: workspaceId,
  PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
  PULPSENSE_TRIGGER_API_ORIGIN: "https://trigger.test",
  PULPSENSE_ENVIRONMENT: "production" as const,
};

describe("POST /api/webhooks/twenty", () => {
  it("verifies the exact raw body and returns only after durable enqueue", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ id: "run-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleTwentySalesWebhook(
      await requestFor(payload()),
      env,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      runId: "run-1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://trigger.test/api/v1/tasks/process-twenty-sales-outcome/trigger",
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      payload: { isTest: false },
    });
  });

  it("preserves the test marker for downstream measurement suppression", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: "run-test" }));
    vi.stubGlobal("fetch", fetchMock);
    const value = payload();

    const response = await handleTwentySalesWebhook(
      await requestFor({
        ...value,
        record: { ...value.record, isTest: true },
      }),
      env,
    );

    expect(response.status).toBe(202);
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      payload: { isTest: true },
    });
  });

  it("reuses the Trigger idempotency key for a duplicate signed delivery", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ id: "run-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const duplicatePayload = payload();

    const first = await handleTwentySalesWebhook(
      await requestFor(duplicatePayload),
      env,
    );
    const duplicate = await handleTwentySalesWebhook(
      await requestFor(duplicatePayload),
      env,
    );

    expect(first.status).toBe(202);
    expect(duplicate.status).toBe(202);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const duplicateBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    );
    expect(duplicateBody.options.idempotencyKey).toBe(
      firstBody.options.idempotencyKey,
    );
  });

  it("rejects an invalid signature before enqueue", async () => {
    const request = await requestFor(payload());
    request.headers.set("x-twenty-webhook-signature", "00".repeat(32));
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleTwentySalesWebhook(request, env);

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects stale signed requests", async () => {
    const response = await handleTwentySalesWebhook(
      await requestFor(payload(), String(Date.now() - 6 * 60_000)),
      env,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "stale_twenty_webhook",
    });
  });

  it("acknowledges non-production workspace and intermediate updates", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const wrongWorkspace = await handleTwentySalesWebhook(
      await requestFor(payload({ workspaceId: "sandbox" })),
      env,
    );
    const intermediate = await handleTwentySalesWebhook(
      await requestFor(payload({ updatedFields: ["name"] })),
      env,
    );

    expect(wrongWorkspace.status).toBe(202);
    expect(intermediate.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enqueues a signed currency-only change for terminal classification", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: "run-currency" }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleTwentySalesWebhook(
      await requestFor(payload({ updatedFields: ["amount.currencyCode"] })),
      env,
    );
    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("durably enqueues a won stage update while revenue is still pending", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: "run-pending-revenue" }));
    vi.stubGlobal("fetch", fetchMock);
    const value = payload();

    const response = await handleTwentySalesWebhook(
      await requestFor({
        ...value,
        record: {
          ...value.record,
          amount: { amountMicros: null, currencyCode: null },
        },
      }),
      env,
    );

    expect(response.status).toBe(202);
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      payload: {
        stageValue: "NEW_DEALS_WON",
        updatedFields: ["stage"],
      },
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).payload,
    ).not.toHaveProperty("amount");
  });

  it("rejects terminal updates without required CRM references", async () => {
    const valid = payload();
    const invalid = {
      ...valid,
      record: { ...valid.record, originatingLeadJourneyId: undefined },
    };
    const response = await handleTwentySalesWebhook(
      await requestFor(invalid),
      env,
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "twenty_sales_references_missing",
    });
  });
});
