import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumber,
  isValidPhoneNumber,
  stripPhoneToDigits,
} from "./phone";
import { COUNTRIES } from "./phoneCountries";

describe("phone helpers", () => {
  it("formats US phone numbers as the user types", () => {
    expect(formatPhoneNumber("4155552671", DEFAULT_PHONE_COUNTRY)).toBe(
      "(415) 555-2671",
    );
    expect(stripPhoneToDigits("(415) 555-2671", 10)).toBe("4155552671");
  });

  it("validates normalized international phone numbers", () => {
    const unitedKingdom = COUNTRIES.find(({ code }) => code === "+44")!;
    expect(isValidPhoneNumber("20 7946 0958", unitedKingdom)).toBe(true);
    expect(isValidPhoneNumber("123", DEFAULT_PHONE_COUNTRY)).toBe(false);
  });
});
