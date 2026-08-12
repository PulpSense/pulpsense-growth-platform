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
  it("replaces the outdated confirmation video with the native deck", () => {
    expect(heroSource).toContain("ThankYouDeckCarousel");
    expect(heroSource).not.toContain("WistiaPlayer");
    expect(heroSource).not.toContain("8py8vigtf1");
    expect(heroSource).not.toContain("pr-bar");
  });

  it("covers call preparation and the approved Growth Platform delivery model", () => {
    expect(carouselSource).toContain("Confirm the calendar invitation");
    expect(carouselSource).toContain(
      "reschedule from the invitation instead of missing the call",
    );
    expect(carouselSource).toContain("benchmarks the market");
    expect(carouselSource).toContain("builds the authority foundation");
    expect(carouselSource).toContain("expands and maintains visibility");
    expect(carouselSource).toContain("45 additional calls in 90 days");
  });

  it("does not carry Lead Oracle pricing, trial, contracts, or review gating into PulpSense", () => {
    expect(carouselSource).not.toMatch(/Lead Oracle|\$297|7-day trial/i);
    expect(carouselSource).not.toMatch(/month-to-month|cancel anytime/i);
    expect(carouselSource).not.toMatch(/block one|block 1|one-star|two-star/i);
  });

  it("retains the useful calendar confirmation screenshot", () => {
    const calendarSource = readFileSync(
      new URL("./CalendarConfirmationStep.astro", import.meta.url),
      "utf8",
    );

    expect(calendarSource).toContain("calendar-confirmation.webp");
    expect(calendarSource).toContain("pr-inbox-guide");
    expect(calendarSource).not.toContain("pr-calendar-preview");
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
    expect(carouselSource).toContain("slideDescriptions.map");
    expect(carouselSource).toContain("/ai-seo/thank-you-deck/slide-");
    expect(carouselSource).toContain('width="1600"');
    expect(carouselSource).toContain('height="900"');
  });

  it("supports focused keyboard, swipe, and direct slide navigation", () => {
    expect(carouselSource).toContain('from "@/components/ui/carousel"');
    expect(carouselSource).toContain("CarouselPrevious");
    expect(carouselSource).toContain("CarouselNext");
    expect(primitiveSource).toContain("tabIndex={0}");
    expect(primitiveSource).toContain("onKeyDown={handleKeyDown}");
    expect(primitiveSource).toContain('aria-label="Previous slide"');
    expect(primitiveSource).toContain('aria-label="Next slide"');
  });
});
