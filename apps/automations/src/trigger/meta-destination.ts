import type { FunnelId } from "@pulpsense/contracts";

type MetaEnvironmentKeys = {
  pixelId: string;
  accessToken: string;
  testEventCode: string;
};

const metaEnvironmentKeysByFunnel = {
  "ai-seo": {
    pixelId: "META_PIXEL_ID_AI_SEO_L",
    accessToken: "META_CAPI_ACCESS_TOKEN_AI_SEO_L",
    testEventCode: "META_TEST_EVENT_CODE_AI_SEO_L",
  },
  "ai-seo-dentists": {
    pixelId: "META_PIXEL_ID_AI_SEO_D",
    accessToken: "META_CAPI_ACCESS_TOKEN_AI_SEO_D",
    testEventCode: "META_TEST_EVENT_CODE_AI_SEO_D",
  },
  "ai-seo-dental-implants": {
    pixelId: "META_PIXEL_ID_AI_SEO_DI",
    accessToken: "META_CAPI_ACCESS_TOKEN_AI_SEO_DI",
    testEventCode: "META_TEST_EVENT_CODE_AI_SEO_DI",
  },
  "ai-seo-plastic-surgery": {
    pixelId: "META_PIXEL_ID_AI_SEO_PS",
    accessToken: "META_CAPI_ACCESS_TOKEN_AI_SEO_PS",
    testEventCode: "META_TEST_EVENT_CODE_AI_SEO_PS",
  },
  "ai-seo-hair-restoration": {
    pixelId: "META_PIXEL_ID_AI_SEO_HR",
    accessToken: "META_CAPI_ACCESS_TOKEN_AI_SEO_HR",
    testEventCode: "META_TEST_EVENT_CODE_AI_SEO_HR",
  },
  "ai-seo-med-spas": {
    pixelId: "META_PIXEL_ID_AI_SEO_MS",
    accessToken: "META_CAPI_ACCESS_TOKEN_AI_SEO_MS",
    testEventCode: "META_TEST_EVENT_CODE_AI_SEO_MS",
  },
} satisfies Record<FunnelId, MetaEnvironmentKeys>;

export const resolveMetaEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
  funnelId: FunnelId,
): {
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
} => {
  const keys = metaEnvironmentKeysByFunnel[funnelId];
  const testEventsEnabled = environment.META_TEST_EVENTS_ENABLED === "true";
  return {
    META_PIXEL_ID: environment[keys.pixelId],
    META_CAPI_ACCESS_TOKEN: environment[keys.accessToken],
    META_TEST_EVENT_CODE: testEventsEnabled
      ? environment[keys.testEventCode]
      : undefined,
  };
};
