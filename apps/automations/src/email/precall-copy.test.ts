import { describe, expect, it } from "vitest";
import { precallCopy, precallCopyById } from "./precall-copy.js";

describe("pre-call copy contract", () => {
  it("contains the 18 immutable modules", () => {
    expect(precallCopy).toHaveLength(18);
    expect(new Set(precallCopy.map((module) => module.id)).size).toBe(18);
    expect(precallCopy[0]?.id).toBe("confirmation");
    expect(precallCopy.at(-1)?.id).toBe("final-preparation");
  });

  it("keeps stable middle bit indexes", () => {
    expect(
      precallCopy
        .slice(1, -1)
        .map((module) => ("bitIndex" in module ? module.bitIndex : null)),
    ).toEqual(
      Array.from({ length: 16 }, (_, index) => index),
    );
  });

  it("never includes a meeting URL in the canonical nurture copy", () => {
    expect(JSON.stringify(precallCopy).toLowerCase()).not.toContain("meeting_url");
    expect(JSON.stringify(precallCopy).toLowerCase()).not.toContain("join link");
  });

  it("is addressable by stable module ID", () => {
    expect(precallCopyById["proof-twin-oaks"]?.role).toBe("middle");
  });
});
