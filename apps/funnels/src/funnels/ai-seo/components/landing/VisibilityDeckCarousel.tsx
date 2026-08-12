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
    alt: `Slide ${number} of ${slideDescriptions.length}: ${description}`,
  };
});

export function VisibilityDeckCarousel() {
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

  const handleSlideTap = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      api?.scrollNext();
    }
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
          {slides.map((slide) => (
            <CarouselItem key={slide.image} className="pr-deck-item">
              <div className="pr-deck-stage">
                <img
                  className="pr-deck-image"
                  src={slide.image}
                  alt={slide.alt}
                  width="1600"
                  height="900"
                  draggable="false"
                  onClick={handleSlideTap}
                />
                <span className="pr-deck-tap-hint" aria-hidden="true">
                  <svg viewBox="0 0 32 44" focusable="false">
                    <path d="M16 2C9.4 2 4 7.4 4 14v16c0 6.6 5.4 12 12 12s12-5.4 12-12V14C28 7.4 22.6 2 16 2Z" />
                    <path d="M16 2v12M12 8h8" />
                  </svg>
                </span>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="pr-deck-arrow" />
        <CarouselNext className="pr-deck-arrow" />
      </Carousel>

      <div className="pr-deck-controls">
        <p className="pr-deck-progress" aria-live="polite">
          {activeIndex + 1} / {slides.length}
        </p>
        <div className="pr-deck-dots" aria-label="Choose a slide">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              className="pr-deck-dot"
              data-active={index === activeIndex ? "true" : "false"}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
            />
          ))}
        </div>
      </div>
      <p className="pr-deck-hint">Swipe or tap to continue</p>
    </section>
  );
}
