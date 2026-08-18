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

function seededMath() {
  let seed = 123456789;
  const math = Object.create(Math) as Math;
  math.random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return math;
}

function simulateFrames(timestamps: number[]) {
  if (!confettiSource) throw new Error("Confetti script was not found");

  const callbacks: Array<(timestamp: number) => void> = [];
  const translations: Array<[number, number]> = [];
  const context = {
    clearRect() {},
    fillRect() {},
    restore() {},
    rotate() {},
    save() {},
    setTransform() {},
    translate(x: number, y: number) {
      translations.push([x, y]);
    },
    fillStyle: "",
    globalAlpha: 1,
  };
  const canvas = {
    getContext: () => context,
    remove() {},
    setAttribute() {},
    style: { cssText: "" },
    width: 0,
    height: 0,
  };
  const window = {
    addEventListener() {},
    devicePixelRatio: 3,
    innerHeight: 844,
    innerWidth: 390,
    matchMedia: () => ({ matches: false }),
    removeEventListener() {},
  };
  const document = {
    body: { appendChild() {} },
    createElement: () => canvas,
  };

  runInNewContext(confettiSource, {
    Math: seededMath(),
    document,
    performance: { now: () => 0 },
    requestAnimationFrame(callback: (timestamp: number) => void) {
      callbacks.push(callback);
      return callbacks.length;
    },
    window,
  });

  for (const timestamp of timestamps) {
    const callback = callbacks.shift();
    if (!callback) throw new Error("Confetti animation frame was not queued");
    callback(timestamp);
  }

  const particleCount = 110;
  const firstParticle = translations.at(-particleCount);
  if (!firstParticle) throw new Error("Confetti particles were not rendered");

  return { canvas, firstParticle };
}

describe("thank-you confetti", () => {
  it("produces the same trajectory when mobile frames are dropped", () => {
    const frame = 1000 / 60;
    const smooth = simulateFrames(
      Array.from({ length: 6 }, (_, index) => (index + 1) * frame),
    );
    const dropped = simulateFrames([6 * frame]);

    expect(dropped.firstParticle[0]).toBeCloseTo(smooth.firstParticle[0], 8);
    expect(dropped.firstParticle[1]).toBeCloseTo(smooth.firstParticle[1], 8);
  });

  it("reduces canvas and particle work on mobile screens", () => {
    const mobile = simulateFrames([1000 / 60]);

    expect(mobile.canvas.width).toBe(390);
    expect(mobile.canvas.height).toBe(844);
    expect(interactionsSource).toContain(
      "var particleCount = isMobile ? 110 : 220",
    );
  });
});
