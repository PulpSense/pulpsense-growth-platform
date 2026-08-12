import { useRef, useState } from "react";

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
  const touchStartX = useRef<number | null>(null);

  const previous = () => {
    setActiveIndex((current) => Math.max(0, current - 1));
  };

  const next = () => {
    setActiveIndex((current) => Math.min(slides.length - 1, current + 1));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") previous();
    if (event.key === "ArrowRight") next();
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(distance) < 40) return;
    if (distance > 0) previous();
    else next();
  };

  const activeSlide = slides[activeIndex] ?? slides[0]!;

  return (
    <section
      className="pr-deck"
      aria-label="PulpSense regional visibility presentation"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartX.current = null;
      }}
    >
      <div className="pr-deck-stage">
        <img
          className="pr-deck-image"
          src={activeSlide.image}
          alt={activeSlide.alt}
          width="1600"
          height="900"
          draggable="false"
        />
        <button
          className="pr-deck-arrow pr-deck-arrow-left"
          type="button"
          aria-label="Previous slide"
          onClick={previous}
          disabled={activeIndex === 0}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          className="pr-deck-arrow pr-deck-arrow-right"
          type="button"
          aria-label="Next slide"
          onClick={next}
          disabled={activeIndex === slides.length - 1}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

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
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
      <p className="pr-deck-hint">
        Tap, swipe, or use the arrow keys to continue
      </p>
    </section>
  );
}
