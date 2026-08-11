import { describe, expect, it } from "vitest";
import { renderPrecallEmail } from "./render-precall-email.js";

const variables = {
  first_name: "<Ada>",
  meeting_local_date: "August 12, 2026",
  meeting_local_time: "4:00 PM",
  meeting_local_weekday: "Wednesday",
  attendee_timezone: "Europe/Budapest",
  acquisition_source_label: "one of our ads on Facebook or Instagram",
  precall_opt_out_url: "https://example.com/precall-opt-out?token=abc",
  business_postal_address: "123 Main St, Casper, WY",
  sender_name: "Santi",
};

describe("pre-call renderer", () => {
  it("renders escaped HTML and a text version with the compliance footer", () => {
    const result = renderPrecallEmail("confirmation", variables);
    expect(result.textContent).toContain("Hi <Ada>, it's Santi.");
    expect(result.htmlContent).toContain("&lt;Ada&gt;");
    expect(result.htmlContent).toContain("Your appointment will stay booked.");
    expect(result.htmlContent).not.toContain("undefined");
  });

  it("fails closed when a required variable is missing", () => {
    const incomplete = { ...variables, first_name: undefined } as unknown as typeof variables;
    expect(() => renderPrecallEmail("confirmation", incomplete)).toThrow(
      "Missing pre-call variable: first_name",
    );
  });

  it("does not emit a meeting URL field or join link", () => {
    const result = renderPrecallEmail("final-preparation", variables);
    expect(result.textContent).not.toContain("meeting_url");
    expect(result.textContent.toLowerCase()).not.toContain("join link");
  });
});
