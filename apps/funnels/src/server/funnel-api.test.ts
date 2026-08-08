import { afterEach, describe, expect, it, vi } from "vitest";

import { handleFunnelEvent, handleVerifyEmail } from "./funnel-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

const contactRequest = (origin: string) =>
  new Request("https://preview.pulpsense.com/api/funnel-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({
      schemaVersion: 1,
      eventType: "contact_submitted",
      funnelId: "creative-multiplier-sprint",
      attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
      turnstileToken: "turnstile-token",
      payload: {
        firstName: "Maya",
        lastName: "Chen",
        email: "maya@brand.com",
        phone: "+1 555 123 4567",
      },
      attribution: {
        firstTouch: { utmSource: "meta" },
        lastTouch: { utmSource: "meta" },
      },
      sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    }),
  });

const requestWithBody = (body: unknown) =>
  new Request("https://preview.pulpsense.com/api/funnel-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://preview.pulpsense.com",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/funnel-events", () => {
  it("rejects cross-origin contact submissions", async () => {
    const response = await handleFunnelEvent(
      contactRequest("https://attacker.example"),
      {},
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "origin_not_allowed",
    });
  });

  it("rejects contact payloads that do not match the supported schema", async () => {
    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 999,
        eventType: "contact_submitted",
        funnelId: "creative-multiplier-sprint",
        payload: { email: "not-an-email" },
      }),
      {},
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    });
  });

  it("rate limits contact submissions by request IP", async () => {
    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "contact_submitted",
        funnelId: "creative-multiplier-sprint",
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
        turnstileToken: "turnstile-token",
        payload: {
          firstName: "Maya",
          lastName: "Chen",
          email: "maya@brand.com",
          phone: "+1 555 123 4567",
        },
        attribution: { firstTouch: {}, lastTouch: {} },
        sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      }),
      {
        FUNNEL_RATE_LIMITER: {
          limit: async () => ({ success: false }),
        },
      },
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "rate_limited",
    });
  });

  it("rejects contact submissions that fail Turnstile verification", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ success: false }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "contact_submitted",
        funnelId: "creative-multiplier-sprint",
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
        turnstileToken: "turnstile-token",
        payload: {
          firstName: "Maya",
          lastName: "Chen",
          email: "maya@brand.com",
          phone: "+1 555 123 4567",
        },
        attribution: { firstTouch: {}, lastTouch: {} },
        sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      }),
      {
        FUNNEL_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
        TURNSTILE_SECRET_KEY: "turnstile-secret",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "turnstile_rejected",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not enqueue a contact whose email is known invalid", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "contact_submit" }),
      )
      .mockResolvedValueOnce(Response.json({ result: "invalid" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "contact_submitted",
        funnelId: "creative-multiplier-sprint",
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
        turnstileToken: "turnstile-token",
        payload: {
          firstName: "Maya",
          lastName: "Chen",
          email: "maya@brand.com",
          phone: "+1 555 123 4567",
        },
        attribution: { firstTouch: {}, lastTouch: {} },
        sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      }),
      {
        FUNNEL_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        MILLION_VERIFIER_API_KEY: "million-verifier-key",
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "email_invalid",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns server identity only after Trigger.dev accepts the event", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "contact_submit" }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_123" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "contact_submitted",
        funnelId: "creative-multiplier-sprint",
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
        turnstileToken: "turnstile-token",
        payload: {
          firstName: " Maya ",
          lastName: " Chen ",
          email: "MAYA@BRAND.COM",
          phone: "+1 555 123 4567",
        },
        attribution: {
          firstTouch: { utmSource: "meta" },
          lastTouch: { utmSource: "newsletter" },
        },
        sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
        fbp: "fb.1.123.456",
      }),
      {
        FUNNEL_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        MILLION_VERIFIER_API_KEY: "million-verifier-key",
        SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
        PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
        PULPSENSE_ENVIRONMENT: "preview",
      },
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      accepted: boolean;
      submissionId: string;
      eventId: string;
      runId: string;
      retry: { submissionId: string; token: string };
    };
    expect(result).toMatchObject({
      accepted: true,
      runId: "run_123",
      retry: { submissionId: result.submissionId },
    });
    expect(result.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.eventId).toBe(`contact_submitted:${result.submissionId}`);
    expect(result.retry.token).not.toContain("maya@brand.com");

    const [triggerUrl, triggerInit] = fetchMock.mock.calls[2]!;
    expect(String(triggerUrl)).toContain(
      "/api/v1/tasks/process-funnel-event/trigger",
    );
    const triggerBody = JSON.parse(String(triggerInit?.body)) as {
      payload: {
        submissionId: string;
        eventId: string;
        payload: { email: string; emailVerification: unknown };
      };
      options: { idempotencyKey: string };
    };
    expect(triggerBody.payload).toMatchObject({
      submissionId: result.submissionId,
      eventId: result.eventId,
      payload: {
        email: "maya@brand.com",
        emailVerification: { status: "verified", result: "business" },
      },
    });
    expect(triggerBody.options.idempotencyKey).toBe(result.eventId);
  });

  it("reuses the signed server identity when a failed handoff is retried", async () => {
    const body = {
      schemaVersion: 1,
      eventType: "contact_submitted",
      funnelId: "creative-multiplier-sprint",
      attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
      turnstileToken: "turnstile-token",
      payload: {
        firstName: "Maya",
        lastName: "Chen",
        email: "maya@brand.com",
        phone: "+1 555 123 4567",
      },
      attribution: { firstTouch: {}, lastTouch: {} },
      sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "contact_submit" }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      FUNNEL_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };

    const failedResponse = await handleFunnelEvent(requestWithBody(body), env);
    expect(failedResponse.status).toBe(502);
    const failed = (await failedResponse.json()) as {
      submissionId: string;
      eventId: string;
      retry: { submissionId: string; token: string };
    };

    fetchMock.mockResolvedValueOnce(Response.json({ id: "run_retry" }));
    const retriedResponse = await handleFunnelEvent(
      requestWithBody({ ...body, retry: failed.retry }),
      env,
    );

    expect(retriedResponse.status).toBe(200);
    await expect(retriedResponse.json()).resolves.toMatchObject({
      accepted: true,
      submissionId: failed.submissionId,
      eventId: failed.eventId,
      runId: "run_retry",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retryTriggerBody = JSON.parse(
      String(fetchMock.mock.calls[3]?.[1]?.body),
    ) as {
      payload: { submissionId: string; eventId: string };
      options: { idempotencyKey: string };
    };
    expect(retryTriggerBody).toMatchObject({
      payload: {
        submissionId: failed.submissionId,
        eventId: failed.eventId,
      },
      options: { idempotencyKey: failed.eventId },
    });
  });

  it("derives the same server identity when a response is lost and the browser safely retries", async () => {
    const body = {
      schemaVersion: 1,
      eventType: "contact_submitted",
      funnelId: "creative-multiplier-sprint",
      attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
      turnstileToken: "turnstile-token",
      payload: {
        firstName: "Maya",
        lastName: "Chen",
        email: "maya@brand.com",
        phone: "+1 555 123 4567",
      },
      attribution: { firstTouch: {}, lastTouch: {} },
      sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "contact_submit" }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "contact_submit" }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_after_retry" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      FUNNEL_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };

    const firstResponse = await handleFunnelEvent(requestWithBody(body), env);
    expect(firstResponse.status).toBe(502);
    const first = (await firstResponse.json()) as {
      submissionId: string;
      eventId: string;
    };

    const secondResponse = await handleFunnelEvent(requestWithBody(body), env);
    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toMatchObject({
      submissionId: first.submissionId,
      eventId: first.eventId,
      runId: "run_after_retry",
    });
  });
});

describe("POST /api/verify-email", () => {
  it("rejects cross-origin verification requests", async () => {
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
        body: JSON.stringify({ email: "maya@brand.com" }),
      },
    );

    const response = await handleVerifyEmail(request, {});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "origin_not_allowed",
    });
  });

  it("fails closed for an email the verifier identifies as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ result: "invalid" })),
    );
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://preview.pulpsense.com",
        },
        body: JSON.stringify({ email: "maya@brand.com" }),
      },
    );

    const response = await handleVerifyEmail(request, {
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "invalid",
      result: "invalid",
    });
  });

  it("fails open and marks the email unverified when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("provider offline")),
    );
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://preview.pulpsense.com",
        },
        body: JSON.stringify({ email: "maya@brand.com" }),
      },
    );

    const response = await handleVerifyEmail(request, {
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: true,
      status: "unverified",
      result: "provider_error",
    });
  });

  it("fails open when the verifier responds with an infrastructure error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: "unavailable" }, { status: 503 }),
        ),
    );
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://preview.pulpsense.com",
        },
        body: JSON.stringify({ email: "maya@brand.com" }),
      },
    );

    const response = await handleVerifyEmail(request, {
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    await expect(response.json()).resolves.toEqual({
      valid: true,
      status: "unverified",
      result: "provider_error",
    });
  });
});
