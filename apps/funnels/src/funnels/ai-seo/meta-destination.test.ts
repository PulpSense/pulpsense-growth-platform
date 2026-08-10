import { describe, expect, it } from "vitest";

import { resolveAiSeoVariant } from "./meta-destination";

describe("resolveAiSeoVariant", () => {
  it("keeps lawyers as the backwards-compatible default", () => {
    expect(
      resolveAiSeoVariant({
        lawyersMetaPixelId: "lawyers-pixel",
        dentistsMetaPixelId: "dentists-pixel",
      }),
    ).toMatchObject({
      vertical: "lawyers",
      funnelId: "ai-seo",
      metaPixelId: "lawyers-pixel",
    });
  });

  it("selects the dentist funnel identity and dentist browser pixel", () => {
    expect(
      resolveAiSeoVariant({
        vertical: "dentists",
        lawyersMetaPixelId: "lawyers-pixel",
        dentistsMetaPixelId: "dentists-pixel",
      }),
    ).toEqual({
      vertical: "dentists",
      funnelId: "ai-seo-dentists",
      metaPixelId: "dentists-pixel",
    });
  });

  it("does not fall back to the lawyers browser pixel for dentists", () => {
    expect(
      resolveAiSeoVariant({
        vertical: "dentists",
        lawyersMetaPixelId: "lawyers-pixel",
      }),
    ).toEqual({
      vertical: "dentists",
      funnelId: "ai-seo-dentists",
      metaPixelId: undefined,
    });
  });

  it("rejects an unknown vertical instead of falling back to lawyers", () => {
    expect(() => resolveAiSeoVariant({ vertical: "unknown" })).toThrow(
      "Unsupported PUBLIC_AI_SEO_VERTICAL",
    );
  });
});
