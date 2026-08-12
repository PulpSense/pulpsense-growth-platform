import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

const slideDescriptions = [
  "Your Regional Visibility Audit is reserved. Review the next steps and the guarantee of 45 new calls in 90 days, or PulpSense works free until the business gets them.",
  "Confirm the calendar invitation by opening it, clicking Yes, and keeping the meeting link handy.",
  "If plans change, reschedule from the invitation instead of missing the call.",
  "The live audit diagnoses visibility across Google Maps, organic search, AI Overviews, ChatGPT, and competitor authority signals.",
  "Google and AI cross-check websites, maps, directories, reviews, citations, structured data, and trusted third-party references for consistent authority.",
  "PulpSense benchmarks the market across Google Maps, organic search, AI Overviews, and ChatGPT to identify competitors recommended first.",
  "PulpSense builds the authority foundation across business information, technical structure, regional coverage, service content, citations, profiles, and reputation.",
  "Business profiles, website data, directories, citations, reviews, and third-party proof should consistently explain what the business does and where it operates.",
  "PulpSense builds a compliant reputation system that requests honest customer feedback and makes genuine trust easier to see.",
  "PulpSense expands and maintains visibility across weak markets and service lines as the competitive landscape changes.",
  "Reporting establishes a baseline and reviews visibility, completed work, priorities, and call growth.",
  "The client provides access and business context while PulpSense handles implementation and focused review calls.",
  "The audit can complement an existing agency by benchmarking AI recommendations, profiles, citations, reputation, and regional authority gaps.",
  "The guarantee is 45 additional calls in 90 days, or PulpSense continues at no management fee until the agreed result is reached.",
  "Prepare priority locations, highest-value services, current marketing partners, and visibility or call-tracking questions for the audit.",
  "Confirm the invitation, keep the meeting link handy, and arrive ready to review Google and AI visibility. One business per service category, per market.",
] as const;

const slides = slideDescriptions.map((description, index) => {
  const number = index + 1;
  return {
    image: `/ai-seo/thank-you-deck/slide-${String(number).padStart(2, "0")}.webp`,
    alt: `Briefing slide ${number} of ${slideDescriptions.length}: ${description}`,
  };
});

export function ThankYouDeckCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    const updateIndex = () => setActiveIndex(api.selectedScrollSnap());
    updateIndex();
    api.on("select", updateIndex);
    return () => {
      api.off("select", updateIndex);
    };
  }, [api]);

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
          {slides.map((slide) => (
            <CarouselItem key={slide.image} className="pr-ty-deck-item">
              <div className="pr-ty-deck-stage">
                <img
                  className="pr-ty-deck-image"
                  src={slide.image}
                  alt={slide.alt}
                  width="1600"
                  height="900"
                  draggable="false"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="pr-ty-deck-arrow" />
        <CarouselNext className="pr-ty-deck-arrow" />
      </Carousel>

      <div className="pr-ty-deck-controls">
        <p className="pr-ty-deck-progress" aria-live="polite">
          {activeIndex + 1} / {slides.length}
        </p>
        <div className="pr-ty-deck-dots" aria-label="Choose a briefing slide">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              className="pr-ty-deck-dot"
              data-active={index === activeIndex ? "true" : "false"}
              type="button"
              aria-label={`Go to briefing slide ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
            />
          ))}
        </div>
      </div>
      <p className="pr-ty-deck-hint">
        Swipe, use the controls, or focus the carousel and use the arrow keys
      </p>
    </section>
  );
}
