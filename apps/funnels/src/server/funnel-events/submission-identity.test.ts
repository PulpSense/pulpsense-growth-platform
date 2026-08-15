import { describe, expect, it } from "vitest";

import { deriveProspectId } from "./submission-identity";

describe("deriveProspectId", () => {
  it("is deterministic for equivalent normalized emails", async () => {
    const canonical = await deriveProspectId(
      "maya@brand.com",
      "production-prospect-secret",
    );

    await expect(
      deriveProspectId("  MAYA@BRAND.COM  ", "production-prospect-secret"),
    ).resolves.toBe(canonical);
    expect(canonical).toMatch(/^prospect_v1_[0-9a-f]{64}$/u);
  });

  it("changes when the email or identity secret changes", async () => {
    const canonical = await deriveProspectId(
      "maya@brand.com",
      "production-prospect-secret",
    );

    await expect(
      deriveProspectId("other@brand.com", "production-prospect-secret"),
    ).resolves.not.toBe(canonical);
    await expect(
      deriveProspectId("maya@brand.com", "rotated-prospect-secret"),
    ).resolves.not.toBe(canonical);
  });
});
