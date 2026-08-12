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

describe("AI SEO thank-you briefing deck", () => {
  it("replaces the outdated confirmation video with the native deck", () => {
    expect(heroSource).toContain("ThankYouDeckCarousel");
    expect(heroSource).not.toContain("WistiaPlayer");
    expect(heroSource).not.toContain("8py8vigtf1");
  });

  it("covers call preparation and the approved Growth Platform delivery model", () => {
    expect(carouselSource).toContain("Confirm your calendar invitation");
    expect(carouselSource).toContain(
      "Reschedule from the link in your invitation",
    );
    expect(carouselSource).toContain("We benchmark your market");
    expect(carouselSource).toContain("We build your authority foundation");
    expect(carouselSource).toContain("We expand and maintain visibility");
    expect(carouselSource).toContain("45 additional calls in 90 days");
  });

  it("does not carry Lead Oracle pricing, trial, contracts, or review gating into PulpSense", () => {
    expect(carouselSource).not.toMatch(/Lead Oracle|\$297|7-day trial/i);
    expect(carouselSource).not.toMatch(/month-to-month|cancel anytime/i);
    expect(carouselSource).not.toMatch(/block one|block 1|one-star|two-star/i);
  });

  it("does not retain the Lead Oracle calendar screenshot", () => {
    const calendarSource = readFileSync(
      new URL("./CalendarConfirmationStep.astro", import.meta.url),
      "utf8",
    );

    expect(calendarSource).not.toContain("calendar-confirmation.webp");
    expect(calendarSource).toContain("pr-calendar-preview");
  });

  it("supports focused keyboard, swipe, and direct slide navigation", () => {
    expect(carouselSource).toContain("tabIndex={0}");
    expect(carouselSource).toContain("onKeyDown={handleKeyDown}");
    expect(carouselSource).toContain("onTouchStart");
    expect(carouselSource).toContain("onTouchEnd");
    expect(carouselSource).toContain("onTouchCancel");
    expect(carouselSource).toContain('aria-live="polite"');
    expect(carouselSource).toContain('aria-label="Previous briefing slide"');
    expect(carouselSource).toContain('aria-label="Next briefing slide"');
  });
});
