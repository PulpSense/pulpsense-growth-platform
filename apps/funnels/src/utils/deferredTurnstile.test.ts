// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { initializeDeferredTurnstile } from "./deferredTurnstile";

let intersectionCallback: IntersectionObserverCallback | undefined;

class IntersectionObserverStub {
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
  root = null;
  rootMargin = "800px 0px";
  thresholds = [0];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
}

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  intersectionCallback = undefined;
  vi.unstubAllGlobals();
});

describe("deferred Turnstile", () => {
  it("loads as the qualification form approaches and reports readiness", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
    document.head.innerHTML =
      '<script data-pulpsense-turnstile data-status="deferred"></script>';
    document.body.innerHTML = '<section id="pr-funnel-form"></section>';
    const ready = vi.fn();
    window.addEventListener("pulpsense:turnstile-script-state", ready, {
      once: true,
    });

    initializeDeferredTurnstile("#pr-funnel-form");
    const script = document.querySelector<HTMLScriptElement>(
      "script[data-pulpsense-turnstile]",
    );

    expect(script?.dataset.status).toBe("deferred");
    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(script?.dataset.status).toBe("loading");
    const loader = Array.from(document.head.querySelectorAll("script")).find(
      (candidate) => candidate !== script,
    );
    expect(loader?.src).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect(
      document.head.querySelector('link[rel="preconnect"]'),
    ).not.toBeNull();

    loader?.dispatchEvent(new Event("load"));
    expect(script?.dataset.status).toBe("ready");
    expect(ready).toHaveBeenCalledOnce();
  });
});
