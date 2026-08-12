import { describe, expect, it, vi } from "vitest";

import { DTMF_TONES, isDtmfTone, sendDtmfTone } from "./dialpad";

describe("softphone dial pad", () => {
  it("offers the complete standard DTMF keypad", () => {
    expect(DTMF_TONES).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "*",
      "0",
      "#",
    ]);
  });

  it.each(DTMF_TONES)("sends the %s tone through the active call", (tone) => {
    const dtmf = vi.fn();

    sendDtmfTone({ dtmf }, tone);

    expect(dtmf).toHaveBeenCalledOnce();
    expect(dtmf).toHaveBeenCalledWith(tone);
  });

  it("rejects values that are not DTMF tones", () => {
    expect(isDtmfTone("+")).toBe(false);
    expect(() => sendDtmfTone({ dtmf: vi.fn() }, "+")).toThrow(
      "invalid_dtmf_tone",
    );
  });
});
