import { useState } from "react";
import type { MouseEvent } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

const deckSlides = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1;
  return {
    src: `/ai-seo/deck/slide-${String(number).padStart(2, "0")}.webp`,
    alt: `Regional Visibility Audit briefing slide ${number} of 20`,
  };
});

export function ThankYouDeckCarousel() {
  const [api, setApi] = useState<CarouselApi>();

  const handleSlideTap = (event: MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const tapPosition = (event.clientX - left) / width;
    api?.[tapPosition <= 0.25 ? "scrollPrev" : "scrollNext"]();
  };

  return (
    <section
      className="pr-ty-deck"
      aria-label="Regional Visibility Audit briefing"
    >
      <Carousel
        className="pr-ty-deck-carousel"
        aria-roledescription="carousel"
        opts={{ loop: false }}
        setApi={setApi}
      >
        <CarouselContent className="pr-ty-deck-content">
          {deckSlides.map((slide, index) => (
            <CarouselItem key={slide.src} className="pr-ty-deck-item">
              <div className="pr-ty-deck-stage" onClick={handleSlideTap}>
                <span className="pr-ty-deck-count">
                  {index + 1} / {deckSlides.length}
                </span>
                <img
                  className="pr-ty-deck-image"
                  src={slide.src}
                  alt={slide.alt}
                  width="1600"
                  height="900"
                  draggable="false"
                />
                {index === 0 ? (
                  <span className="pr-ty-deck-tap-hint" aria-hidden="true">
                    <img src="/ai-seo/images/tap-mouse.svg" alt="" />
                  </span>
                ) : null}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="pr-ty-deck-arrow" />
        <CarouselNext className="pr-ty-deck-arrow" />
      </Carousel>

      <p className="pr-ty-deck-hint">Swipe or tap to continue</p>
    </section>
  );
}
