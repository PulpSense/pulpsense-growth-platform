import type { PixelConfig } from "@/components/ui";

export type DeploymentEnvironment = "local" | "preview" | "production";

const PRODUCTION_META_PIXEL_ID = "828948073514575";

export function createBrowserTrackingConfig({
  environment = "local",
  metaPixelId,
}: {
  environment?: DeploymentEnvironment;
  metaPixelId?: string;
}): PixelConfig {
  const configuredPixelId = metaPixelId?.trim();
  if (environment === "preview" && !configuredPixelId) {
    throw new Error(
      "PUBLIC_META_PIXEL_ID is required for preview builds so browser tracking is exercised against a sandbox dataset.",
    );
  }
  if (
    environment === "preview" &&
    configuredPixelId === PRODUCTION_META_PIXEL_ID
  ) {
    throw new Error("Preview builds cannot use the production Meta dataset.");
  }
  if (configuredPixelId && !/^\d{5,30}$/u.test(configuredPixelId)) {
    throw new Error(
      "PUBLIC_META_PIXEL_ID must be a valid numeric Meta Pixel ID.",
    );
  }
  if (!configuredPixelId) return {};

  return {
    facebookPixelId: configuredPixelId,
    facebookEvents: [{ name: "PageView", type: "standard" }],
  };
}
