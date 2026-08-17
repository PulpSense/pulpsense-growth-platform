import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveTurnstileSecret,
  verifyTurnstile,
} from "./turnstile-verification";

afterEach(() => vi.unstubAllGlobals());

describe("resolveTurnstileSecret", () => {
  it("prefers an explicit test secret when the preview config supplies one", () => {
    expect(
      resolveTurnstileSecret({
        TURNSTILE_SECRET_KEY: "real-secret",
        TURNSTILE_TEST_SECRET_KEY: "test-secret",
      }),
    ).toBe("test-secret");
  });

  it("uses the real secret when no test binding exists", () => {
    expect(
      resolveTurnstileSecret({ TURNSTILE_SECRET_KEY: "real-secret" }),
    ).toBe("real-secret");
  });
});

describe("verifyTurnstile", () => {
  const request = new Request("https://preview.example.com/funnel");
  const verification = {
    request,
    token: "dummy-token",
    clientIp: "203.0.113.10",
    secret: "test-secret",
    expectedAction: "contact_submit",
  };

  it("keeps production hostname and action validation strict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          action: "test",
          hostname: "localhost",
        }),
      ),
    );

    await expect(verifyTurnstile(verification)).resolves.toBe(false);
  });

  it("accepts successful dummy metadata only when test mode is explicit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          action: "test",
          hostname: "localhost",
        }),
      ),
    );

    await expect(
      verifyTurnstile({ ...verification, acceptTestMetadata: true }),
    ).resolves.toBe(true);
  });
});
