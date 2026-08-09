import { describe, expect, it } from "vitest";

import worker from "./index";

describe("funnel rate-limit service", () => {
  it("allows a request accepted by Cloudflare's native limiter", async () => {
    const response = await worker.fetch(
      new Request("https://rate-limit.internal/limit", {
        method: "POST",
        body: "a".repeat(64),
      }),
      {
        FUNNEL_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
      },
    );

    expect(response.status).toBe(204);
  });

  it("rejects a request denied by Cloudflare's native limiter", async () => {
    const response = await worker.fetch(
      new Request("https://rate-limit.internal/limit", {
        method: "POST",
        body: "a".repeat(64),
      }),
      {
        FUNNEL_RATE_LIMITER: {
          limit: async () => ({ success: false }),
        },
      },
    );

    expect(response.status).toBe(429);
  });
});
