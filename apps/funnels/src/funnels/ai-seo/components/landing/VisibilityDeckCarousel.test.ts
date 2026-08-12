import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const heroSource = readFileSync(
  new URL("./HeroSection.astro", import.meta.url),
  "utf8",
);
const carouselSource = readFileSync(
  new URL("./VisibilityDeckCarousel.tsx", import.meta.url),
  "utf8",
);
const primitiveSource = readFileSync(
  new URL("../../../../components/ui/carousel.tsx", import.meta.url),
  "utf8",
);

describe("AI SEO visibility deck", () => {
  it("replaces the VSL with the native deck carousel", () => {
    expect(heroSource).toContain("VisibilityDeckCarousel");
    expect(heroSource).not.toContain("WistiaPlayer");
    expect(heroSource).not.toContain("8py8vigtf1");
  });

  it("supports tap, keyboard, and swipe navigation accessibly", () => {
    expect(carouselSource).toContain('from "@/components/ui/carousel"');
    expect(carouselSource).toContain("CarouselPrevious");
    expect(carouselSource).toContain("CarouselNext");
    expect(primitiveSource).toContain('event.key === "ArrowLeft"');
    expect(primitiveSource).toContain('event.key === "ArrowRight"');
    expect(primitiveSource).toContain("tabIndex={0}");
    expect(primitiveSource).toContain('aria-label="Previous slide"');
    expect(primitiveSource).toContain('aria-label="Next slide"');
  });

  it("ships the full twenty-slide source-truth deck", () => {
    const deckFiles = readdirSync(
      new URL("../../../../../public/ai-seo/deck/", import.meta.url),
    ).filter((file) => file.startsWith("slide-") && file.endsWith(".webp"));

    expect(deckFiles).toHaveLength(20);
    expect(carouselSource.match(/^  ".+",$/gm)).toHaveLength(20);
    expect(carouselSource).toContain("slideDescriptions.map");
    expect(carouselSource).toContain("/ai-seo/deck/slide-");
    expect(carouselSource).toContain("Twin Oaks Dental and Wellness");
  });
});
