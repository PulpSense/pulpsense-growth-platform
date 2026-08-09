import { describe, expect, it } from "vitest";

import { createBrowserTrackingConfig } from "./preview-config";

describe("createBrowserTrackingConfig", () => {
  it("requires a browser dataset for preview deployments", () => {
    expect(() =>
      createBrowserTrackingConfig({ environment: "preview" }),
    ).toThrow("PUBLIC_META_PIXEL_ID");
  });

  it("rejects the production dataset in preview", () => {
    expect(() =>
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "828948073514575",
      }),
    ).toThrow("production Meta dataset");
  });

  it("configures PageView against a sandbox dataset", () => {
    expect(
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "sandbox-pixel",
      }),
    ).toEqual({
      facebookPixelId: "sandbox-pixel",
      facebookEvents: [{ name: "PageView", type: "standard" }],
    });
  });
});
