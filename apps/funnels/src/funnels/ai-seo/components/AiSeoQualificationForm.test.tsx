/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAW_FIRM_GROWTH_CONSTRAINTS } from "@pulpsense/contracts";

import type { ApplicationPageContent } from "@/funnels/ai-seo/campaign-config";
import type { AiSeoFunnelId } from "@/funnels/ai-seo/campaigns";

import { AiSeoQualificationForm } from "./AiSeoQualificationForm";

const submission = vi.hoisted(() => ({
  submitContact: vi.fn(),
  submitApplication: vi.fn(),
  resetContactIdentity: vi.fn(() => false),
}));

vi.mock("@/components/ui/CalBookingStep", () => ({
  CalBookingStep: () => null,
}));
vi.mock("@/lib/funnel/use-funnel-submission", () => ({
  useFunnelSubmission: () => submission,
}));
vi.mock("@/utils/funnelAttribution", () => ({
  captureFunnelAttribution: () => ({
    attribution: { firstTouch: {}, lastTouch: {} },
  }),
}));
vi.mock("@/utils/funnelAnalytics", () => ({
  trackFunnelEvent: vi.fn(),
}));
vi.mock("@/utils/metaCapi", () => ({ trackMetaEvent: vi.fn() }));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
type TurnstileOptions = Parameters<
  NonNullable<Window["turnstile"]>["render"]
>[1];

const getSubmitButton = () =>
  Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("Continue"),
  ) as HTMLButtonElement;

const getButton = (label: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === label,
  ) as HTMLButtonElement;

const lawFirmQualification = {
  kind: "single-select",
  question: "What is currently stopping your firm from signing more matters?",
  analyticsField: "growth_constraint",
  submissionField: "growthConstraint",
  formVersion: "2026-08-22",
  options: LAW_FIRM_GROWTH_CONSTRAINTS,
} as const satisfies ApplicationPageContent["qualification"];

const ownerBudgetQualification = {
  kind: "owner-budget",
} as const satisfies ApplicationPageContent["qualification"];

const lawFirmOwnerBudgetQualification = {
  kind: "owner-budget",
  ownerQuestion: "Are you the owner or primary decision-maker for the firm?",
  budgetQuestion:
    "What monthly marketing budget have you set aside to generate more qualified new-client inquiries?",
} as const satisfies ApplicationPageContent["qualification"];

const enterValue = async (selector: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(selector);
  expect(input).toBeInstanceOf(HTMLInputElement);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const renderForm = async (
  turnstileSiteKey: string | null = "test-site-key",
  funnelId: AiSeoFunnelId = "ai-seo",
  qualification: ApplicationPageContent["qualification"] = lawFirmQualification,
) => {
  const container = document.createElement("div");
  container.id = "pr-funnel";
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <AiSeoQualificationForm
        funnelId={funnelId}
        calLink="pulpsense/audit"
        turnstileSiteKey={turnstileSiteKey ?? undefined}
        qualifiedRedirect="/thank-you"
        qualification={qualification}
      />,
    );
  });
};

beforeEach(() => {
  submission.submitContact.mockReset();
  submission.submitApplication.mockReset();
  submission.resetContactIdentity.mockReset().mockReturnValue(false);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  document.head.replaceChildren();
  delete window.turnstile;
  vi.unstubAllGlobals();
});

describe("AiSeoQualificationForm Turnstile gate", () => {
  it("uses the always-pass Turnstile site key in local development", async () => {
    const render = vi.fn(() => "widget-id");
    window.turnstile = {
      render,
      remove: vi.fn(),
      reset: vi.fn(),
    };

    await renderForm(null);

    expect(render).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: "1x00000000000000000000AA" }),
    );
  });

  it("renders Turnstile when the initial contact step mounts", async () => {
    let issueToken: ((token: string) => void) | undefined;
    const render = vi.fn((_element, options) => {
      issueToken = options.callback;
      return "widget-id";
    });
    window.turnstile = {
      render,
      remove: vi.fn(),
      reset: vi.fn(),
    };

    await renderForm();

    expect(render).toHaveBeenCalledOnce();
    await act(async () => issueToken?.("verified-token"));

    expect(getSubmitButton().disabled).toBe(false);
  });

  it("keeps the background Turnstile check out of the form UI", async () => {
    await renderForm();

    const submitButton = getSubmitButton();

    expect(submitButton).toBeInstanceOf(HTMLButtonElement);
    expect(submitButton.disabled).toBe(true);
    expect(document.body.textContent).not.toContain("Running security check");
    expect(document.body.textContent).not.toContain("Security check complete");
    expect(submission.submitContact).not.toHaveBeenCalled();
  });

  it("keeps a recoverable Turnstile failure out of the form UI", async () => {
    let options: TurnstileOptions | undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    window.turnstile = {
      render: vi.fn((_element, widgetOptions) => {
        options = widgetOptions;
        return "widget-id";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };

    await renderForm();
    const callbacks = options as TurnstileOptions;

    await act(async () => callbacks["error-callback"]?.("110200"));
    expect(getSubmitButton().disabled).toBe(false);
    expect(document.body.textContent).not.toContain("security check");
    expect(document.body.textContent).not.toContain("Retry security check");
    expect(warn).toHaveBeenCalledWith("PulpSense Turnstile failed", {
      funnelId: "ai-seo",
      status: "error",
      code: "110200",
    });

    await act(async () => callbacks.callback("retry-token"));
    expect(getSubmitButton().disabled).toBe(false);
    expect(document.body.textContent).not.toContain("Security check complete");

    warn.mockRestore();
  });

  it("does not show the verified email check when the verifier is unavailable", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ valid: false, status: "unverified" }));
    vi.stubGlobal("fetch", fetchMock);

    await renderForm();

    const emailInput =
      document.querySelector<HTMLInputElement>("#ai-seo-email");
    expect(emailInput).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(emailInput, "name@gmail.com");
      emailInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      emailInput?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(document.querySelector('[aria-label="Email verified"]')).toBeNull();
    expect(document.body.textContent).not.toContain(
      "Please enter a valid email address.",
    );
  });

  it("shows a red invalid-email indicator and message for a rejected email", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ valid: false, status: "invalid" })),
    );

    await renderForm();

    const emailInput =
      document.querySelector<HTMLInputElement>("#ai-seo-email");
    expect(emailInput).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(emailInput, "asdf@alksjdf.com");
      emailInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      emailInput?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(
      document.querySelector('[aria-label="Email is invalid"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Email is invalid. Please enter a valid email address.",
    );
  });
});

describe("AiSeoQualificationForm step order", () => {
  it("enters focus mode while saving contact details and restores the page on failure", async () => {
    let issueToken: ((token: string) => void) | undefined;
    let resolveContact!: (result: {
      accepted: false;
      error: "rate_limited";
      retryAvailable: true;
    }) => void;
    window.turnstile = {
      render: vi.fn((_element, options) => {
        issueToken = options.callback;
        return "widget-id";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    submission.submitContact.mockReturnValue(
      new Promise((resolve) => {
        resolveContact = resolve;
      }),
    );

    await renderForm();
    await act(async () => issueToken?.("verified-token"));
    await enterValue("#ai-seo-first", "Santi");
    await enterValue("#ai-seo-email", "santi@example.com");
    await enterValue("#ai-seo-phone", "2125551212");
    await act(async () => {
      getSubmitButton().click();
      await Promise.resolve();
    });

    expect(document.getElementById("pr-funnel")?.classList).toContain(
      "pr-qualification-active",
    );

    await act(async () => {
      resolveContact({
        accepted: false,
        error: "rate_limited",
        retryAvailable: true,
      });
      await Promise.resolve();
    });

    expect(document.getElementById("pr-funnel")?.classList).not.toContain(
      "pr-qualification-active",
    );
    expect(document.body.textContent).toContain(
      "Too many attempts. Please wait a minute and try again.",
    );
  });

  it("captures the lead before showing qualification questions", async () => {
    let issueToken: ((token: string) => void) | undefined;
    window.turnstile = {
      render: vi.fn((_element, options) => {
        issueToken = options.callback;
        return "widget-id";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    submission.submitContact.mockResolvedValue({
      accepted: true,
      eventId: "contact_submitted:submission-id",
      prospectId: "prospect-id",
      leadJourneyId: "submission-id",
    });

    await renderForm();

    expect(document.body.textContent).toContain(
      "Enter your details to start your free audit request",
    );
    expect(document.body.textContent).not.toContain(
      "What is currently stopping your firm from signing more matters?",
    );

    await act(async () => issueToken?.("verified-token"));
    await enterValue("#ai-seo-first", "Santi");
    await enterValue("#ai-seo-email", "santi@example.com");
    await enterValue("#ai-seo-phone", "2125551212");
    expect(
      document.querySelector<HTMLInputElement>("#ai-seo-phone")?.value,
    ).toBe("(212) 555-1212");
    await act(async () => getSubmitButton().click());

    expect(submission.submitContact).toHaveBeenCalledOnce();
    expect(submission.submitApplication).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "What is currently stopping your firm from signing more matters?",
    );
    expect(document.querySelectorAll(".pr-tf-choice")).toHaveLength(4);
    expect(document.getElementById("pr-funnel")?.classList).toContain(
      "pr-qualification-active",
    );

    await act(async () => getButton("← Back").click());

    expect(document.body.textContent).toContain(
      "Enter your details to start your free audit request",
    );
    expect(document.getElementById("pr-funnel")?.classList).not.toContain(
      "pr-qualification-active",
    );
  });

  it("submits the qualified application after the lead", async () => {
    let issueToken: ((token: string) => void) | undefined;
    window.turnstile = {
      render: vi.fn((_element, options) => {
        issueToken = options.callback;
        return "widget-id";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    submission.submitContact.mockResolvedValue({
      accepted: true,
      eventId: "contact_submitted:submission-id",
      prospectId: "prospect-id",
      leadJourneyId: "submission-id",
    });
    submission.submitApplication.mockResolvedValue({
      accepted: true,
      eventId: "application_submitted:submission-id",
      qualificationStatus: "qualified",
      nextStep: "booking",
      bookingIdentity: { submissionId: "submission-id", token: "token" },
    });

    await renderForm();
    await act(async () => issueToken?.("verified-token"));
    await enterValue("#ai-seo-first", "Santi");
    await enterValue("#ai-seo-email", "santi@example.com");
    await enterValue("#ai-seo-phone", "2125551212");
    await act(async () => getSubmitButton().click());
    await act(async () =>
      getButton("Intake isn't converting enough inquiries").click(),
    );

    expect(submission.submitContact).toHaveBeenCalledOnce();
    expect(submission.submitApplication).toHaveBeenCalledOnce();
    expect(submission.submitApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          growthConstraint: "Intake isn't converting enough inquiries",
        },
      }),
    );
    expect(document.body.textContent).not.toContain(
      "would you be open to investing",
    );
    expect(document.body.textContent).toContain("Book Free Audit Call");
  });

  it("selects the qualification flow from configuration", async () => {
    let issueToken: ((token: string) => void) | undefined;
    window.turnstile = {
      render: vi.fn((_element, options) => {
        issueToken = options.callback;
        return "widget-id";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    submission.submitContact.mockResolvedValue({
      accepted: true,
      eventId: "contact_submitted:submission-id",
      prospectId: "prospect-id",
      leadJourneyId: "submission-id",
    });

    await renderForm("test-site-key", "ai-seo", ownerBudgetQualification);
    await act(async () => issueToken?.("verified-token"));
    await enterValue("#ai-seo-first", "Santi");
    await enterValue("#ai-seo-email", "santi@example.com");
    await enterValue("#ai-seo-phone", "2125551212");
    await act(async () => getSubmitButton().click());

    expect(document.body.textContent).toContain(
      "Are you the owner or primary decision-maker",
    );
    expect(document.body.textContent).not.toContain(
      "What is currently stopping your firm from signing more matters?",
    );
  });

  it("keeps the owner-budget flow while personalizing its question copy", async () => {
    let issueToken: ((token: string) => void) | undefined;
    window.turnstile = {
      render: vi.fn((_element, options) => {
        issueToken = options.callback;
        return "widget-id";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    submission.submitContact.mockResolvedValue({
      accepted: true,
      eventId: "contact_submitted:submission-id",
      prospectId: "prospect-id",
      leadJourneyId: "submission-id",
    });

    await renderForm(
      "test-site-key",
      "ai-seo",
      lawFirmOwnerBudgetQualification,
    );
    await act(async () => issueToken?.("verified-token"));
    await enterValue("#ai-seo-first", "Santi");
    await enterValue("#ai-seo-email", "santi@example.com");
    await enterValue("#ai-seo-phone", "2125551212");
    await act(async () => getSubmitButton().click());

    expect(document.body.textContent).toContain(
      "Are you the owner or primary decision-maker for the firm?",
    );
    await act(async () => getButton("Yes").click());
    expect(document.body.textContent).toContain(
      "What monthly marketing budget have you set aside to generate more qualified new-client inquiries?",
    );
    expect(document.querySelectorAll(".pr-tf-choice")).toHaveLength(3);
  });
});
