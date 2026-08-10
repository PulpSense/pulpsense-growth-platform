import type { FunnelId } from "@pulpsense/contracts";

export const AI_SEO_LAWYERS_PRODUCTION_PIXEL_ID = "828948073514575";

export type AiSeoVertical = "lawyers" | "dentists";
export type AiSeoFunnelId = Extract<FunnelId, "ai-seo" | "ai-seo-dentists">;

type AiSeoVariant = {
  vertical: AiSeoVertical;
  funnelId: AiSeoFunnelId;
  metaPixelId?: string;
  productionMetaPixelId?: string;
};

export function resolveAiSeoVariant({
  vertical,
  lawyersMetaPixelId,
  dentistsMetaPixelId,
}: {
  vertical?: string;
  lawyersMetaPixelId?: string;
  dentistsMetaPixelId?: string;
}): AiSeoVariant {
  const selectedVertical = vertical?.trim() || "lawyers";

  if (selectedVertical === "lawyers") {
    return {
      vertical: "lawyers",
      funnelId: "ai-seo",
      metaPixelId: lawyersMetaPixelId,
      productionMetaPixelId: AI_SEO_LAWYERS_PRODUCTION_PIXEL_ID,
    };
  }

  if (selectedVertical === "dentists") {
    return {
      vertical: "dentists",
      funnelId: "ai-seo-dentists",
      metaPixelId: dentistsMetaPixelId,
    };
  }

  throw new Error(`Unsupported PUBLIC_AI_SEO_VERTICAL: ${selectedVertical}`);
}
