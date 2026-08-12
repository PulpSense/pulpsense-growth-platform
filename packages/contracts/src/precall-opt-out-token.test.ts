import { describe, expect, it } from "vitest";
import {
  createPrecallOptOutToken,
  readPrecallOptOutToken,
} from "./precall-opt-out-token.js";

describe("pre-call opt-out token", () => {
  it("round-trips encrypted claims without exposing the email in the token", async () => {
    const claims = {
      email: "lead@example.com",
      submissionId: "00000000-0000-4000-8000-000000000001",
      sequenceId: "precall:booking:2026-08-12T16:00:00.000Z:precall-v1",
      expiresAt: Date.now() + 60_000,
    };
    const token = await createPrecallOptOutToken(claims, "secret");
    expect(token).not.toContain(claims.email);
    await expect(readPrecallOptOutToken(token, "secret")).resolves.toEqual(claims);
  });

  it("rejects tampering, a wrong secret, and expiry", async () => {
    const claims = {
      email: "lead@example.com",
      submissionId: "00000000-0000-4000-8000-000000000001",
      sequenceId: "precall:booking:time:precall-v1",
      expiresAt: 100,
    };
    const token = await createPrecallOptOutToken(claims, "secret");
    await expect(readPrecallOptOutToken(`${token}x`, "secret", 0)).rejects.toThrow();
    await expect(readPrecallOptOutToken(token, "wrong", 0)).rejects.toThrow();
    await expect(readPrecallOptOutToken(token, "secret", 101)).rejects.toThrow("Expired");
  });
});
