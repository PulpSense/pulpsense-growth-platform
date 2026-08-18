import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useDeckSlideAnalytics } from "@/utils/deckSlideAnalytics";
import { DeckSwipeHint } from "../DeckSwipeHint";

const slideDescriptions = [
  "45 new calls in 90 days by ranking at the top of Google and AI, or PulpSense works free until the business gets them.",
  "Customers ask Google and AI who to trust, compare a shortlist, and contact the most credible providers.",
  "Businesses missing from the shortlist lose calls to competitors that appear first.",
  "More than 200 million people use ChatGPT weekly to decide which service businesses to trust.",
  "The top three Google Maps positions receive most calls.",
  "Paid advertising stops when the budget stops, while owned visibility continues sending prospects.",
  "Direct inquiries go to one business instead of being sold as shared leads.",
  "AI visibility depends on a website, reputation, business profiles, third-party sources, and regional authority.",
  "AI cross-checks maps, directories, reviews, citations, structured data, and trusted third-party references.",
  "Strong reviews can be undermined by inconsistent business information.",
  "Established regional businesses can be outranked by smaller competitors with clearer online authority signals.",
  "PulpSense builds and manages the full system from market audit to authority signals, recommendations, and calls.",
  "The offer includes visibility and competitor audits, profile optimization, regional strategy, structured data, citation cleanup, reputation systems, content, management, and monthly review.",
  "Step one benchmarks Google Maps, organic search, AI Overviews, ChatGPT, and competing businesses.",
  "Step two builds the authority foundation across business information, technical structure, coverage, content, citations, and reputation.",
  "Step three expands and maintains visibility across weak markets and service lines.",
  "Twin Oaks Dental and Wellness increased monthly calls from 10 to 48, a 380 percent increase.",
  "Wesley Glen Retirement Community moved from not ranked to number two in Google and AI in two weeks.",
  "Guarantee: 45 additional calls in 90 days, or PulpSense continues at no management fee until the target is reached.",
  "Request a Regional Visibility Audit to see current visibility, competitors recommended first, and market qualification.",
] as const;

const slides = slideDescriptions.map((description, index) => {
  const number = index + 1;
  return {
    image: `/ai-seo/deck/slide-${String(number).padStart(2, "0")}.webp`,
    image800: `/ai-seo/deck/slide-${String(number).padStart(2, "0")}-800.webp`,
    image1200: `/ai-seo/deck/slide-${String(number).padStart(2, "0")}-1200.webp`,
    alt: `Slide ${number} of ${slideDescriptions.length}: ${description}`,
  };
});

export function VisibilityDeckCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [loadedSlides, setLoadedSlides] = useState(() => new Set([0]));
  useDeckSlideAnalytics(api, "ai-seo-visibility");

  const loadSlidesNear = useCallback((index: number) => {
    setLoadedSlides((current) => {
      const next = new Set(current);
      for (const nearbyIndex of [index - 1, index, index + 1]) {
        if (nearbyIndex >= 0 && nearbyIndex < slides.length) {
          next.add(nearbyIndex);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    const handleSelection = () => loadSlidesNear(api.selectedScrollSnap());
    handleSelection();
    api.on("select", handleSelection);
    return () => {
      api.off("select", handleSelection);
    };
  }, [api, loadSlidesNear]);

  const handleSlideTap = (event: MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const tapPosition = (event.clientX - left) / width;
    api?.[tapPosition <= 0.25 ? "scrollPrev" : "scrollNext"]();
  };

  return (
    <section
      className="pr-deck"
      aria-label="PulpSense regional visibility presentation"
    >
      <Carousel
        className="pr-deck-carousel"
        aria-roledescription="carousel"
        opts={{ loop: false }}
        setApi={setApi}
      >
        <CarouselContent className="pr-deck-content">
          {slides.map((slide, index) => (
            <CarouselItem key={slide.image} className="pr-deck-item">
              <div className="pr-deck-stage" onClick={handleSlideTap}>
                <span className="pr-deck-count">
                  {index + 1} / {slides.length}
                </span>
                <img
                  className="pr-deck-image"
                  src={loadedSlides.has(index) ? slide.image800 : undefined}
                  srcSet={
                    loadedSlides.has(index)
                      ? `${slide.image800} 800w, ${slide.image1200} 1200w, ${slide.image} 1600w`
                      : undefined
                  }
                  sizes="(max-width: 640px) calc(100vw - 34px), 900px"
                  alt={slide.alt}
                  width="1600"
                  height="900"
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding={index === 0 ? "sync" : "async"}
                  draggable="false"
                />
                {index === 0 ? <DeckSwipeHint /> : null}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="pr-deck-arrow" />
        <CarouselNext className="pr-deck-arrow" />
      </Carousel>

      <p className="pr-deck-hint">Swipe or tap to continue</p>
    </section>
  );
}
