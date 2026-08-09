import { describe, expect, it } from "vitest";

import { resolveMetaEnvironment } from "./process-funnel-event.js";

describe("resolveMetaEnvironment", () => {
  it("prefers the lawyer-scoped Meta variables", () => {
    expect(
      resolveMetaEnvironment({
        META_PIXEL_ID: "generic-pixel",
        META_PIXEL_ID_AI_SEO_L: "lawyer-pixel",
        META_CAPI_ACCESS_TOKEN: "generic-token",
        META_CAPI_ACCESS_TOKEN_AI_SEO_L: "lawyer-token",
        META_TEST_EVENT_CODE: "GENERIC",
        META_TEST_EVENT_CODE_AI_SEO_L: "LAWYER",
      }),
    ).toEqual({
      META_PIXEL_ID: "lawyer-pixel",
      META_CAPI_ACCESS_TOKEN: "lawyer-token",
      META_TEST_EVENT_CODE: "LAWYER",
    });
  });

  it("falls back to the generic Meta variables", () => {
    expect(
      resolveMetaEnvironment({
        META_PIXEL_ID: "generic-pixel",
        META_CAPI_ACCESS_TOKEN: "generic-token",
        META_TEST_EVENT_CODE: "GENERIC",
      }),
    ).toEqual({
      META_PIXEL_ID: "generic-pixel",
      META_CAPI_ACCESS_TOKEN: "generic-token",
      META_TEST_EVENT_CODE: "GENERIC",
    });
  });
});
