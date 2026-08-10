import { describe, expect, it } from "vitest";

import { createFormConfig } from "./content";

describe("createFormConfig", () => {
  it("requires an explicit booking destination for preview deployments", () => {
    expect(() => createFormConfig({ environment: "preview" })).toThrow(
      "PUBLIC_CAL_LINK",
    );
  });

  it("uses the configured preview booking destination", () => {
    const config = createFormConfig({
      environment: "preview",
      calLink: "pulpsense/preview-growth-mapping",
      calNamespace: "preview-growth-mapping",
    });
    const bookingStep = config.steps.find((step) => step.type === "cal");

    expect(bookingStep).toMatchObject({
      calLink: "pulpsense/preview-growth-mapping",
      namespace: "preview-growth-mapping",
    });
  });

  it("derives the embed namespace when the optional override is blank", () => {
    const config = createFormConfig({
      environment: "preview",
      calLink: "pulpsense/preview-growth-mapping",
      calNamespace: "",
    });
    const bookingStep = config.steps.find((step) => step.type === "cal");

    expect(bookingStep).toMatchObject({
      namespace: "preview-growth-mapping",
    });
  });
});
