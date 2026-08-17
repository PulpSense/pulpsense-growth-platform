import { describe, expect, it } from "vitest";

import { isInternalTestLeadEmail } from "./internal-test-lead.js";

describe("isInternalTestLeadEmail", () => {
  it.each([
    "santi@pulpsense.com",
    " SANTI@PULPSENSE.COM ",
    "me@santileoni.com",
  ])("recognizes owned test address %s", (email) => {
    expect(isInternalTestLeadEmail(email)).toBe(true);
  });

  it("does not suppress other addresses on an owned domain", () => {
    expect(isInternalTestLeadEmail("prospect@pulpsense.com")).toBe(false);
  });
});
