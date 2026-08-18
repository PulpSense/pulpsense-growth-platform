import { describe, expect, it } from "vitest";

import { evaluatePerformanceRuns } from "./check-release-performance.mjs";

const report = (lcpMs, cls, deckImageCount = 2) => ({
  audits: {
    "largest-contentful-paint": { numericValue: lcpMs },
    "cumulative-layout-shift": { numericValue: cls },
    "network-requests": {
      details: {
        items: Array.from({ length: deckImageCount }, (_, index) => ({
          url: `https://example.com/ai-seo/deck/slide-${String(index + 1).padStart(2, "0")}-1200.webp`,
        })),
      },
    },
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
    ).toEqual({ cls: 0.08, initialDeckImageRequests: 2, lcpMs: 2_400 });
  });

  it("rejects an LCP above 2.5 seconds", () => {
    expect(() =>
      evaluatePerformanceRuns([
        report(2_501, 0.04),
        report(2_600, 0.05),
        report(2_400, 0.06),
      ]),
    ).toThrow("LCP 2501ms does not meet the <2500ms release budget");
  });

  it("rejects CLS above 0.1", () => {
    expect(() =>
      evaluatePerformanceRuns([
        report(2_100, 0.11),
        report(2_200, 0.12),
        report(2_300, 0.09),
      ]),
    ).toThrow("CLS 0.11 does not meet the <0.1 release budget");
  });

  it("rejects raw medians at or beyond the strict release boundaries", () => {
    expect(() =>
      evaluatePerformanceRuns([
        report(2_499.9, 0.01),
        report(2_500, 0.02),
        report(2_500.4, 0.03),
      ]),
    ).toThrow("LCP 2500ms does not meet the <2500ms release budget");

    expect(() =>
      evaluatePerformanceRuns([
        report(2_100, 0.0999),
        report(2_200, 0.1),
        report(2_300, 0.1004),
      ]),
    ).toThrow("CLS 0.1 does not meet the <0.1 release budget");
  });

  it("rejects releases that eagerly request more than two deck images", () => {
    expect(() => evaluatePerformanceRuns([report(2_100, 0.01, 3)])).toThrow(
      "3 deck images loaded initially; the release budget allows at most 2",
    );
  });
});
