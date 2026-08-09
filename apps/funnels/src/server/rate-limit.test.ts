import { describe, expect, it, vi } from "vitest";

import { consumeRateLimit } from "./rate-limit";

describe("consumeRateLimit", () => {
  it("sends only a SHA-256 digest to the private service", async () => {
    const fetch = vi.fn(
      async (_input: string, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );

    await expect(
      consumeRateLimit({ fetch }, "verify-email:203.0.113.10"),
    ).resolves.toBe("allowed");

    expect(fetch).toHaveBeenCalledOnce();
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.body).toMatch(/^[a-f0-9]{64}$/);
    expect(init?.body).not.toContain("203.0.113.10");
  });

  it("fails closed when the service call fails", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("service unavailable");
    });

    await expect(
      consumeRateLimit({ fetch }, "contact:203.0.113.10"),
    ).resolves.toBe("unavailable");
  });
});
