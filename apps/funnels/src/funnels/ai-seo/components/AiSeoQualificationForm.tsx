"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CalBookingStep } from "@/components/ui/CalBookingStep";
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumber,
  isValidPhoneNumber,
  stripPhoneToDigits,
} from "@/components/ui/phone";
import { COUNTRIES, type Country } from "@/components/ui/phoneCountries";
import type { AiSeoFunnelId } from "@/funnels/ai-seo/campaigns";
import { useFunnelSubmission } from "@/lib/funnel/use-funnel-submission";
import { isBusinessEmail } from "@/utils/businessEmail";
import { getBrowserCookie } from "@/utils/browserCookie";
import {
  captureFunnelAttribution,
  type FunnelAttribution,
} from "@/utils/funnelAttribution";
import { trackFunnelEvent } from "@/utils/funnelAnalytics";
import { trackMetaEvent, trackMetaSchedule } from "@/utils/metaCapi";

declare global {
  interface Window {
    turnstile?: {
      render(
        element: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          appearance?: "always" | "execute" | "interaction-only";
          callback(token: string): void;
          "error-callback"?(errorCode: string): boolean | void;
          "expired-callback"?(): void;
          "timeout-callback"?(): void;
          "unsupported-callback"?(): void;
        },
      ): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

type Step =
  | "owner"
  | "marketing-budget"
  | "investment"
  | "contact"
  | "calendar"
  | "not-qualified";
type MarketingBudget = "$500–$1,500/month" | "$1,500+/month";
type InvestmentIntent =
  | "Yes, if the numbers make sense"
  | "Maybe—I’m exploring options";
type EmailStatus = "idle" | "verifying" | "valid" | "invalid";
type TurnstileStatus =
  | "loading"
  | "rendering"
  | "ready"
  | "error"
  | "expired"
  | "timeout"
  | "unsupported";

const unavailableTurnstileStatuses = new Set<TurnstileStatus>([
  "error",
  "expired",
  "timeout",
  "unsupported",
]);

type ContactData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  website: string;
};

type Props = {
  funnelId: AiSeoFunnelId;
  calLink: string;
  calNamespace?: string;
  turnstileSiteKey?: string;
  qualifiedRedirect: string;
};

const initialContact: ContactData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  website: "",
};

const qualificationQuestions = {
  business_owner:
    "Are you the owner or primary decision-maker for the business?",
  marketing_budget:
    "What monthly marketing budget have you set aside to generate more leads?",
  investment_intent:
    "If there is a clear opportunity to generate more leads, would you be open to investing in fixing it?",
} as const;

const recordQualificationSnapshot = (
  status: "qualified" | "unqualified",
  answers: Record<string, unknown>,
) =>
  trackFunnelEvent("funnel_qualification_submitted", {
    qualification_status: status,
    qualification_form_id: "ai-seo",
    qualification_form_version: "2026-08-15",
    qualification_questions: qualificationQuestions,
    qualification_answers: answers,
  });

export function AiSeoQualificationForm({
  funnelId,
  calLink,
  calNamespace,
  turnstileSiteKey,
  qualifiedRedirect,
}: Props) {
  const [step, setStep] = useState<Step>("owner");
  const [marketingBudget, setMarketingBudget] = useState<MarketingBudget>();
  const [investmentIntent, setInvestmentIntent] = useState<InvestmentIntent>();
  const [contact, setContact] = useState<ContactData>(initialContact);
  const [phoneCountry, setPhoneCountry] = useState<Country>(
    DEFAULT_PHONE_COUNTRY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>(
    turnstileSiteKey ? "loading" : "error",
  );
  const [bookingIdentity, setBookingIdentity] = useState<{
    submissionId: string;
    token: string;
  }>();
  const measurement = useRef<{
    attribution: FunnelAttribution;
  }>({ attribution: { firstTouch: {}, lastTouch: {} } });
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | undefined>(undefined);
  const emailAbortRef = useRef<AbortController | undefined>(undefined);
  const lastVerifiedEmail = useRef("");
  const { submitContact, submitApplication, resetContactIdentity } =
    useFunnelSubmission(funnelId);

  useEffect(() => {
    measurement.current = captureFunnelAttribution({
      funnelId,
      href: window.location.href,
      referrer: document.referrer,
      storage: window.localStorage,
    });
    trackFunnelEvent("funnel_step_viewed", { step: "qualification" });
  }, [funnelId]);

  useEffect(() => {
    const funnelRoot = document.getElementById("pr-funnel");
    funnelRoot?.classList.toggle("pr-calendar-active", step === "calendar");
    return () => funnelRoot?.classList.remove("pr-calendar-active");
  }, [step]);

  useEffect(() => {
    if (step !== "contact") return;

    if (!turnstileSiteKey) {
      console.warn("PulpSense Turnstile failed", {
        funnelId,
        status: "error",
        code: "site_key_missing",
      });
      return;
    }

    let active = true;
    let loadTimeout: number | undefined;

    const reportFailure = (
      status: Extract<
        TurnstileStatus,
        "error" | "expired" | "timeout" | "unsupported"
      >,
      code: string,
    ) => {
      if (!active) return;
      setTurnstileToken("");
      setTurnstileStatus(status);
      const detail = { funnelId, status, code };
      console.warn("PulpSense Turnstile failed", detail);
      window.dispatchEvent(
        new CustomEvent("pulpsense:turnstile-failure", { detail }),
      );
    };

    const renderWidget = () => {
      if (
        !active ||
        !window.turnstile ||
        !turnstileContainerRef.current ||
        turnstileWidgetRef.current
      ) {
        return;
      }
      setTurnstileStatus("rendering");
      try {
        turnstileWidgetRef.current = window.turnstile.render(
          turnstileContainerRef.current,
          {
            sitekey: turnstileSiteKey,
            action: "contact_submit",
            appearance: "interaction-only",
            callback: (token) => {
              if (!active) return;
              setTurnstileToken(token);
              setTurnstileStatus("ready");
              setSubmissionError("");
            },
            "error-callback": (errorCode) => {
              reportFailure("error", errorCode || "challenge_error");
            },
            "expired-callback": () => {
              reportFailure("expired", "token_expired");
            },
            "timeout-callback": () => {
              reportFailure("timeout", "challenge_timeout");
            },
            "unsupported-callback": () => {
              reportFailure("unsupported", "browser_unsupported");
            },
          },
        );
      } catch {
        reportFailure("error", "render_failed");
      }
    };

    const script = document.querySelector<HTMLScriptElement>(
      "script[data-pulpsense-turnstile]",
    );
    if (window.turnstile) {
      renderWidget();
    } else if (script?.dataset.status === "error") {
      reportFailure("error", "api_script_failed");
    } else {
      script?.addEventListener("load", renderWidget, { once: true });
      script?.addEventListener(
        "error",
        () => reportFailure("error", "api_script_failed"),
        { once: true },
      );
      loadTimeout = window.setTimeout(() => {
        if (window.turnstile) renderWidget();
        else reportFailure("timeout", "api_load_timeout");
      }, 20_000);
    }

    return () => {
      active = false;
      if (loadTimeout) window.clearTimeout(loadTimeout);
      script?.removeEventListener("load", renderWidget);
      if (turnstileWidgetRef.current) {
        window.turnstile?.remove(turnstileWidgetRef.current);
        turnstileWidgetRef.current = undefined;
      }
    };
  }, [funnelId, step, turnstileSiteKey]);

  const retryTurnstile = useCallback(() => {
    setSubmissionError("");
    setTurnstileToken("");
    if (window.turnstile && turnstileWidgetRef.current) {
      setTurnstileStatus("rendering");
      try {
        window.turnstile.reset(turnstileWidgetRef.current);
        return;
      } catch {
        // Reloading below also retries a failed or stale API script.
      }
    }
    window.location.reload();
  }, []);

  const updateContact = useCallback(
    (field: keyof ContactData, value: string) => {
      setContact((current) => ({ ...current, [field]: value }));
      const resetIdentity = resetContactIdentity();
      if (resetIdentity && turnstileWidgetRef.current) {
        window.turnstile?.reset(turnstileWidgetRef.current);
        setTurnstileToken("");
        setTurnstileStatus("rendering");
      }
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
      setSubmissionError("");
    },
    [resetContactIdentity],
  );

  const verifyEmail = useCallback(async () => {
    const email = contact.email.trim().toLowerCase();
    if (!email || !isBusinessEmail(email)) {
      setEmailStatus("idle");
      return;
    }
    if (email === lastVerifiedEmail.current) return;

    emailAbortRef.current?.abort();
    const controller = new AbortController();
    emailAbortRef.current = controller;
    setEmailStatus("verifying");
    try {
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      const result = (await response.json()) as {
        valid?: boolean;
        status?: "verified" | "unverified" | "invalid";
      };
      if (controller.signal.aborted) return;
      lastVerifiedEmail.current = email;
      if (result.valid && result.status === "verified") {
        setEmailStatus("valid");
        setErrors((current) => {
          const next = { ...current };
          delete next.email;
          return next;
        });
      } else if (result.status === "invalid") {
        setEmailStatus("invalid");
        setErrors((current) => ({
          ...current,
          email: "Please enter a valid business email.",
        }));
      } else {
        setEmailStatus("idle");
        setErrors((current) => {
          const next = { ...current };
          delete next.email;
          return next;
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setEmailStatus("idle");
    }
  }, [contact.email]);

  const chooseOwner = (owner: "yes" | "no") => {
    if (owner === "yes") {
      setStep("marketing-budget");
    } else {
      trackFunnelEvent("qualification_outcome", { status: "unqualified" });
      recordQualificationSnapshot("unqualified", { business_owner: "no" });
      setStep("not-qualified");
    }
  };

  const chooseMarketingBudget = (
    budget: MarketingBudget | "under-500-per-month",
  ) => {
    if (budget === "under-500-per-month") {
      trackFunnelEvent("qualification_outcome", { status: "unqualified" });
      recordQualificationSnapshot("unqualified", {
        business_owner: "yes",
        marketing_budget: "Under $500/month or not set yet",
      });
      setStep("not-qualified");
      return;
    }
    setMarketingBudget(budget);
    setStep("investment");
  };

  const chooseInvestmentIntent = (
    intent: InvestmentIntent | "free-information-only",
  ) => {
    if (intent === "free-information-only") {
      trackFunnelEvent("qualification_outcome", { status: "unqualified" });
      recordQualificationSnapshot("unqualified", {
        business_owner: "yes",
        marketing_budget: marketingBudget,
        investment_intent: "No, I’m only looking for free information",
      });
      setStep("not-qualified");
      return;
    }
    setInvestmentIntent(intent);
    trackFunnelEvent("qualification_outcome", { status: "qualified" });
    setStep("contact");
    trackFunnelEvent("funnel_step_viewed", { step: "contact" });
  };

  const validateContact = () => {
    const next: Record<string, string> = {};
    if (!contact.firstName.trim()) next.firstName = "First name is required.";
    if (!isBusinessEmail(contact.email)) {
      next.email = "Please enter a valid business email.";
    }
    if (!isValidPhoneNumber(contact.phone, phoneCountry)) {
      next.phone = "Please enter a valid phone number.";
    }
    if (contact.website.trim()) next.website = "Invalid submission.";
    setErrors(next);
    if (Object.keys(next).length) {
      trackFunnelEvent("funnel_validation_failed", {
        step: "contact",
        fields: Object.keys(next),
      });
    }
    return Object.keys(next).length === 0;
  };

  const handleContactSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!validateContact() || submitting) return;
    if (!turnstileToken) {
      retryTurnstile();
      setSubmissionError(
        "We couldn't submit your details yet. Please try again.",
      );
      return;
    }
    if (!marketingBudget || !investmentIntent) {
      setStep("owner");
      return;
    }
    setSubmitting(true);
    setSubmissionError("");

    const sourceUrl = window.location.href;
    const referrer = document.referrer || undefined;
    const fbp = getBrowserCookie("_fbp");
    const fbc = getBrowserCookie("_fbc");
    const sharedContext = {
      sourceUrl,
      ...(referrer ? { referrer } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    };

    try {
      const contactResult = await submitContact({
        data: contact,
        phoneCountryCode: phoneCountry.code,
        attribution: measurement.current.attribution,
        turnstileToken,
        ...sharedContext,
      });
      if (!contactResult.accepted) {
        setSubmissionError(
          contactResult.error === "email_invalid"
            ? "Please correct your business email and try again."
            : contactResult.error === "rate_limited"
              ? "Too many attempts. Please wait a minute and try again."
              : contactResult.error === "turnstile_unavailable"
                ? "We couldn't submit your details yet. Please try again."
                : "We could not save your details yet. Please try again.",
        );
        if (!contactResult.retryAvailable && turnstileWidgetRef.current) {
          window.turnstile?.reset(turnstileWidgetRef.current);
          setTurnstileToken("");
          setTurnstileStatus("rendering");
        }
        return;
      }

      trackFunnelEvent("funnel_step_completed", { step: "contact" });
      trackMetaEvent(
        "Lead",
        { content_name: "AI SEO Contact Step", funnel_id: funnelId },
        {
          email: contact.email,
          phone: `${phoneCountry.code} ${contact.phone}`,
        },
        { eventId: contactResult.eventId, serverHandled: true },
      );

      const applicationResult = await submitApplication({
        data: {
          businessOwner: "yes",
          marketingBudget,
          investmentIntent,
        },
        ...sharedContext,
      });
      if (
        !applicationResult.accepted ||
        applicationResult.nextStep !== "booking" ||
        !applicationResult.bookingIdentity
      ) {
        setSubmissionError(
          "Booking is not available for this submission. Please check your email and try again.",
        );
        return;
      }

      trackFunnelEvent("funnel_step_completed", { step: "qualification" });
      recordQualificationSnapshot("qualified", {
        business_owner: "yes",
        marketing_budget: marketingBudget,
        investment_intent: investmentIntent,
      });
      trackMetaEvent(
        "SubmitApplication",
        { qualification_status: "qualified" },
        {
          email: contact.email,
          phone: `${phoneCountry.code} ${contact.phone}`,
        },
        { eventId: applicationResult.eventId, serverHandled: true },
      );
      setBookingIdentity(applicationResult.bookingIdentity);
      setStep("calendar");
      trackFunnelEvent("funnel_step_viewed", { step: "booking" });
    } catch {
      setSubmissionError(
        "We could not save your details yet. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentStep =
    step === "owner" || step === "not-qualified"
      ? 1
      : step === "marketing-budget"
        ? 2
        : step === "investment"
          ? 3
          : step === "contact"
            ? 4
            : 5;

  const handleBookingSuccessful = useCallback(
    (bookingUid: string) => {
      trackFunnelEvent("booking_interaction", {
        action: "booking_successful",
      });
      trackMetaSchedule({ bookingUid, funnelId });
      window.location.assign(qualifiedRedirect);
    },
    [funnelId, qualifiedRedirect],
  );

  return (
    <div className="pr-tf">
      <div className="pr-tf-progress" aria-live="polite">
        <span>Step {currentStep} of 5</span>
        <div className="pr-tf-progress-bar">
          <div
            className="pr-tf-progress-fill"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>
      <div className="pr-tf-card">
        {step === "owner" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">
              Are you the owner or primary decision-maker for the business?
            </p>
            <div className="pr-tf-choices">
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseOwner("yes")}
              >
                Yes
              </button>
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseOwner("no")}
              >
                No
              </button>
            </div>
          </div>
        )}

        {step === "marketing-budget" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">
              What monthly marketing budget have you set aside to generate more
              qualified leads?
            </p>
            <div className="pr-tf-choices">
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseMarketingBudget("$1,500+/month")}
              >
                $1,500+/month
              </button>
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseMarketingBudget("$500–$1,500/month")}
              >
                $500–$1,500/month
              </button>
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseMarketingBudget("under-500-per-month")}
              >
                Under $500/month or not set yet
              </button>
            </div>
            <div className="pr-tf-actions">
              <button
                type="button"
                className="pr-tf-back"
                onClick={() => setStep("owner")}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === "investment" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">
              If we identify a clear opportunity to generate more qualified
              leads, would you be open to investing in fixing it?
            </p>
            <div className="pr-tf-choices">
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() =>
                  chooseInvestmentIntent("Yes, if the numbers make sense")
                }
              >
                Yes, if the numbers make sense
              </button>
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() =>
                  chooseInvestmentIntent("Maybe—I’m exploring options")
                }
              >
                Maybe, I&apos;m exploring options
              </button>
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseInvestmentIntent("free-information-only")}
              >
                No, I&apos;m only looking for free information
              </button>
            </div>
            <div className="pr-tf-actions">
              <button
                type="button"
                className="pr-tf-back"
                onClick={() => setStep("marketing-budget")}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === "contact" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">
              Great — enter your details to book your free audit call
            </p>
            <p className="pr-tf-legend">
              <span className="pr-tf-req" aria-hidden="true">
                *
              </span>{" "}
              Required
            </p>
            <form autoComplete="on" noValidate onSubmit={handleContactSubmit}>
              <div className="pr-tf-hp-wrap" aria-hidden="true">
                <label htmlFor="ai-seo-website">Company website</label>
                <input
                  id="ai-seo-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={contact.website}
                  onChange={(event) =>
                    updateContact("website", event.target.value)
                  }
                />
              </div>
              <div className="pr-tf-fields">
                <div className="pr-tf-field-row">
                  <div className="pr-tf-field">
                    <label htmlFor="ai-seo-first">
                      First name <span className="pr-tf-req">*</span>
                    </label>
                    <input
                      id="ai-seo-first"
                      autoComplete="given-name"
                      value={contact.firstName}
                      onChange={(event) =>
                        updateContact("firstName", event.target.value)
                      }
                    />
                    {errors.firstName && (
                      <span className="pr-tf-error">{errors.firstName}</span>
                    )}
                  </div>
                  <div className="pr-tf-field">
                    <label htmlFor="ai-seo-last">Last name (optional)</label>
                    <input
                      id="ai-seo-last"
                      autoComplete="family-name"
                      value={contact.lastName}
                      onChange={(event) =>
                        updateContact("lastName", event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="pr-tf-field">
                  <label htmlFor="ai-seo-email">
                    Business email <span className="pr-tf-req">*</span>
                  </label>
                  <div className="pr-tf-email-control">
                    <input
                      id="ai-seo-email"
                      type="email"
                      autoComplete="email"
                      value={contact.email}
                      onChange={(event) => {
                        updateContact("email", event.target.value);
                        setEmailStatus("idle");
                      }}
                      onBlur={() => void verifyEmail()}
                    />
                    {emailStatus === "verifying" && (
                      <span
                        className="pr-tf-email-indicator pr-tf-email-indicator--loading"
                        role="status"
                        aria-label="Checking email"
                      />
                    )}
                    {emailStatus === "valid" && (
                      <span
                        className="pr-tf-email-indicator pr-tf-email-indicator--valid"
                        role="status"
                        aria-label="Email verified"
                      >
                        ✓
                      </span>
                    )}
                    {emailStatus === "invalid" && (
                      <span
                        className="pr-tf-email-indicator pr-tf-email-indicator--invalid"
                        role="status"
                        aria-label="Email is invalid"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {errors.email && (
                    <span className="pr-tf-error">
                      Email is invalid. {errors.email}
                    </span>
                  )}
                </div>
                <div className="pr-tf-field">
                  <label htmlFor="ai-seo-phone">
                    Phone <span className="pr-tf-req">*</span>
                  </label>
                  <div className="pr-phone-field">
                    <select
                      aria-label="Phone country"
                      value={`${phoneCountry.name}:${phoneCountry.code}`}
                      onChange={(event) => {
                        const country = COUNTRIES.find(
                          (candidate) =>
                            `${candidate.name}:${candidate.code}` ===
                            event.target.value,
                        );
                        if (!country) return;
                        setPhoneCountry(country);
                        updateContact(
                          "phone",
                          formatPhoneNumber(
                            stripPhoneToDigits(
                              contact.phone,
                              country.maxDigits,
                            ),
                            country,
                          ),
                        );
                      }}
                    >
                      {COUNTRIES.map((country) => (
                        <option
                          key={`${country.name}:${country.code}`}
                          value={`${country.name}:${country.code}`}
                        >
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <input
                      id="ai-seo-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={contact.phone}
                      onChange={(event) =>
                        updateContact(
                          "phone",
                          formatPhoneNumber(
                            stripPhoneToDigits(
                              event.target.value,
                              phoneCountry.maxDigits,
                            ),
                            phoneCountry,
                          ),
                        )
                      }
                    />
                  </div>
                  {errors.phone && (
                    <span className="pr-tf-error">{errors.phone}</span>
                  )}
                </div>
              </div>
              <div ref={turnstileContainerRef} />
              {submissionError && (
                <p className="pr-tf-error" role="alert">
                  {submissionError}
                </p>
              )}
              <div className="pr-tf-actions">
                <button
                  type="submit"
                  className="pr-btn"
                  disabled={
                    submitting ||
                    emailStatus === "verifying" ||
                    emailStatus === "invalid" ||
                    (!turnstileToken &&
                      !unavailableTurnstileStatuses.has(turnstileStatus))
                  }
                >
                  {submitting ? "Submitting…" : "See Available Times"}
                </button>
                <button
                  type="button"
                  className="pr-tf-back"
                  onClick={() => setStep("investment")}
                >
                  ← Back
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "calendar" && bookingIdentity && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">Book Free Audit Call</p>
            <p className="pr-tf-cal-lead">
              Choose a time — after you book, you&apos;ll land on the
              confirmation page with next steps.
            </p>
            <div className="pr-form-embed pr-form-embed--booking">
              <CalBookingStep
                calLink={calLink}
                namespace={calNamespace}
                prefill={contact}
                bookingIdentity={bookingIdentity}
                onBookingSuccessful={handleBookingSuccessful}
              />
            </div>
            <div className="pr-tf-actions">
              <button
                type="button"
                className="pr-tf-back"
                onClick={() => setStep("contact")}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === "not-qualified" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">Thanks for sharing</p>
            <p className="pr-tf-cal-lead" style={{ margin: 0 }}>
              Based on your answers, this audit is currently designed for
              established businesses that are ready to invest in growth. If that
              changes, you&apos;re welcome to come back and apply again.
            </p>
            <div className="pr-tf-actions">
              <button
                type="button"
                className="pr-tf-back"
                onClick={() => setStep("owner")}
              >
                ← Edit my answers
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
