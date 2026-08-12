import { readdirSync, readFileSync } from "node:fs";

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
  it("replaces the outdated confirmation video with the AI image deck", () => {
    expect(heroSource).toContain("ThankYouDeckCarousel");
    expect(heroSource).not.toContain("WistiaPlayer");
    expect(heroSource).not.toContain("8py8vigtf1");
    expect(carouselSource).toContain("/ai-seo/thank-you-deck/slide-");
    expect(carouselSource).toContain("slideDescriptions.map");
    expect(carouselSource).not.toContain("briefingSlides");
  });

  it("covers call preparation and the approved delivery model", () => {
    expect(carouselSource).toContain("Confirm the calendar invitation");
    expect(carouselSource).toContain(
      "reschedule from the invitation instead of missing the call",
    );
    expect(carouselSource).toContain("The market is benchmarked");
    expect(carouselSource).toContain("The authority foundation is built");
    expect(carouselSource).toContain("Visibility expands and is maintained");
    expect(carouselSource).toContain("45 additional calls in 90 days");
  });

  it("keeps the briefing slides brand-neutral and excludes unsupported terms", () => {
    expect(carouselSource).not.toMatch(
      /PulpSense|Lead Oracle|\$297|7-day trial/i,
    );
    expect(carouselSource).not.toMatch(/month-to-month|cancel anytime/i);
    expect(carouselSource).not.toMatch(/block one|block 1|one-star|two-star/i);
  });

  it("preserves the true 16:9 image frame and compliant dot targets", () => {
    expect(stylesSource).toMatch(
      /\.pr-ty-deck-stage \{[\s\S]*?aspect-ratio: 16 \/ 9;/,
    );
    expect(stylesSource).toMatch(
      /\.pr-ty-deck-image \{[\s\S]*?object-fit: contain;/,
    );
    expect(stylesSource).toMatch(/\.pr-ty-deck-dot \{[\s\S]*?width: 1\.5rem;/);
    expect(stylesSource).toMatch(/\.pr-ty-deck-dot \{[\s\S]*?height: 2rem;/);
  });

  it("ships sixteen flattened AI briefing images with accessible equivalents", () => {
    const deckFiles = readdirSync(
      new URL("../../../../../public/ai-seo/thank-you-deck/", import.meta.url),
    ).filter((file) => file.startsWith("slide-") && file.endsWith(".webp"));

    expect(deckFiles).toHaveLength(16);
    expect(carouselSource.match(/^  ".+",$/gm)).toHaveLength(16);
    expect(carouselSource).toContain('width="1600"');
    expect(carouselSource).toContain('height="900"');
  });

  it("supports keyboard, swipe, tap zones, and direct slide navigation", () => {
    expect(carouselSource).toContain('from "@/components/ui/carousel"');
    expect(carouselSource).toContain("CarouselPrevious");
    expect(carouselSource).toContain("CarouselNext");
    expect(carouselSource).toContain("handleSlideTap");
    expect(primitiveSource).toContain("tabIndex={0}");
    expect(primitiveSource).toContain("onKeyDown={handleKeyDown}");
    expect(primitiveSource).toContain('aria-label="Previous slide"');
    expect(primitiveSource).toContain('aria-label="Next slide"');
  });
});
