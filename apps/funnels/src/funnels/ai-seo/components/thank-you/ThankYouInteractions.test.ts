import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

const interactionsSource = readFileSync(
  new URL("./ThankYouInteractions.astro", import.meta.url),
  "utf8",
);
const confettiSource = interactionsSource.match(
  /<script is:inline>\s*(\/\* Celebrate[\s\S]*?)<\/script>/,
)?.[1];

type MockElement = {
  animate: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => void;
  appendChild: (child: MockElement) => void;
  children: MockElement[];
  remove: () => void;
  setAttribute: () => void;
  style: Record<string, string>;
};

function runConfetti({
  reducedMotion = false,
  width = 390,
}: {
  reducedMotion?: boolean;
  width?: number;
} = {}) {
  if (!confettiSource) throw new Error("Confetti script was not found");

  const animations: Array<{
    keyframes: Keyframe[];
    options: KeyframeAnimationOptions;
  }> = [];
  const bodyChildren: MockElement[] = [];

  function createElement(): MockElement {
    const element: MockElement = {
      animate(keyframes, options) {
        animations.push({ keyframes, options });
      },
      appendChild(child) {
        this.children.push(child);
      },
      children: [],
      remove() {},
      setAttribute() {},
      style: {},
    };
    return element;
  }

  runInNewContext(confettiSource, {
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    document: {
      body: {
        appendChild(child: MockElement) {
          bodyChildren.push(child);
        },
      },
      createElement,
    },
    setTimeout() {},
    window: {
      innerHeight: 844,
      innerWidth: width,
      matchMedia: () => ({ matches: reducedMotion }),
    },
  });

  return { animations, bodyChildren };
}

describe("thank-you confetti", () => {
  it("uses compositor animations instead of a main-thread canvas loop", () => {
    const mobile = runConfetti();

    expect(interactionsSource).not.toContain("requestAnimationFrame");
    expect(interactionsSource).not.toContain('createElement("canvas")');
    expect(mobile.bodyChildren).toHaveLength(1);
    expect(mobile.animations).toHaveLength(48);
    const overlay = mobile.bodyChildren[0];
    const firstAnimation = mobile.animations[0];
    if (!overlay || !firstAnimation) throw new Error("Confetti did not render");
    expect(overlay.children).toHaveLength(48);
    expect(firstAnimation.keyframes).toHaveLength(3);
    expect(
      firstAnimation.keyframes.every(({ transform }) =>
        String(transform).includes("translate3d("),
      ),
    ).toBe(true);
  });

  it("keeps every confetti apex inside the viewport", () => {
    const mobile = runConfetti();
    const apexYs = mobile.animations.map(({ keyframes }) => {
      const transform = String(keyframes[1]?.transform);
      const match = transform.match(/translate3d\([^,]+,(-?[\d.]+)px,/);
      if (!match?.[1]) throw new Error("Confetti apex was not found");
      return Number(match[1]);
    });

    expect(Math.min(...apexYs)).toBeGreaterThanOrEqual(20);
  });

  it("preserves reduced motion and a denser desktop celebration", () => {
    expect(runConfetti({ reducedMotion: true }).bodyChildren).toHaveLength(0);
    expect(runConfetti({ width: 1200 }).animations).toHaveLength(80);
  });
});
