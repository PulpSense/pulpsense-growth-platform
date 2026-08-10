import type { PixelConfig } from "@/components/ui";

export type DeploymentEnvironment = "local" | "preview" | "production";

export function parseDeploymentEnvironment(
  value: string | undefined,
): DeploymentEnvironment {
  const environment = value ?? "local";
  if (
    environment !== "local" &&
    environment !== "preview" &&
    environment !== "production"
  ) {
    throw new Error(`Unsupported PUBLIC_PULPSENSE_ENVIRONMENT: ${environment}`);
  }
  return environment;
}

export function createBrowserTrackingConfig({
  environment = "local",
  metaPixelId,
  productionMetaPixelId,
}: {
  environment?: DeploymentEnvironment;
  metaPixelId?: string;
  productionMetaPixelId?: string;
}): PixelConfig {
  const configuredPixelId = metaPixelId?.trim();
  if (environment === "preview" && !configuredPixelId) {
    throw new Error(
      "PUBLIC_META_PIXEL_ID is required for preview builds so browser tracking is exercised against a sandbox dataset.",
    );
  }
  if (
    environment === "preview" &&
    productionMetaPixelId &&
    configuredPixelId === productionMetaPixelId
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

export function resolveCalConfig({
  environment = "local",
  calLink,
  calNamespace,
  localFallback,
}: {
  environment?: DeploymentEnvironment;
  calLink?: string;
  calNamespace?: string;
  localFallback: string;
}) {
  const configuredCalLink = calLink?.trim();
  if (environment === "preview" && !configuredCalLink) {
    throw new Error(
      "PUBLIC_CAL_LINK is required for preview builds so booking cannot fall back to the production destination.",
    );
  }
  const resolvedLink = configuredCalLink || localFallback;
  return {
    calLink: resolvedLink,
    namespace: calNamespace?.trim() || resolvedLink.split("/").at(-1),
  };
}
