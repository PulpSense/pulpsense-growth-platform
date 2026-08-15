import { useEffect } from "react";

import type { CarouselApi } from "@/components/ui/carousel";
import { trackFunnelEvent } from "@/utils/funnelAnalytics";

type SlideViewStorage = Pick<Storage, "getItem" | "setItem">;

type SlideViewRecorderRuntime = {
  storage: SlideViewStorage;
  capture?: typeof trackFunnelEvent;
};

const storageKey = (deckId: string) => `pulpsense:deck-slides:${deckId}`;

const readViewedSlides = (deckId: string, storage: SlideViewStorage) => {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(deckId)) ?? "[]");
    return new Set<number>(
      Array.isArray(parsed)
        ? parsed.filter((value): value is number => Number.isInteger(value))
        : [],
    );
  } catch {
    return new Set<number>();
  }
};

export const recordDeckSlideView = (
  deckId: string,
  slideIndex: number,
  runtime: SlideViewRecorderRuntime,
) => {
  const viewedSlides = readViewedSlides(deckId, runtime.storage);
  if (viewedSlides.has(slideIndex)) return false;

  viewedSlides.add(slideIndex);
  try {
    runtime.storage.setItem(
      storageKey(deckId),
      JSON.stringify([...viewedSlides]),
    );
  } catch {
    // Measurement must not interrupt carousel navigation when storage is full.
  }
  (runtime.capture ?? trackFunnelEvent)("funnel_deck_slide_viewed", {
    deck_id: deckId,
    slide_id: `slide-${String(slideIndex + 1).padStart(2, "0")}`,
    slide_index: slideIndex,
  });
  return true;
};

export const useDeckSlideAnalytics = (
  api: CarouselApi | undefined,
  deckId: string,
) => {
  useEffect(() => {
    if (!api) return;
    const recordSelectedSlide = () => {
      recordDeckSlideView(deckId, api.selectedScrollSnap(), {
        storage: window.sessionStorage,
      });
    };
    recordSelectedSlide();
    api.on("select", recordSelectedSlide);
    return () => {
      api.off("select", recordSelectedSlide);
    };
  }, [api, deckId]);
};
