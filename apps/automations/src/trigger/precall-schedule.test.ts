import { describe, expect, it } from "vitest";
import {
  buildPrecallSchedule,
  calculateEmailCount,
  middleModuleBit,
  sequenceIdFor,
  selectPrecallModules,
} from "./precall-schedule.js";

const at = (hours: number) => {
  const now = new Date("2026-08-12T08:00:00.000Z");
  return { now, meetingStart: new Date(now.getTime() + hours * 60 * 60_000) };
};

describe("pre-call schedule", () => {
  it.each([
    [4, 4],
    [6, 4],
    [12, 4],
    [18, 5],
    [24, 6],
    [36, 9],
    [48, 12],
    [60, 15],
    [72, 18],
    [120, 18],
  ])("calculates %s hours as %s emails", (hours, expected) => {
    expect(calculateEmailCount(hours)).toBe(expected);
  });

  it("keeps confirmation first and final preparation last", () => {
    const schedule = buildPrecallSchedule(at(48));
    expect(schedule[0]?.moduleId).toBe("confirmation");
    expect(schedule.at(-1)?.moduleId).toBe("final-preparation");
    expect(schedule).toHaveLength(12);
  });

  it("uses the short-notice spacing pattern", () => {
    const { now } = at(4);
    const schedule = buildPrecallSchedule(at(4));
    expect(schedule).toHaveLength(4);
    expect(schedule[1]?.sendAt.getTime() - now.getTime()).toBe(36 * 60_000);
    expect(schedule[2]?.sendAt.getTime() - now.getTime()).toBe(72 * 60_000);
    expect(schedule[3]?.sendAt.getTime() - now.getTime()).toBe(3 * 60 * 60_000);
  });

  it("does not repeat middle modules after rescheduling", () => {
    const sentMask = middleModuleBit("what-we-will-inspect") | middleModuleBit("proof-twin-oaks");
    expect(selectPrecallModules(6, sentMask)).toEqual([
      "confirmation",
      "measurement-and-attribution",
      "already-have-seo",
      "guarantee",
      "google-and-ai-mechanism",
      "final-preparation",
    ]);
  });

  it("keeps nurture away from future Gmail thresholds", () => {
    const { meetingStart } = at(24);
    const schedule = buildPrecallSchedule(at(24));
    const protectedTimes = [
      meetingStart.getTime() - 24 * 60 * 60_000,
      meetingStart.getTime() - 2 * 60 * 60_000,
      meetingStart.getTime() - 15 * 60_000,
    ];
    for (const slot of schedule.slice(1)) {
      for (const reminder of protectedTimes) {
        expect(Math.abs(slot.sendAt.getTime() - reminder)).toBeGreaterThanOrEqual(45 * 60_000);
      }
    }
  });

  it("builds stable sequence identities", () => {
    expect(sequenceIdFor("booking-123", "2026-08-12T16:00:00.000Z")).toBe(
      "precall:booking-123:2026-08-12T16:00:00.000Z:precall-v1",
    );
  });
});
