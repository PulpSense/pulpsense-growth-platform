import { describe, expect, it, vi } from "vitest";

import { recordDeckSlideView } from "./deckSlideAnalytics";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("recordDeckSlideView", () => {
  it("deduplicates a deck slide across component remounts in the browser session", () => {
    const storage = createStorage();
    const capture = vi.fn();

    expect(
      recordDeckSlideView("ai-seo-visibility", 2, { storage, capture }),
    ).toBe(true);
    expect(
      recordDeckSlideView("ai-seo-visibility", 2, { storage, capture }),
    ).toBe(false);
    expect(
      recordDeckSlideView("ai-seo-visibility", 3, { storage, capture }),
    ).toBe(true);

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenLastCalledWith("funnel_deck_slide_viewed", {
      deck_id: "ai-seo-visibility",
      slide_id: "slide-04",
      slide_index: 3,
    });
  });
});
