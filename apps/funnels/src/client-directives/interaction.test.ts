/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import interactionDirective from "./interaction";

afterEach(() => {
  vi.useRealTimers();
});

describe("client:interaction", () => {
  it("hydrates idle-enabled islands after the two-second fallback", async () => {
    vi.useFakeTimers();
    const hydrate = vi.fn(async () => undefined);
    const load = vi.fn(async () => hydrate);

    interactionDirective(
      load,
      { name: "FunnelAnalytics", value: "idle" },
      document.createElement("div"),
    );

    await vi.advanceTimersByTimeAsync(1_999);
    expect(load).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledOnce();
    expect(hydrate).toHaveBeenCalledOnce();
  });
});
