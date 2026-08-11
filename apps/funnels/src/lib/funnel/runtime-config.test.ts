import { describe, expect, it } from "vitest";

import {
  createBrowserTrackingConfig,
  resolveCalConfig,
} from "./runtime-config";

describe("funnel runtime configuration", () => {
  it("disables Meta tracking in preview even when a pixel is configured", () => {
    expect(
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "",
      }),
    ).toEqual({});

    expect(
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "828948073514575",
      }),
    ).toEqual({});
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
