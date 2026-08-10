import { describe, expect, it } from "vitest";

import { resolveMetaEnvironment } from "./meta-destination.js";

describe("resolveMetaEnvironment", () => {
  it("uses the lawyer Meta destination for the AI SEO funnel", () => {
    expect(
      resolveMetaEnvironment(
        {
          META_PIXEL_ID: "generic-pixel",
          META_PIXEL_ID_AI_SEO_L: "lawyer-pixel",
          META_CAPI_ACCESS_TOKEN: "generic-token",
          META_CAPI_ACCESS_TOKEN_AI_SEO_L: "lawyer-token",
          META_TEST_EVENT_CODE: "GENERIC",
          META_TEST_EVENT_CODE_AI_SEO_L: "LAWYER",
        },
        "ai-seo",
      ),
    ).toEqual({
      META_PIXEL_ID: "lawyer-pixel",
      META_CAPI_ACCESS_TOKEN: "lawyer-token",
      META_TEST_EVENT_CODE: "LAWYER",
    });
  });

  it("does not fall back when the AI SEO lawyer destination is missing", () => {
    expect(
      resolveMetaEnvironment(
        {
          META_PIXEL_ID: "generic-pixel",
          META_CAPI_ACCESS_TOKEN: "generic-token",
          META_TEST_EVENT_CODE: "GENERIC",
        },
        "ai-seo",
      ),
    ).toEqual({
      META_PIXEL_ID: undefined,
      META_CAPI_ACCESS_TOKEN: undefined,
      META_TEST_EVENT_CODE: undefined,
    });
  });

  it("keeps the legacy funnel on its existing destination", () => {
    expect(
      resolveMetaEnvironment(
        {
          META_PIXEL_ID: "generic-pixel",
          META_CAPI_ACCESS_TOKEN: "generic-token",
          META_TEST_EVENT_CODE: "GENERIC",
        },
        "creative-multiplier-sprint",
      ),
    ).toEqual({
      META_PIXEL_ID: "generic-pixel",
      META_CAPI_ACCESS_TOKEN: "generic-token",
      META_TEST_EVENT_CODE: "GENERIC",
    });
  });
});
