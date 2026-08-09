import { describe, expect, it } from "vitest";

import { evaluatePerformanceRuns } from "./check-release-performance.mjs";

const report = (lcpMs, cls) => ({
  audits: {
    "largest-contentful-paint": { numericValue: lcpMs },
    "cumulative-layout-shift": { numericValue: cls },
  },
});

describe("release performance qualification", () => {
  it("uses the median mobile result and accepts the release budgets", () => {
    expect(
      evaluatePerformanceRuns([
        report(2_700, 0.04),
        report(2_300, 0.08),
        report(2_400, 0.12),
      ]),
    ).toEqual({ cls: 0.08, lcpMs: 2_400 });
  });

  it("rejects an LCP above 2.5 seconds", () => {
    expect(() =>
      evaluatePerformanceRuns([
        report(2_501, 0.04),
        report(2_600, 0.05),
        report(2_400, 0.06),
      ]),
    ).toThrow("LCP 2501ms exceeds the 2500ms release budget");
  });

  it("rejects CLS above 0.1", () => {
    expect(() =>
      evaluatePerformanceRuns([
        report(2_100, 0.11),
        report(2_200, 0.12),
        report(2_300, 0.09),
      ]),
    ).toThrow("CLS 0.11 exceeds the 0.1 release budget");
  });
});
