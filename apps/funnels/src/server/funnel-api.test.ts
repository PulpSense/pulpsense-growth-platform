import { afterEach, describe, expect, it, vi } from "vitest";

import { handleCalWebhook } from "./booking-webhook";
import { handleFunnelEvent } from "./contact-submission";
import { handleVerifyEmail } from "./email-verification";
import { handleMetaCapi } from "./meta-conversions";

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

const allowingRateLimit = {
  FUNNEL_RATE_LIMIT_SERVICE: {
    fetch: async () => new Response(null, { status: 204 }),
  },
};

const qualifiedApplicationRequest = (identity: {
  submissionId: string;
  token: string;
}) =>
  requestWithBody({
    schemaVersion: 1,
    eventType: "application_submitted",
    funnelId: "creative-multiplier-sprint",
    identity,
    payload: {
      brandUrl: "https://www.brand.com/products",
      paidSocialSpend: "$50k - $150k/month",
      winnerStatus: "Yes, several winners",
      platforms: ["Meta", "TikTok"],
      deliveryTimeline: "Next 2 weeks",
    },
    sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
  });

const signCalBody = async (body: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );

  return Array.from(signature, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

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
        FUNNEL_RATE_LIMIT_SERVICE: {
          fetch: async () => new Response(null, { status: 429 }),
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
        ...allowingRateLimit,
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
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
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
        ...allowingRateLimit,
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
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
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
        ...allowingRateLimit,
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

  it("accepts an AI SEO owner with an optional last name and returns a signed Cal identity", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_contact" }))
      .mockResolvedValueOnce(Response.json({ id: "run_application" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };

    const contactResponse = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "contact_submitted",
        funnelId: "ai-seo",
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
        turnstileToken: "turnstile-token",
        payload: {
          firstName: "Maya",
          email: "maya@brand.com",
          phone: "+1 (555) 123-4567",
        },
        attribution: { firstTouch: {}, lastTouch: {} },
        sourceUrl: "https://preview.pulpsense.com/ai-seo/",
      }),
      env,
    );
    expect(contactResponse.status).toBe(200);
    const contact = (await contactResponse.json()) as {
      submissionId: string;
      retry: { submissionId: string; token: string };
    };

    const applicationResponse = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "application_submitted",
        funnelId: "ai-seo",
        identity: contact.retry,
        payload: {
          businessOwner: "yes",
          marketingBudget: "$1,500+/month",
          investmentIntent: "Yes, if the numbers make sense",
        },
        sourceUrl: "https://preview.pulpsense.com/ai-seo/",
      }),
      env,
    );

    expect(applicationResponse.status).toBe(200);
    await expect(applicationResponse.json()).resolves.toMatchObject({
      accepted: true,
      submissionId: contact.submissionId,
      qualificationStatus: "qualified",
      nextStep: "booking",
      bookingIdentity: { submissionId: contact.submissionId },
      runId: "run_application",
    });

    const contactTriggerBody = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body),
    );
    expect(contactTriggerBody.payload).toMatchObject({
      funnelId: "ai-seo",
      payload: { firstName: "Maya", lastName: "" },
    });
    const applicationTriggerBody = JSON.parse(
      String(fetchMock.mock.calls[3]?.[1]?.body),
    );
    expect(applicationTriggerBody.payload).toMatchObject({
      funnelId: "ai-seo",
      qualificationStatus: "qualified",
      payload: {
        application: {
          businessOwner: "yes",
          marketingBudget: "$1,500+/month",
          investmentIntent: "Yes, if the numbers make sense",
        },
      },
    });
  });

  it("calculates an unqualified application on the server before allowing navigation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_contact" }))
      .mockResolvedValueOnce(Response.json({ id: "run_application" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };

    const contactResponse = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      env,
    );
    const contact = (await contactResponse.json()) as {
      submissionId: string;
      retry: { submissionId: string; token: string };
    };
    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "application_submitted",
        funnelId: "creative-multiplier-sprint",
        identity: contact.retry,
        payload: {
          brandUrl: "https://www.brand.com/products",
          paidSocialSpend: "Less than $20k/month",
          winnerStatus: "Yes, several winners",
          platforms: ["Meta", "TikTok"],
          deliveryTimeline: "Next 2 weeks",
        },
        sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      }),
      env,
    );

    expect(response.status).toBe(200);
    const applicationResult = (await response.json()) as Record<
      string,
      unknown
    >;
    expect(applicationResult).toMatchObject({
      accepted: true,
      submissionId: contact.submissionId,
      eventId: `application_submitted:${contact.submissionId}`,
      qualificationStatus: "unqualified",
      nextStep: "unqualified",
      runId: "run_application",
    });
    expect(applicationResult).not.toHaveProperty("bookingIdentity");

    const applicationTriggerBody = JSON.parse(
      String(fetchMock.mock.calls[3]?.[1]?.body),
    ) as {
      payload: {
        eventType: string;
        submissionId: string;
        qualificationStatus: string;
      };
      options: { idempotencyKey: string };
    };
    expect(applicationTriggerBody).toMatchObject({
      payload: {
        eventType: "application_submitted",
        submissionId: contact.submissionId,
        qualificationStatus: "unqualified",
      },
      options: {
        idempotencyKey: `application_submitted:${contact.submissionId}`,
      },
    });
  });

  it("rejects a client-supplied qualification result", async () => {
    const response = await handleFunnelEvent(
      requestWithBody({
        schemaVersion: 1,
        eventType: "application_submitted",
        funnelId: "creative-multiplier-sprint",
        identity: {
          submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
          token: "client-token",
        },
        payload: {
          brandUrl: "https://brand.com",
          paidSocialSpend: "Less than $20k/month",
          winnerStatus: "No proven winner yet",
          platforms: ["Meta"],
          deliveryTimeline: "This week",
          qualificationStatus: "qualified",
        },
        sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
      }),
      allowingRateLimit,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
    });
  });

  it("reuses the application event identity when durable handoff is retried", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_contact" }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(Response.json({ id: "run_application_retry" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };
    const contactResponse = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      env,
    );
    const contact = (await contactResponse.json()) as {
      retry: { submissionId: string; token: string };
    };
    const applicationBody = {
      schemaVersion: 1,
      eventType: "application_submitted",
      funnelId: "creative-multiplier-sprint",
      identity: contact.retry,
      payload: {
        brandUrl: "https://brand.com",
        paidSocialSpend: "$20k - $50k/month",
        winnerStatus: "Yes, one clear winner",
        platforms: ["Meta"],
        deliveryTimeline: "This week",
      },
      sourceUrl: "https://preview.pulpsense.com/creative-multiplier-sprint/",
    };

    const failedResponse = await handleFunnelEvent(
      requestWithBody(applicationBody),
      env,
    );
    const failed = (await failedResponse.json()) as { eventId: string };
    expect(failedResponse.status).toBe(502);

    const retriedResponse = await handleFunnelEvent(
      requestWithBody(applicationBody),
      env,
    );
    expect(retriedResponse.status).toBe(200);
    await expect(retriedResponse.json()).resolves.toMatchObject({
      accepted: true,
      eventId: failed.eventId,
      runId: "run_application_retry",
    });
    for (const callIndex of [3, 4]) {
      const triggerBody = JSON.parse(
        String(fetchMock.mock.calls[callIndex]?.[1]?.body),
      );
      expect(triggerBody.options.idempotencyKey).toBe(failed.eventId);
    }
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
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
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

    const retriedBody = await retriedResponse.json();
    expect({ status: retriedResponse.status, body: retriedBody }).toMatchObject(
      {
        status: 200,
        body: {
          accepted: true,
          submissionId: failed.submissionId,
          eventId: failed.eventId,
          runId: "run_retry",
        },
      },
    );
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
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_after_retry" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
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

  it("does not reuse an accepted identity when contact data changes", async () => {
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
    const turnstileResult = {
      success: true,
      action: "contact_submit",
      hostname: "preview.pulpsense.com",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(turnstileResult))
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_original" }))
      .mockResolvedValueOnce(Response.json(turnstileResult))
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_changed" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };

    const originalResponse = await handleFunnelEvent(
      requestWithBody(body),
      env,
    );
    const original = (await originalResponse.json()) as { eventId: string };
    const changedResponse = await handleFunnelEvent(
      requestWithBody({
        ...body,
        payload: { ...body.payload, email: "maya@new-brand.com" },
      }),
      env,
    );
    const changed = (await changedResponse.json()) as { eventId: string };

    expect(originalResponse.status).toBe(200);
    expect(changedResponse.status).toBe(200);
    expect(changed.eventId).not.toBe(original.eventId);
  });

  it("issues a new submission identity for an intentional later attempt", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    for (const runId of ["run_first", "run_later"]) {
      fetchMock
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            action: "contact_submit",
            hostname: "preview.pulpsense.com",
          }),
        )
        .mockResolvedValueOnce(Response.json({ result: "ok" }))
        .mockResolvedValueOnce(Response.json({ id: runId }));
    }
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
    };
    const requestBody = {
      schemaVersion: 1,
      eventType: "contact_submitted",
      funnelId: "creative-multiplier-sprint",
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

    const firstResponse = await handleFunnelEvent(
      requestWithBody({
        ...requestBody,
        attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
      }),
      env,
    );
    const first = (await firstResponse.json()) as { submissionId: string };
    const laterResponse = await handleFunnelEvent(
      requestWithBody({
        ...requestBody,
        attemptId: "b85d1114-e037-426d-ace4-d90093b7c31f",
      }),
      env,
    );
    const later = (await laterResponse.json()) as { submissionId: string };

    expect(first.submissionId).not.toBe(later.submissionId);
  });

  it("rejects a Turnstile token minted for another hostname", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "attacker.example",
        }),
      ),
    );

    const response = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      {
        ...allowingRateLimit,
        TURNSTILE_SECRET_KEY: "turnstile-secret",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "turnstile_rejected",
    });
  });

  it("rejects a free mailbox identified by the verifier", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok", free: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      {
        ...allowingRateLimit,
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        MILLION_VERIFIER_API_KEY: "million-verifier-key",
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "email_invalid",
    });
  });
});

describe("POST /api/webhooks/cal", () => {
  it("rejects a webhook whose Cal signature is invalid", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleCalWebhook(
      new Request("https://preview.pulpsense.com/api/webhooks/cal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cal-signature-256": "invalid",
        },
        body: JSON.stringify({
          triggerEvent: "BOOKING_CREATED",
          createdAt: "2026-08-09T12:00:00.000Z",
          payload: {},
        }),
      }),
      {
        CAL_WEBHOOK_SECRET: "cal-webhook-secret",
        SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_cal_signature",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a verified booking and reuses its idempotency key for a duplicate webhook", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_contact" }))
      .mockResolvedValueOnce(Response.json({ id: "run_application" }))
      .mockResolvedValueOnce(Response.json({ id: "run_booking" }))
      .mockResolvedValueOnce(Response.json({ id: "run_booking" }))
      .mockResolvedValueOnce(Response.json({ id: "run_reschedule" }))
      .mockResolvedValueOnce(Response.json({ id: "run_cancel" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
      CAL_WEBHOOK_SECRET: "cal-webhook-secret",
    };
    const contactResponse = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      env,
    );
    const contact = (await contactResponse.json()) as {
      submissionId: string;
      retry: { submissionId: string; token: string };
    };
    const applicationResponse = await handleFunnelEvent(
      qualifiedApplicationRequest(contact.retry),
      env,
    );
    const application = (await applicationResponse.json()) as {
      nextStep: string;
      bookingIdentity?: { submissionId: string; token: string };
    };
    expect(application).toMatchObject({
      nextStep: "booking",
      bookingIdentity: { submissionId: contact.submissionId },
    });
    expect(application.bookingIdentity?.token).toMatch(/^v1\./u);
    expect(application.bookingIdentity?.token).not.toContain("maya@brand.com");

    const calBody = JSON.stringify({
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2026-08-09T12:00:00.000Z",
      payload: {
        type: "funnel",
        status: "ACCEPTED",
        uid: "cal_booking_123",
        title: "Creative Multiplier Sprint Fit Call",
        startTime: "2026-08-10T14:00:00.000Z",
        endTime: "2026-08-10T14:15:00.000Z",
        attendees: [{ email: "maya@brand.com", timeZone: "America/New_York" }],
        metadata: {
          pulpsenseSubmissionId: application.bookingIdentity?.submissionId,
          pulpsenseBookingToken: application.bookingIdentity?.token,
          videoCallUrl: "https://meet.example.com/cal_booking_123",
        },
      },
    });
    const calSignature = await signCalBody(calBody, env.CAL_WEBHOOK_SECRET);
    const request = () =>
      new Request("https://preview.pulpsense.com/api/webhooks/cal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cal-signature-256": calSignature,
        },
        body: calBody,
      });
    const response = await handleCalWebhook(request(), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      submissionId: contact.submissionId,
      eventId: "booking_completed:cal_booking_123",
      runId: "run_booking",
    });
    const triggerBody = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body));
    expect(triggerBody).toMatchObject({
      payload: {
        eventType: "booking_completed",
        submissionId: contact.submissionId,
        eventId: "booking_completed:cal_booking_123",
        qualificationStatus: "qualified",
        payload: {
          email: "maya@brand.com",
          emailVerification: { status: "verified", result: "business" },
          booking: {
            uid: "cal_booking_123",
            attendeeTimeZone: "America/New_York",
            meetingUrl: "https://meet.example.com/cal_booking_123",
          },
        },
      },
      options: { idempotencyKey: "booking_completed:cal_booking_123" },
    });

    const duplicateResponse = await handleCalWebhook(request(), env);
    expect(duplicateResponse.status).toBe(200);
    const duplicateTriggerBody = JSON.parse(
      String(fetchMock.mock.calls[5]?.[1]?.body),
    );
    expect(duplicateTriggerBody.options).toEqual(triggerBody.options);
    expect(duplicateTriggerBody.payload.eventId).toBe(
      triggerBody.payload.eventId,
    );

    const rescheduleBody = JSON.stringify({
      triggerEvent: "BOOKING_RESCHEDULED",
      createdAt: "2026-08-09T13:00:00.000Z",
      payload: {
        type: "funnel",
        status: "ACCEPTED",
        uid: "cal_booking_456",
        title: "Creative Multiplier Sprint Fit Call",
        startTime: "2026-08-11T14:00:00.000Z",
        endTime: "2026-08-11T14:15:00.000Z",
        rescheduleUid: "cal_booking_123",
        rescheduleStartTime: "2026-08-10T14:00:00.000Z",
        rescheduleEndTime: "2026-08-10T14:15:00.000Z",
        attendees: [{ email: "maya@brand.com", timeZone: "America/New_York" }],
        metadata: {
          pulpsenseSubmissionId: application.bookingIdentity?.submissionId,
          pulpsenseBookingToken: application.bookingIdentity?.token,
          videoCallUrl: "https://meet.example.com/cal_booking_456",
        },
      },
    });
    const rescheduleResponse = await handleCalWebhook(
      new Request("https://preview.pulpsense.com/api/webhooks/cal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cal-signature-256": await signCalBody(
            rescheduleBody,
            env.CAL_WEBHOOK_SECRET,
          ),
        },
        body: rescheduleBody,
      }),
      env,
    );
    expect(rescheduleResponse.status).toBe(200);
    const rescheduleTrigger = JSON.parse(
      String(fetchMock.mock.calls[6]?.[1]?.body),
    );
    expect(rescheduleTrigger).toMatchObject({
      payload: {
        eventType: "booking_rescheduled",
        eventId: "booking_rescheduled:cal_booking_456",
        payload: {
          booking: {
            uid: "cal_booking_456",
            previousUid: "cal_booking_123",
          },
        },
      },
      options: { idempotencyKey: "booking_rescheduled:cal_booking_456" },
    });

    const cancellationBody = JSON.stringify({
      triggerEvent: "BOOKING_CANCELLED",
      createdAt: "2026-08-09T14:00:00.000Z",
      payload: {
        type: "funnel",
        status: "CANCELLED",
        uid: "cal_booking_456",
        title: "Creative Multiplier Sprint Fit Call",
        startTime: "2026-08-11T14:00:00.000Z",
        endTime: "2026-08-11T14:15:00.000Z",
        cancellationReason: "No longer available",
        attendees: [{ email: "maya@brand.com", timeZone: "America/New_York" }],
        metadata: {
          pulpsenseSubmissionId: application.bookingIdentity?.submissionId,
          pulpsenseBookingToken: application.bookingIdentity?.token,
          videoCallUrl: "https://meet.example.com/cal_booking_456",
        },
      },
    });
    const cancellationResponse = await handleCalWebhook(
      new Request("https://preview.pulpsense.com/api/webhooks/cal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cal-signature-256": await signCalBody(
            cancellationBody,
            env.CAL_WEBHOOK_SECRET,
          ),
        },
        body: cancellationBody,
      }),
      env,
    );
    expect(cancellationResponse.status).toBe(200);
    const cancellationTrigger = JSON.parse(
      String(fetchMock.mock.calls[7]?.[1]?.body),
    );
    expect(cancellationTrigger).toMatchObject({
      payload: {
        eventType: "booking_cancelled",
        eventId: "booking_cancelled:cal_booking_456",
        payload: {
          booking: {
            uid: "cal_booking_456",
            cancellationReason: "No longer available",
          },
        },
      },
      options: { idempotencyKey: "booking_cancelled:cal_booking_456" },
    });
  });

  it("allows booking for a qualified applicant when the email verifier fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockRejectedValueOnce(new Error("verifier offline"))
      .mockResolvedValueOnce(Response.json({ Status: 0 }))
      .mockResolvedValueOnce(Response.json({ id: "run_contact" }))
      .mockResolvedValueOnce(Response.json({ id: "run_application" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
      CAL_WEBHOOK_SECRET: "cal-webhook-secret",
    };
    const contactResponse = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      env,
    );
    const contact = (await contactResponse.json()) as {
      retry: { submissionId: string; token: string };
    };
    const applicationResponse = await handleFunnelEvent(
      qualifiedApplicationRequest(contact.retry),
      env,
    );

    await expect(applicationResponse.json()).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        qualificationStatus: "qualified",
        nextStep: "booking",
        bookingIdentity: expect.any(Object),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects a booking correlated with contact identity instead of qualified booking identity", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "contact_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok" }))
      .mockResolvedValueOnce(Response.json({ id: "run_contact" }));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...allowingRateLimit,
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
      SUBMISSION_SIGNING_SECRET: "submission-signing-secret",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-secret",
      PULPSENSE_ENVIRONMENT: "preview" as const,
      CAL_WEBHOOK_SECRET: "cal-webhook-secret",
    };
    const contactResponse = await handleFunnelEvent(
      contactRequest("https://preview.pulpsense.com"),
      env,
    );
    const contact = (await contactResponse.json()) as {
      submissionId: string;
      retry: { submissionId: string; token: string };
    };
    const calBody = JSON.stringify({
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2026-08-09T12:00:00.000Z",
      payload: {
        type: "funnel",
        status: "ACCEPTED",
        uid: "cal_booking_forged",
        title: "Creative Multiplier Sprint Fit Call",
        startTime: "2026-08-10T14:00:00.000Z",
        endTime: "2026-08-10T14:15:00.000Z",
        attendees: [{ email: "maya@brand.com", timeZone: "America/New_York" }],
        metadata: {
          pulpsenseSubmissionId: contact.submissionId,
          pulpsenseBookingToken: contact.retry.token,
          videoCallUrl: "https://meet.example.com/cal_booking_forged",
        },
      },
    });
    const response = await handleCalWebhook(
      new Request("https://preview.pulpsense.com/api/webhooks/cal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cal-signature-256": await signCalBody(
            calBody,
            env.CAL_WEBHOOK_SECRET,
          ),
        },
        body: calBody,
      }),
      env,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "booking_not_eligible",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("browser booking boundaries", () => {
  it("rejects a browser-originated Meta Schedule CAPI event", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleMetaCapi(
      new Request("https://preview.pulpsense.com/api/meta-capi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_name: "Schedule",
          event_id: "browser-forged-schedule",
          event_source_url:
            "https://preview.pulpsense.com/creative-multiplier-sprint/",
        }),
      }),
      {
        META_PIXEL_ID: "pixel_123",
        META_CAPI_ACCESS_TOKEN: "meta-token",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "authoritative_booking_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("rate limits verification requests before calling the provider", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://preview.pulpsense.com",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ email: "maya@brand.com" }),
      },
    );

    const response = await handleVerifyEmail(request, {
      FUNNEL_RATE_LIMIT_SERVICE: {
        fetch: async () => new Response(null, { status: 429 }),
      },
    });

    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns catch-all domains as unverified", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ result: "catch_all", free: false })),
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
      ...allowingRateLimit,
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "unverified",
      result: "catch_all",
    });
  });

  it("bypasses MillionVerifier for Santi's email only", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://preview.pulpsense.com",
        },
        body: JSON.stringify({ email: "  SANTI@PULPSENSE.COM " }),
      },
    );

    const response = await handleVerifyEmail(request, allowingRateLimit);

    await expect(response.json()).resolves.toEqual({
      valid: true,
      status: "verified",
      result: "business",
    });
    expect(fetchMock).not.toHaveBeenCalled();
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
      ...allowingRateLimit,
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "invalid",
      result: "invalid",
    });
  });

  it("does not mark an email as verified when the provider fails", async () => {
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
      ...allowingRateLimit,
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "unverified",
      result: "provider_error",
    });
  });

  it("does not mark an email as verified for a verifier infrastructure error", async () => {
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
      ...allowingRateLimit,
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "unverified",
      result: "provider_error",
    });
  });

  it("rejects a nonexistent domain when the email verifier is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({ error: "unavailable" }, { status: 503 }),
        )
        .mockResolvedValueOnce(Response.json({ Status: 3 })),
    );
    const request = new Request(
      "https://preview.pulpsense.com/api/verify-email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://preview.pulpsense.com",
        },
        body: JSON.stringify({ email: "asdf@alksjdf.com" }),
      },
    );

    const response = await handleVerifyEmail(request, {
      ...allowingRateLimit,
      MILLION_VERIFIER_API_KEY: "million-verifier-key",
    });

    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "invalid",
      result: "invalid",
    });
  });
});
