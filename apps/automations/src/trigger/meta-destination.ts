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
  "creative-multiplier-sprint": {
    pixelId: "META_PIXEL_ID",
    accessToken: "META_CAPI_ACCESS_TOKEN",
    testEventCode: "META_TEST_EVENT_CODE",
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
  return {
    META_PIXEL_ID: environment[keys.pixelId],
    META_CAPI_ACCESS_TOKEN: environment[keys.accessToken],
    META_TEST_EVENT_CODE: environment[keys.testEventCode],
  };
};
