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

  it("rejects a nonnumeric Meta Pixel ID", () => {
    expect(() =>
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "cmslrzhox005fn90jxbpp5wgz",
      }),
    ).toThrow("valid numeric Meta Pixel ID");
  });

  it("configures PageView against a sandbox dataset", () => {
    expect(
      createBrowserTrackingConfig({
        environment: "preview",
        metaPixelId: "111111111111111",
      }),
    ).toEqual({
      facebookPixelId: "111111111111111",
      facebookEvents: [{ name: "PageView", type: "standard" }],
    });
  });
});
