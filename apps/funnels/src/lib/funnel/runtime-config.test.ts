import { describe, expect, it } from "vitest";

import {
  createBrowserTrackingConfig,
  resolveCalConfig,
} from "./runtime-config";

describe("funnel runtime configuration", () => {
  it("requires a sandbox Meta pixel for preview", () => {
    expect(() =>
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "",
        productionMetaPixelId: "828948073514575",
      }),
    ).toThrow("PUBLIC_META_PIXEL_ID");

    expect(() =>
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "828948073514575",
        productionMetaPixelId: "828948073514575",
      }),
    ).toThrow("production Meta dataset");
  });

  it("requires an explicit Cal link in preview and allows a local fallback", () => {
    expect(() =>
      resolveCalConfig({
        environment: "preview",
        calLink: "",
        localFallback: "santileoni/funnel",
      }),
    ).toThrow("PUBLIC_CAL_LINK");

    expect(
      resolveCalConfig({
        environment: "local",
        calLink: "",
        localFallback: "santileoni/funnel",
      }),
    ).toEqual({ calLink: "santileoni/funnel", namespace: "funnel" });
  });
});
