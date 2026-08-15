import { afterEach, describe, expect, it, vi } from "vitest";

import { handleLeadMagnetOptIn } from "./lead-magnet-opt-in";

const request = () =>
  new Request("https://preview.pulpsense.com/api/lead-magnets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://preview.pulpsense.com",
      "cf-connecting-ip": "203.0.113.10",
    },
    body: JSON.stringify({
      magnetId: "meta-offer-intelligence-skill",
      firstName: "Maya",
      email: "maya@gmail.com",
      turnstileToken: "turnstile-token",
    }),
  });

afterEach(() => vi.unstubAllGlobals());

describe("lead magnet opt-in", () => {
  it("accepts personal email and triggers a PII-free ten-minute idempotency key", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          action: "lead_magnet_submit",
          hostname: "preview.pulpsense.com",
        }),
      )
      .mockResolvedValueOnce(Response.json({ result: "ok", free: true }))
      .mockResolvedValueOnce(Response.json({ id: "run_123" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleLeadMagnetOptIn(request(), {
      FUNNEL_RATE_LIMIT_SERVICE: {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
      },
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "verifier-key",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-key",
      PULPSENSE_ENVIRONMENT: "preview",
    });

    expect(response.status).toBe(200);
    const triggerBody = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body),
    ) as {
      payload: { email: string };
      options: { idempotencyKey: string; idempotencyKeyTTL: string };
    };
    expect(triggerBody.payload.email).toBe("maya@gmail.com");
    expect(triggerBody.options.idempotencyKeyTTL).toBe("10m");
    expect(triggerBody.options.idempotencyKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(triggerBody.options.idempotencyKey).not.toContain("maya@gmail.com");
  });

  it("rejects an email the verifier identifies as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            action: "lead_magnet_submit",
            hostname: "preview.pulpsense.com",
          }),
        )
        .mockResolvedValueOnce(Response.json({ result: "invalid" })),
    );

    const response = await handleLeadMagnetOptIn(request(), {
      FUNNEL_RATE_LIMIT_SERVICE: {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
      },
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MILLION_VERIFIER_API_KEY: "verifier-key",
      PULPSENSE_TRIGGER_SECRET_KEY: "trigger-key",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "email_invalid" });
  });
});
