import { describe, expect, it } from "vitest";

import { applicationSubmissionRequestSchema } from "./application-submission-contract";
import { contactSubmissionRequestSchema } from "./contact-submission-contract";

const analyticsId = "311de7bf-a46f-49f9-a107-5cc030e960c3";

const contactRequest = {
  schemaVersion: 1,
  eventType: "contact_submitted",
  funnelId: "ai-seo",
  attemptId: "ab318a82-7872-4a66-bebd-a780fb25a71e",
  turnstileToken: "turnstile-token",
  payload: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@brand.com",
    phone: "+1 555 123 4567",
  },
  attribution: { firstTouch: {}, lastTouch: {} },
  sourceUrl: "https://preview.pulpsense.com/ai-seo/",
  analyticsId,
} as const;

describe("measurement submission contracts", () => {
  it("accepts the anonymous analytics ID at contact and application boundaries", () => {
    expect(
      contactSubmissionRequestSchema.parse(contactRequest).analyticsId,
    ).toBe(analyticsId);
    expect(
      applicationSubmissionRequestSchema.parse({
        schemaVersion: 1,
        eventType: "application_submitted",
        funnelId: "ai-seo",
        identity: {
          submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
          token: "signed-token",
        },
        payload: {
          businessOwner: "yes",
          marketingBudget: "$1,500+/month",
          investmentIntent: "Yes, if the numbers make sense",
        },
        sourceUrl: "https://preview.pulpsense.com/ai-seo/",
        analyticsId,
      }).analyticsId,
    ).toBe(analyticsId);
  });
});
