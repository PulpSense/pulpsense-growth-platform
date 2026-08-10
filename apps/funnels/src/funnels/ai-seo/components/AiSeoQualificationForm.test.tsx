/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    analyticsId: "analytics-id",
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
    button.textContent?.includes("See Available Times"),
  ) as HTMLButtonElement;

const renderForm = async () => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <AiSeoQualificationForm
        funnelId="ai-seo"
        calLink="pulpsense/audit"
        turnstileSiteKey="test-site-key"
        qualifiedRedirect="/thank-you"
      />,
    );
  });

  const ownerButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("Yes, I own the business"),
  );
  expect(ownerButton).toBeInstanceOf(HTMLButtonElement);
  await act(async () => ownerButton?.click());
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
});

describe("AiSeoQualificationForm Turnstile gate", () => {
  it("renders Turnstile when the contact step mounts after the API is ready", async () => {
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

  it("keeps submission disabled until Turnstile supplies a token", async () => {
    await renderForm();

    const submitButton = getSubmitButton();

    expect(submitButton).toBeInstanceOf(HTMLButtonElement);
    expect(submitButton.disabled).toBe(true);
    expect(document.body.textContent).toContain("Running security check");
    expect(submission.submitContact).not.toHaveBeenCalled();
  });

  it("shows a recoverable error and accepts a later retry token", async () => {
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
    expect(getSubmitButton().disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "The security check could not start",
    );
    expect(document.body.textContent).toContain("Retry security check");
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
});
