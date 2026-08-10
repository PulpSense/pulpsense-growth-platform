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
import { useFunnelSubmission } from "@/lib/funnel/use-funnel-submission";
import { isBusinessEmail } from "@/utils/businessEmail";
import { getBrowserCookie } from "@/utils/browserCookie";
import {
  captureFunnelAttribution,
  type FunnelAttribution,
} from "@/utils/funnelAttribution";
import { trackFunnelEvent } from "@/utils/funnelAnalytics";
import { trackMetaEvent } from "@/utils/metaCapi";

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
          "error-callback"?(): void;
          "expired-callback"?(): void;
        },
      ): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

type Step = "owner" | "contact" | "calendar" | "not-owner";
type EmailStatus = "idle" | "verifying" | "valid" | "invalid";

type ContactData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  website: string;
};

type Props = {
  calLink: string;
  calNamespace?: string;
  turnstileSiteKey?: string;
  qualifiedRedirect?: string;
};

const initialContact: ContactData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  website: "",
};

export function AiSeoQualificationForm({
  calLink,
  calNamespace,
  turnstileSiteKey,
  qualifiedRedirect = "/ai-seo/thank-you/",
}: Props) {
  const [step, setStep] = useState<Step>("owner");
  const [contact, setContact] = useState<ContactData>(initialContact);
  const [phoneCountry, setPhoneCountry] = useState<Country>(
    DEFAULT_PHONE_COUNTRY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [bookingIdentity, setBookingIdentity] = useState<{
    submissionId: string;
    token: string;
  }>();
  const measurement = useRef<{
    attribution: FunnelAttribution;
    analyticsId: string;
  }>({ attribution: { firstTouch: {}, lastTouch: {} }, analyticsId: "" });
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | undefined>(undefined);
  const emailAbortRef = useRef<AbortController | undefined>(undefined);
  const lastVerifiedEmail = useRef("");
  const { submitContact, submitApplication, resetContactIdentity } =
    useFunnelSubmission("ai-seo");

  useEffect(() => {
    measurement.current = captureFunnelAttribution({
      funnelId: "ai-seo",
      href: window.location.href,
      referrer: document.referrer,
      storage: window.localStorage,
      createAnalyticsId: () => crypto.randomUUID(),
    });
    trackFunnelEvent("funnel_step_viewed", { step: "qualification" });
  }, []);

  useEffect(() => {
    const funnelRoot = document.getElementById("pr-funnel");
    funnelRoot?.classList.toggle("pr-calendar-active", step === "calendar");
    return () => funnelRoot?.classList.remove("pr-calendar-active");
  }, [step]);

  useEffect(() => {
    if (!turnstileSiteKey) return;

    const renderWidget = () => {
      if (
        !window.turnstile ||
        !turnstileContainerRef.current ||
        turnstileWidgetRef.current
      ) {
        return;
      }
      turnstileWidgetRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: turnstileSiteKey,
          action: "contact_submit",
          appearance: "interaction-only",
          callback: (token) => {
            setTurnstileToken(token);
            setSubmissionError("");
          },
          "error-callback": () => {
            setTurnstileToken("");
            setSubmissionError(
              "The security check could not load. Please try again.",
            );
          },
          "expired-callback": () => setTurnstileToken(""),
        },
      );
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-pulpsense-turnstile]",
    );
    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.pulpsenseTurnstile = "true";
      script.addEventListener("load", renderWidget, { once: true });
      document.head.append(script);
    }

    return () => {
      existingScript?.removeEventListener("load", renderWidget);
      if (turnstileWidgetRef.current) {
        window.turnstile?.remove(turnstileWidgetRef.current);
        turnstileWidgetRef.current = undefined;
      }
    };
  }, [turnstileSiteKey]);

  const updateContact = useCallback(
    (field: keyof ContactData, value: string) => {
      setContact((current) => ({ ...current, [field]: value }));
      const resetIdentity = resetContactIdentity();
      if (resetIdentity && turnstileWidgetRef.current) {
        window.turnstile?.reset(turnstileWidgetRef.current);
        setTurnstileToken("");
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
      const result = (await response.json()) as { valid?: boolean };
      if (controller.signal.aborted) return;
      lastVerifiedEmail.current = email;
      if (result.valid) {
        setEmailStatus("valid");
        setErrors((current) => {
          const next = { ...current };
          delete next.email;
          return next;
        });
      } else {
        setEmailStatus("invalid");
        setErrors((current) => ({
          ...current,
          email: "Please enter a valid business email.",
        }));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setEmailStatus("idle");
    }
  }, [contact.email]);

  const chooseOwner = (owner: "yes" | "no") => {
    trackFunnelEvent("qualification_outcome", {
      status: owner === "yes" ? "qualified" : "unqualified",
    });
    if (owner === "yes") {
      setStep("contact");
      trackFunnelEvent("funnel_step_viewed", { step: "contact" });
    } else {
      setStep("not-owner");
    }
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
    setSubmitting(true);
    setSubmissionError("");

    const sourceUrl = window.location.href;
    const referrer = document.referrer || undefined;
    const fbp = getBrowserCookie("_fbp");
    const fbc = getBrowserCookie("_fbc");
    const sharedContext = {
      analyticsId: measurement.current.analyticsId,
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
              : "We could not save your details yet. Please try again.",
        );
        if (!contactResult.retryAvailable && turnstileWidgetRef.current) {
          window.turnstile?.reset(turnstileWidgetRef.current);
          setTurnstileToken("");
        }
        return;
      }

      trackFunnelEvent("funnel_step_completed", { step: "contact" });
      trackMetaEvent(
        "Lead",
        { content_name: "AI SEO Contact Step", funnel_id: "ai-seo" },
        {
          email: contact.email,
          phone: `${phoneCountry.code} ${contact.phone}`,
        },
        { eventId: contactResult.eventId, serverHandled: true },
      );

      const applicationResult = await submitApplication({
        data: { businessOwner: "yes" },
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
    step === "owner" || step === "not-owner" ? 1 : step === "contact" ? 2 : 3;

  return (
    <div className="pr-tf">
      <div className="pr-tf-progress" aria-live="polite">
        <span>Step {currentStep} of 3</span>
        <div className="pr-tf-progress-bar">
          <div
            className="pr-tf-progress-fill"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </div>
      <div className="pr-tf-card">
        {step === "owner" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">Are you the owner of the business?</p>
            <div className="pr-tf-choices">
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseOwner("yes")}
              >
                Yes, I own the business
              </button>
              <button
                type="button"
                className="pr-tf-choice"
                onClick={() => chooseOwner("no")}
              >
                No, I work for the business
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
                    <span className="pr-tf-legend">Verifying email…</span>
                  )}
                  {emailStatus === "valid" && (
                    <span className="pr-tf-legend">Email verified</span>
                  )}
                  {errors.email && (
                    <span className="pr-tf-error">{errors.email}</span>
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
                    emailStatus === "invalid"
                  }
                >
                  {submitting ? "Submitting…" : "See Available Times"}
                </button>
                <button
                  type="button"
                  className="pr-tf-back"
                  onClick={() => setStep("owner")}
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
            <a className="pr-skip-call" href="/start" data-skip-call="calendar">
              Don&apos;t want a call? Skip it — start your 7-day trial instead →
            </a>
            <div className="pr-form-embed pr-form-embed--booking">
              <CalBookingStep
                calLink={calLink}
                namespace={calNamespace}
                prefill={contact}
                bookingIdentity={bookingIdentity}
                onBookingSuccessful={() => {
                  trackFunnelEvent("booking_interaction", {
                    action: "booking_successful",
                  });
                  window.location.assign(qualifiedRedirect);
                }}
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

        {step === "not-owner" && (
          <div className="pr-tf-step is-active">
            <p className="pr-tf-q">Thanks for sharing</p>
            <p className="pr-tf-cal-lead" style={{ margin: 0 }}>
              The audit call only works when the business owner is on it —
              they&apos;re the one who can act on what we find. Send this page
              to the owner and have them book the call; we&apos;ll take great
              care of them.
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
