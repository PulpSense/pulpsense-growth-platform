import { describe, expect, it, vi } from "vitest";

import { scheduleNonCriticalMedia } from "./deferredMedia";

describe("scheduleNonCriticalMedia", () => {
  it("keeps media work behind page load, interaction, and an idle callback", () => {
    const callback = vi.fn();
    let onLoad: (() => void) | undefined;
    let onInteraction: (() => void) | undefined;
    let onIdle: (() => void) | undefined;
    const removeLoadListener = vi.fn();
    const removeInteractionListener = vi.fn();

    scheduleNonCriticalMedia(callback, {
      isPageLoaded: () => false,
      addLoadListener: (listener) => {
        onLoad = listener;
        return removeLoadListener;
      },
      addInteractionListener: (listener) => {
        onInteraction = listener;
        return removeInteractionListener;
      },
      requestIdle: (listener) => {
        onIdle = listener;
        return 17;
      },
      cancelIdle: vi.fn(),
    });

    expect(callback).not.toHaveBeenCalled();
    onLoad?.();
    expect(callback).not.toHaveBeenCalled();
    expect(onIdle).toBeUndefined();
    onInteraction?.();
    expect(callback).not.toHaveBeenCalled();
    onIdle?.();
    expect(callback).toHaveBeenCalledOnce();
    expect(removeLoadListener).toHaveBeenCalledOnce();
    expect(removeInteractionListener).toHaveBeenCalledOnce();
  });

  it("cancels queued media work when the island unmounts", () => {
    const callback = vi.fn();
    const cancelIdle = vi.fn();
    let onInteraction: (() => void) | undefined;
    const cleanup = scheduleNonCriticalMedia(callback, {
      isPageLoaded: () => true,
      addLoadListener: vi.fn(),
      addInteractionListener: (listener) => {
        onInteraction = listener;
        return vi.fn();
      },
      requestIdle: () => 23,
      cancelIdle,
    });

    onInteraction?.();
    cleanup();

    expect(cancelIdle).toHaveBeenCalledWith(23);
    expect(callback).not.toHaveBeenCalled();
  });
});
