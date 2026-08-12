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
          META_TEST_EVENTS_ENABLED: "true",
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

  it("uses an isolated dentist Meta destination", () => {
    expect(
      resolveMetaEnvironment(
        {
          META_PIXEL_ID_AI_SEO_L: "lawyer-pixel",
          META_CAPI_ACCESS_TOKEN_AI_SEO_L: "lawyer-token",
          META_TEST_EVENT_CODE_AI_SEO_L: "LAWYER",
          META_TEST_EVENTS_ENABLED: "true",
          META_PIXEL_ID_AI_SEO_D: "dentist-pixel",
          META_CAPI_ACCESS_TOKEN_AI_SEO_D: "dentist-token",
          META_TEST_EVENT_CODE_AI_SEO_D: "DENTIST",
        },
        "ai-seo-dentists",
      ),
    ).toEqual({
      META_PIXEL_ID: "dentist-pixel",
      META_CAPI_ACCESS_TOKEN: "dentist-token",
      META_TEST_EVENT_CODE: "DENTIST",
    });
  });

  it("does not fall back to the lawyers CAPI destination for dentists", () => {
    expect(
      resolveMetaEnvironment(
        {
          META_PIXEL_ID_AI_SEO_L: "lawyer-pixel",
          META_CAPI_ACCESS_TOKEN_AI_SEO_L: "lawyer-token",
          META_TEST_EVENT_CODE_AI_SEO_L: "LAWYER",
        },
        "ai-seo-dentists",
      ),
    ).toEqual({
      META_PIXEL_ID: undefined,
      META_CAPI_ACCESS_TOKEN: undefined,
      META_TEST_EVENT_CODE: undefined,
    });
  });

  it("has isolated CAPI destinations for every new AI SEO niche", () => {
    const environment = {
      META_PIXEL_ID_AI_SEO_DI: "implants-pixel",
      META_CAPI_ACCESS_TOKEN_AI_SEO_DI: "implants-token",
      META_TEST_EVENT_CODE_AI_SEO_DI: "IMPLANTS",
      META_PIXEL_ID_AI_SEO_PS: "plastic-pixel",
      META_CAPI_ACCESS_TOKEN_AI_SEO_PS: "plastic-token",
      META_TEST_EVENT_CODE_AI_SEO_PS: "PLASTIC",
      META_PIXEL_ID_AI_SEO_HR: "hair-pixel",
      META_CAPI_ACCESS_TOKEN_AI_SEO_HR: "hair-token",
      META_TEST_EVENT_CODE_AI_SEO_HR: "HAIR",
      META_PIXEL_ID_AI_SEO_MS: "med-spa-pixel",
      META_CAPI_ACCESS_TOKEN_AI_SEO_MS: "med-spa-token",
      META_TEST_EVENT_CODE_AI_SEO_MS: "MED_SPA",
      META_TEST_EVENTS_ENABLED: "true",
    };

    expect(resolveMetaEnvironment(environment, "ai-seo-dental-implants")).toEqual({
      META_PIXEL_ID: "implants-pixel",
      META_CAPI_ACCESS_TOKEN: "implants-token",
      META_TEST_EVENT_CODE: "IMPLANTS",
    });
    expect(resolveMetaEnvironment(environment, "ai-seo-plastic-surgery")).toEqual({
      META_PIXEL_ID: "plastic-pixel",
      META_CAPI_ACCESS_TOKEN: "plastic-token",
      META_TEST_EVENT_CODE: "PLASTIC",
    });
    expect(resolveMetaEnvironment(environment, "ai-seo-hair-restoration")).toEqual({
      META_PIXEL_ID: "hair-pixel",
      META_CAPI_ACCESS_TOKEN: "hair-token",
      META_TEST_EVENT_CODE: "HAIR",
    });
    expect(resolveMetaEnvironment(environment, "ai-seo-med-spas")).toEqual({
      META_PIXEL_ID: "med-spa-pixel",
      META_CAPI_ACCESS_TOKEN: "med-spa-token",
      META_TEST_EVENT_CODE: "MED_SPA",
    });
  });

  it("keeps saved test event codes inactive until explicitly enabled", () => {
    expect(
      resolveMetaEnvironment(
        {
          META_PIXEL_ID_AI_SEO_DI: "implants-pixel",
          META_CAPI_ACCESS_TOKEN_AI_SEO_DI: "implants-token",
          META_TEST_EVENT_CODE_AI_SEO_DI: "IMPLANTS",
        },
        "ai-seo-dental-implants",
      ),
    ).toEqual({
      META_PIXEL_ID: "implants-pixel",
      META_CAPI_ACCESS_TOKEN: "implants-token",
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
          META_TEST_EVENTS_ENABLED: "true",
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
