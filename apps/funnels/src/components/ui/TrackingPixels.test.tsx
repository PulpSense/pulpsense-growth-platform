/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrackingPixels } from "./TrackingPixels";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  document.head
    .querySelectorAll("script[data-pulpsense-tracking]")
    .forEach((script) => script.remove());
});

describe("TrackingPixels", () => {
  it("loads immediately when the outer island already deferred hydration", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TrackingPixels
          interactionReady
          pixels={{
            facebookPixelId: "sandbox-pixel",
            facebookEvents: [{ name: "PageView", type: "standard" }],
          }}
        />,
      );
    });

    const script = document.head.querySelector(
      "script[data-pulpsense-tracking]",
    );
    expect(script?.textContent).toContain("sandbox-pixel");
    expect(script?.textContent).toContain("PageView");

    await act(async () => root.unmount());
  });

  it("loads PageView tracking after an idle fallback without interaction", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TrackingPixels
          pixels={{
            facebookPixelId: "sandbox-pixel",
            facebookEvents: [{ name: "PageView", type: "standard" }],
          }}
        />,
      );
    });

    expect(
      document.head.querySelector("script[data-pulpsense-tracking]"),
    ).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    const script = document.head.querySelector(
      "script[data-pulpsense-tracking]",
    );
    expect(script?.textContent).toContain("sandbox-pixel");
    expect(script?.textContent).toContain("PageView");

    await act(async () => root.unmount());
  });
});
