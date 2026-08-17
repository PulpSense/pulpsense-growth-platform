import { describe, expect, it } from "vitest";

import { resolveTurnstileSecret } from "./turnstile-verification";

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
