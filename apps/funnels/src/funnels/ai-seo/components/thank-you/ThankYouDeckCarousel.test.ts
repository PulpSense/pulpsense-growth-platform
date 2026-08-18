import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const heroSource = readFileSync(
  new URL("./ConfirmationHero.astro", import.meta.url),
  "utf8",
);
const carouselSource = readFileSync(
  new URL("./ThankYouDeckCarousel.tsx", import.meta.url),
  "utf8",
);
const stylesSource = readFileSync(
  new URL("../../styles/thank-you.css", import.meta.url),
  "utf8",
);
const primitiveSource = readFileSync(
  new URL("../../../../components/ui/carousel.tsx", import.meta.url),
  "utf8",
);

describe("AI SEO thank-you briefing deck", () => {
  it("replaces the outdated confirmation video with the native deck", () => {
    expect(heroSource).toContain("ThankYouDeckCarousel");
    expect(heroSource).not.toContain("WistiaPlayer");
    expect(heroSource).not.toContain("8py8vigtf1");
    expect(heroSource).not.toContain("pr-bar");
    expect(carouselSource).toContain("deckSlides.map");
  });

  it("uses the rich approved briefing deck images", () => {
    expect(carouselSource).toContain("/ai-seo/deck/slide-");
    expect(carouselSource).toContain("Array.from({ length: 20 }");
    expect(stylesSource).toContain(".pr-ty-deck-image");
  });

  it("does not carry Lead Oracle pricing, trial, contracts, or review gating into PulpSense", () => {
    expect(carouselSource).not.toMatch(/Lead Oracle|\$297|7-day trial/i);
    expect(carouselSource).not.toMatch(/month-to-month|cancel anytime/i);
    expect(carouselSource).not.toMatch(/block one|block 1|one-star|two-star/i);
  });

  it("keeps the deck stage accessible without dot navigation", () => {
    expect(stylesSource).toMatch(
      /\.pr-ty-deck-stage \{[\s\S]*?aspect-ratio: 16 \/ 9;/,
    );
    expect(stylesSource).not.toContain("pr-ty-deck-dot");
    expect(carouselSource).not.toContain("pr-ty-deck-dots");
  });

  it("defines twenty rich briefing slides", () => {
    expect(carouselSource).toContain("deckSlides.map");
    expect(carouselSource).toContain("{index + 1} / {deckSlides.length}");
  });

  it("supports focused keyboard, swipe, and direct slide navigation", () => {
    expect(carouselSource).toContain('from "@/components/ui/carousel"');
    expect(carouselSource).toContain("CarouselPrevious");
    expect(carouselSource).toContain("CarouselNext");
    expect(carouselSource).toContain("DeckSwipeHint");
    expect(primitiveSource).toContain("tabIndex={0}");
    expect(primitiveSource).toContain("onKeyDown={handleKeyDown}");
    expect(primitiveSource).toContain('aria-label="Previous slide"');
    expect(primitiveSource).toContain('aria-label="Next slide"');
  });
});
