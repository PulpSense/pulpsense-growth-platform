"use client";

import {
  lazy,
  Suspense,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { isBusinessEmail } from "@/utils/businessEmail";
import { getBrowserCookie } from "@/utils/browserCookie";
import {
  captureFunnelAttribution,
  type FunnelAttribution,
} from "@/utils/funnelAttribution";
import { trackFunnelEvent } from "@/utils/funnelAnalytics";
import { trackMetaEvent } from "@/utils/metaCapi";

/* ── Types ── */

export type FormStep = ContactStep | QualifyStep | CalStep;

type ContactStep = {
  type: "contact";
  fields: ContactField[];
};

type ContactField = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
} & ({ inputType: "text" | "email" | "tel" } | { inputType: "phone" });

type QualifyStep = {
  type: "qualify";
  fields: QualifyField[];
};

type QualifyField = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
} & (
  | { inputType: "text" | "url" }
  | { inputType: "select"; options: string[] }
  | { inputType: "multi-select"; options: string[] }
);

export type CalStep = {
  type: "cal";
  /** Cal.com link e.g. "santileoni/growth-mapping-funnel" */
  calLink: string;
  /** Cal.com namespace */
  namespace?: string;
  title?: string;
  subtitle?: string;
};

export type MultiStepFormConfig = {
  funnelId?: string;
  turnstileSiteKey?: string;
  steps: FormStep[];
  qualifiedRedirect: string;
  unqualifiedRedirect: string;
  onStepComplete?: (
    step: number,
    data: Record<string, string | string[]>,
  ) => void;
};

export type ContactSubmissionInput = {
  data: Readonly<Record<string, string | string[]>>;
  phoneCountryCode: string;
  attribution: FunnelAttribution;
  analyticsId: string;
  turnstileToken: string;
  sourceUrl: string;
  referrer?: string;
  fbp?: string;
  fbc?: string;
};

export type ContactSubmissionError =
  | "email_invalid"
  | "rate_limited"
  | "turnstile_unavailable"
  | "submission_failed";

export type ContactSubmissionResult =
  | { accepted: true; eventId: string }
  | {
      accepted: false;
      error: ContactSubmissionError;
      retryAvailable: boolean;
    };

export type ApplicationSubmissionInput = {
  data: Readonly<Record<string, string | string[]>>;
  analyticsId: string;
  sourceUrl: string;
  referrer?: string;
  fbp?: string;
  fbc?: string;
};

export type ApplicationSubmissionResult = {
  accepted: boolean;
  eventId?: string;
  qualificationStatus?: "qualified" | "unqualified";
  nextStep?: "booking" | "unqualified";
  bookingIdentity?: { submissionId: string; token: string };
  error?: string;
};

const DeferredCalBooking = lazy(() =>
  import("./CalBookingStep").then(({ CalBookingStep }) => ({
    default: CalBookingStep,
  })),
);

/* ── Phone: countries + formatting ── */

import { COUNTRIES } from "./phoneCountries";
import type { Country } from "./phoneCountries";

const DEFAULT_COUNTRY = COUNTRIES[0]!; // US

function stripToDigits(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

/** Format US/CA numbers as (XXX) XXX-XXXX, others just group in threes */
function formatPhone(digits: string, country: Country): string {
  if (!digits) return "";
  if (country.code === "+1" && country.maxDigits === 10) {
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

function isValidPhone(raw: string, country: Country): boolean {
  const digits = raw.replace(/\D/g, "");
  return (
    digits.length >= country.minDigits && digits.length <= country.maxDigits
  );
}

function stripUrlProtocol(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "");
}

function normalizeHttpsUrl(raw: string): string {
  const withoutProtocol = stripUrlProtocol(raw);
  return withoutProtocol ? `https://${withoutProtocol}` : "";
}

/* ── Generic dropdown ── */

type DropdownOption = {
  value: string;
  label: string;
  /** Optional leading element (e.g. flag emoji) */
  prefix?: string;
  /** Optional trailing element (e.g. dial code) */
  suffix?: string;
};

function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  hasError,
  searchable,
  toggleLabel,
  toggleClass,
  fullWidth,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  /** Enable search filtering (default: true when > 8 options) */
  searchable?: boolean;
  /** Custom content for the closed toggle (defaults to selected label) */
  toggleLabel?: React.ReactNode;
  /** Extra class on the toggle button */
  toggleClass?: string;
  /** Stretch toggle to full width (default: false) */
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  const filtered = search
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase()) ||
          (o.suffix ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  return (
    <div
      className={`msf-dropdown ${fullWidth ? "msf-dropdown-full" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className={`msf-dropdown-toggle ${hasError ? "msf-input-error" : ""} ${toggleClass ?? ""}`}
        onClick={() => setOpen(!open)}
      >
        {toggleLabel ?? (
          <span
            className={`msf-dropdown-label ${!selected ? "msf-dropdown-placeholder" : ""}`}
          >
            {selected ? (
              <>
                {selected.prefix && (
                  <span className="msf-dropdown-prefix">{selected.prefix}</span>
                )}
                {selected.label}
              </>
            ) : (
              (placeholder ?? "Select one")
            )}
          </span>
        )}
        <span className="msf-dropdown-caret">▾</span>
      </button>
      {open && (
        <div className="msf-dropdown-panel">
          {showSearch && (
            <input
              ref={searchRef}
              type="text"
              className="msf-dropdown-search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div className="msf-dropdown-list">
            {filtered.map((o) => (
              <button
                key={o.value + o.label}
                type="button"
                className={`msf-dropdown-option ${o.value === value ? "msf-dropdown-option-active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {o.prefix && (
                  <span className="msf-dropdown-prefix">{o.prefix}</span>
                )}
                <span className="msf-dropdown-option-label">{o.label}</span>
                {o.suffix && (
                  <span className="msf-dropdown-option-suffix">{o.suffix}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="msf-dropdown-empty">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Country picker (thin wrapper over Dropdown) ── */

const COUNTRY_OPTIONS: DropdownOption[] = COUNTRIES.map((c, i) => ({
  value: `${i}`,
  label: c.name,
  prefix: c.flag,
  suffix: c.code,
}));

function CountryPicker({
  value,
  onChange,
  hasError,
}: {
  value: Country;
  onChange: (c: Country) => void;
  hasError: boolean;
}) {
  const selectedIdx = COUNTRIES.findIndex(
    (c) => c.name === value.name && c.code === value.code,
  );

  return (
    <Dropdown
      options={COUNTRY_OPTIONS}
      value={String(selectedIdx >= 0 ? selectedIdx : 0)}
      onChange={(v) => onChange(COUNTRIES[Number(v)]!)}
      hasError={hasError}
      searchable
      toggleClass="msf-country-toggle"
      toggleLabel={
        <>
          <span className="msf-country-flag">{value.flag}</span>
          <span className="msf-country-dial">{value.code}</span>
        </>
      }
    />
  );
}

/* ── Component ── */

/* ── Email verification status icon ── */
function EmailStatus({
  status,
}: {
  status: "idle" | "verifying" | "valid" | "invalid";
}) {
  if (status === "idle") return null;
  if (status === "verifying") {
    return (
      <span
        className="msf-email-status msf-email-spinner"
        aria-label="Verifying email"
      />
    );
  }
  if (status === "valid") {
    return (
      <span
        className="msf-email-status msf-email-valid"
        aria-label="Email verified"
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className="msf-email-status msf-email-invalid"
      aria-label="Invalid email"
    >
      ✗
    </span>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          appearance: "interaction-only";
          callback: (token: string) => void;
          "error-callback": () => void;
          "expired-callback": () => void;
        },
      ): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

export function MultiStepForm({
  config,
  className,
  onContactSubmit,
  onApplicationSubmit,
  onContactInputChanged,
}: {
  config: MultiStepFormConfig;
  className?: string;
  onContactSubmit?: (
    input: ContactSubmissionInput,
  ) => Promise<ContactSubmissionResult>;
  onApplicationSubmit?: (
    input: ApplicationSubmissionInput,
  ) => Promise<ApplicationSubmissionResult>;
  onContactInputChanged?: () => boolean;
}) {
  const measurement = useRef<{
    attribution: FunnelAttribution;
    analyticsId: string;
  }>({ attribution: { firstTouch: {}, lastTouch: {} }, analyticsId: "" });
  useEffect(() => {
    measurement.current = captureFunnelAttribution({
      funnelId: config.funnelId ?? "default",
      href: window.location.href,
      referrer: document.referrer,
      storage: window.localStorage,
      createAnalyticsId: () => crypto.randomUUID(),
    });
  }, [config.funnelId]);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string | string[]>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [bookingIdentity, setBookingIdentity] = useState<{
    submissionId: string;
    token: string;
  }>();
  const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "verifying" | "valid" | "invalid"
  >("idle");
  const [submissionError, setSubmissionError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const emailAbortRef = useRef<AbortController | null>(null);
  const lastVerifiedEmail = useRef<string>("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | undefined>(undefined);

  const step = config.steps[currentStep]!;
  const totalSteps = config.steps.length;
  const measurementStep =
    step.type === "qualify"
      ? "qualification"
      : step.type === "cal"
        ? "booking"
        : "contact";

  useEffect(() => {
    trackFunnelEvent("funnel_step_viewed", { step: measurementStep });
  }, [measurementStep]);

  useEffect(() => {
    const siteKey = config.turnstileSiteKey;
    if (!siteKey) return;

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
          sitekey: siteKey,
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
          "expired-callback": () => {
            setTurnstileToken("");
            if (turnstileWidgetRef.current) {
              window.turnstile?.reset(turnstileWidgetRef.current);
            }
          },
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
  }, [config.turnstileSiteKey]);

  const updateField = useCallback(
    (name: string, value: string | string[]) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (
        step.type === "contact" &&
        onContactInputChanged?.() &&
        turnstileWidgetRef.current
      ) {
        window.turnstile?.reset(turnstileWidgetRef.current);
        setTurnstileToken("");
      }
      setSubmissionError("");
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [onContactInputChanged, step.type],
  );

  const handlePhoneChange = useCallback(
    (name: string, raw: string) => {
      const digits = stripToDigits(raw, phoneCountry.maxDigits);
      const formatted = formatPhone(digits, phoneCountry);
      updateField(name, formatted);
    },
    [updateField, phoneCountry],
  );

  const handleCountryChange = useCallback(
    (name: string, country: Country) => {
      setPhoneCountry(country);
      const currentVal = (formData[name] as string) ?? "";
      const digits = stripToDigits(currentVal, country.maxDigits);
      updateField(name, formatPhone(digits, country));
    },
    [formData, updateField],
  );

  const verifyEmail = useCallback(async (email: string) => {
    // Skip if the email hasn't changed since last verification
    if (email === lastVerifiedEmail.current) return;

    // Only verify if it passes the client-side business email check first
    if (!email || !isBusinessEmail(email)) {
      lastVerifiedEmail.current = "";

      setEmailStatus("idle");
      return;
    }

    // Cancel any in-flight request
    emailAbortRef.current?.abort();
    const controller = new AbortController();
    emailAbortRef.current = controller;

    setEmailStatus("verifying");
    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      lastVerifiedEmail.current = email;

      if (data.valid) {
        setEmailStatus("valid");
        setErrors((prev) => {
          const next = { ...prev };
          delete next.email;
          return next;
        });
      } else {
        setEmailStatus("invalid");
        setErrors((prev) => ({
          ...prev,
          email:
            "Hmm.. seems there's something wrong with this email. Can you double check?",
        }));
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // On network error, don't block the user
      setEmailStatus("idle");
    }
  }, []);

  const toggleMultiSelect = useCallback((name: string, option: string) => {
    setFormData((prev) => {
      const current = (prev[name] as string[] | undefined) ?? [];
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option];
      return { ...prev, [name]: next };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (step.type === "contact") {
      for (const field of step.fields) {
        const val = (formData[field.name] as string) ?? "";
        if (field.required && !val.trim()) {
          errs[field.name] = "Required";
        } else if (
          field.inputType === "email" &&
          val &&
          !isBusinessEmail(val)
        ) {
          errs[field.name] = "Please use your business email";
        } else if (
          field.inputType === "phone" &&
          val &&
          !isValidPhone(val, phoneCountry)
        ) {
          errs[field.name] =
            phoneCountry.minDigits === phoneCountry.maxDigits
              ? `Enter a valid ${phoneCountry.minDigits}-digit phone number`
              : `Enter a valid phone number (${phoneCountry.minDigits}–${phoneCountry.maxDigits} digits)`;
        }
      }
    }
    if (step.type === "qualify") {
      for (const field of step.fields) {
        const val = formData[field.name];
        if (field.required) {
          if (field.inputType === "multi-select") {
            if (!val || (val as string[]).length === 0)
              errs[field.name] = "Select at least one";
          } else {
            if (!val || !(val as string).trim()) errs[field.name] = "Required";
          }
        }
      }
    }
    const invalidFields = Object.keys(errs);
    setErrors(errs);
    if (invalidFields.length > 0) {
      trackFunnelEvent("funnel_validation_failed", {
        step: measurementStep,
        fields: invalidFields,
      });
    }
    return invalidFields.length === 0;
  }, [step, formData, phoneCountry, measurementStep]);

  const submitContact = useCallback(async () => {
    if (!onContactSubmit) {
      setSubmissionError(
        "Contact submission is not configured for this environment.",
      );
      return undefined;
    }

    try {
      const fbp = getBrowserCookie("_fbp");
      const fbc = getBrowserCookie("_fbc");
      const result = await onContactSubmit({
        data: formData,
        phoneCountryCode: phoneCountry.code,
        attribution: measurement.current.attribution,
        analyticsId: measurement.current.analyticsId,
        turnstileToken,
        sourceUrl: window.location.href,
        ...(document.referrer ? { referrer: document.referrer } : {}),
        ...(fbp ? { fbp } : {}),
        ...(fbc ? { fbc } : {}),
      });

      if (!result.accepted) {
        if (result.error === "email_invalid") {
          setEmailStatus("invalid");
          setErrors((previous) => ({
            ...previous,
            email:
              "Hmm.. seems there's something wrong with this email. Can you double check?",
          }));
        }
        setSubmissionError(
          result.error === "rate_limited"
            ? "Too many attempts. Please wait a minute and try again."
            : result.error === "email_invalid"
              ? "Please correct your business email and try again."
              : result.error === "turnstile_unavailable"
                ? config.turnstileSiteKey
                  ? "The security check is still loading. Please try again."
                  : "Contact submission is not configured for this environment."
                : "We could not save your details yet. Your answers are still here—please try again.",
        );

        if (!result.retryAvailable && turnstileWidgetRef.current) {
          window.turnstile?.reset(turnstileWidgetRef.current);
          setTurnstileToken("");
        }
        return undefined;
      }

      setSubmissionError("");
      return { eventId: result.eventId };
    } catch {
      setSubmissionError(
        "We could not save your details yet. Your answers are still here—please try again.",
      );
      if (turnstileWidgetRef.current) {
        window.turnstile?.reset(turnstileWidgetRef.current);
        setTurnstileToken("");
      }
      return undefined;
    }
  }, [
    config.turnstileSiteKey,
    formData,
    onContactSubmit,
    phoneCountry.code,
    turnstileToken,
  ]);

  const submitApplication = useCallback(async () => {
    if (!onApplicationSubmit) {
      setSubmissionError(
        "Application submission is not configured for this environment.",
      );
      return undefined;
    }

    try {
      const fbp = getBrowserCookie("_fbp");
      const fbc = getBrowserCookie("_fbc");
      const result = await onApplicationSubmit({
        data: formData,
        analyticsId: measurement.current.analyticsId,
        sourceUrl: window.location.href,
        ...(document.referrer ? { referrer: document.referrer } : {}),
        ...(fbp ? { fbp } : {}),
        ...(fbc ? { fbc } : {}),
      });

      if (
        !result.accepted ||
        !result.eventId ||
        !result.qualificationStatus ||
        !result.nextStep
      ) {
        setSubmissionError(
          result.error === "rate_limited"
            ? "Too many attempts. Please wait a minute and try again."
            : "We could not save your application yet. Your answers are still here—please try again.",
        );
        return undefined;
      }

      setSubmissionError("");
      return result;
    } catch {
      setSubmissionError(
        "We could not save your application yet. Your answers are still here—please try again.",
      );
      return undefined;
    }
  }, [formData, onApplicationSubmit]);

  const getMetaUserData = useCallback(() => {
    const email = formData.email;
    const phone = formData.phone;

    return {
      email: typeof email === "string" ? email : undefined,
      phone:
        typeof phone === "string" && phone
          ? `${phoneCountry.code} ${phone}`
          : undefined,
    };
  }, [formData.email, formData.phone, phoneCountry]);

  const handleNext = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);

    // After step 1 (contact), fire partial webhook + Lead event
    if (currentStep === 0) {
      const contact = await submitContact();
      if (!contact) {
        setSubmitting(false);
        return;
      }
      if (!leadEventSentRef.current) {
        leadEventSentRef.current = true;
        trackFunnelEvent("funnel_step_completed", { step: "contact" });
        trackMetaEvent(
          "Lead",
          {
            content_name: "Creative Multiplier Sprint Contact Step",
            funnel_id: config.funnelId ?? "default",
          },
          getMetaUserData(),
          { eventId: contact.eventId, serverHandled: true },
        );
      }
    }

    // After step 2, trust only the server's qualification and navigation result.
    if (step.type === "qualify") {
      const application = await submitApplication();
      if (!application) {
        setSubmitting(false);
        return;
      }
      const qualificationStatus = application.qualificationStatus;
      if (!qualificationStatus) {
        setSubmitting(false);
        return;
      }
      if (!submitApplicationEventSentRef.current) {
        submitApplicationEventSentRef.current = true;
        trackFunnelEvent("funnel_step_completed", {
          step: "qualification",
        });
        trackFunnelEvent("qualification_outcome", {
          status: qualificationStatus,
        });
        trackMetaEvent(
          "SubmitApplication",
          {
            qualification_status: application.qualificationStatus,
          },
          getMetaUserData(),
          { eventId: application.eventId, serverHandled: true },
        );
      }

      if (application.nextStep === "unqualified") {
        config.onStepComplete?.(currentStep, formData);
        window.location.assign(config.unqualifiedRedirect);
        setSubmitting(false);
        return;
      }
      if (!application.bookingIdentity) {
        setSubmissionError(
          "Booking is not available for this application. Please try again.",
        );
        setSubmitting(false);
        return;
      }
      setBookingIdentity(application.bookingIdentity);
    }

    config.onStepComplete?.(currentStep, formData);

    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
    setSubmitting(false);
  }, [
    validate,
    currentStep,
    step,
    totalSteps,
    submitContact,
    submitApplication,
    config,
    formData,
    getMetaUserData,
  ]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  }, [currentStep]);

  const handleBookingSuccessful = useCallback(() => {
    trackFunnelEvent("booking_interaction", { action: "booking_successful" });
    window.location.assign(config.qualifiedRedirect);
  }, [config.qualifiedRedirect]);

  const leadEventSentRef = useRef(false);
  const submitApplicationEventSentRef = useRef(false);

  return (
    <div className={className}>
      {/* Progress bar */}
      <div className="msf-progress">
        <div
          className="msf-progress-bar"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div className="msf-body">
        {step.type === "contact" && (
          <div className="msf-fields-grid">
            {step.fields.map((field) => (
              <div key={field.name} className="msf-field">
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="msf-required">*</span>}
                </label>
                {field.inputType === "phone" ? (
                  <div className="msf-phone-row">
                    <CountryPicker
                      value={phoneCountry}
                      onChange={(c) => handleCountryChange(field.name, c)}
                      hasError={!!errors[field.name]}
                    />
                    <input
                      id={field.name}
                      type="tel"
                      placeholder={
                        phoneCountry.code === "+1"
                          ? "(555) 123-4567"
                          : "123 456 789"
                      }
                      value={(formData[field.name] as string) ?? ""}
                      onChange={(e) =>
                        handlePhoneChange(field.name, e.target.value)
                      }
                      className={errors[field.name] ? "msf-input-error" : ""}
                      autoComplete="tel"
                    />
                  </div>
                ) : (
                  <div
                    className={
                      field.inputType === "email"
                        ? "msf-email-wrapper"
                        : undefined
                    }
                  >
                    <input
                      id={field.name}
                      type={field.inputType}
                      placeholder={field.placeholder}
                      value={(formData[field.name] as string) ?? ""}
                      onChange={(e) => {
                        updateField(field.name, e.target.value);
                        if (field.inputType === "email") setEmailStatus("idle");
                      }}
                      onBlur={
                        field.inputType === "email"
                          ? () =>
                              verifyEmail(
                                (formData[field.name] as string) ?? "",
                              )
                          : undefined
                      }
                      className={errors[field.name] ? "msf-input-error" : ""}
                      autoComplete={
                        field.inputType === "email"
                          ? "email"
                          : field.name.includes("first")
                            ? "given-name"
                            : field.name.includes("last")
                              ? "family-name"
                              : "off"
                      }
                    />
                    {field.inputType === "email" && (
                      <EmailStatus status={emailStatus} />
                    )}
                  </div>
                )}
                {errors[field.name] && (
                  <span className="msf-error">{errors[field.name]}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {step.type === "qualify" && (
          <div className="msf-fields-stack">
            {step.fields.map((field) => (
              <div key={field.name} className="msf-field">
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="msf-required">*</span>}
                </label>

                {field.inputType === "select" && (
                  <Dropdown
                    options={field.options.map((opt) => ({
                      value: opt,
                      label: opt,
                    }))}
                    value={(formData[field.name] as string) ?? ""}
                    onChange={(v) => updateField(field.name, v)}
                    placeholder="Select one"
                    hasError={!!errors[field.name]}
                    fullWidth
                  />
                )}

                {(field.inputType === "text" || field.inputType === "url") &&
                  (field.inputType === "url" ? (
                    <div
                      className={`msf-url-input ${errors[field.name] ? "msf-input-error" : ""}`}
                    >
                      <span className="msf-url-prefix">https://</span>
                      <input
                        id={field.name}
                        type="text"
                        inputMode="url"
                        placeholder={
                          field.placeholder
                            ? stripUrlProtocol(field.placeholder)
                            : undefined
                        }
                        value={stripUrlProtocol(
                          (formData[field.name] as string) ?? "",
                        )}
                        onChange={(e) =>
                          updateField(
                            field.name,
                            normalizeHttpsUrl(e.target.value),
                          )
                        }
                        className={errors[field.name] ? "msf-input-error" : ""}
                        autoComplete="url"
                      />
                    </div>
                  ) : (
                    <input
                      id={field.name}
                      type={field.inputType}
                      placeholder={field.placeholder}
                      value={(formData[field.name] as string) ?? ""}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      className={errors[field.name] ? "msf-input-error" : ""}
                      autoComplete="off"
                    />
                  ))}

                {field.inputType === "multi-select" && (
                  <div className="msf-chips">
                    {field.options.map((opt) => {
                      const selected = (
                        (formData[field.name] as string[] | undefined) ?? []
                      ).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`msf-chip ${selected ? "msf-chip-selected" : ""}`}
                          onClick={() => toggleMultiSelect(field.name, opt)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {errors[field.name] && (
                  <span className="msf-error">{errors[field.name]}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {step.type === "cal" && bookingIdentity && (
          <div>
            <div className="msf-cal-header">
              <h3 className="msf-cal-title">
                {step.title ?? "You're in! Pick a time to chat with us."}
              </h3>
              <p className="msf-cal-subtitle">
                {step.subtitle ??
                  "In 25 minutes we'll map your biggest time drains and show you exactly which 3 AI agents would make the biggest impact on your business."}
              </p>
            </div>
            <div className="msf-cal-embed">
              <Suspense fallback={<p>Loading available times…</p>}>
                <DeferredCalBooking
                  step={step}
                  formData={formData}
                  bookingIdentity={bookingIdentity}
                  onBookingSuccessful={handleBookingSuccessful}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      <div ref={turnstileContainerRef} className="msf-turnstile" />
      {submissionError && (
        <p className="msf-error" role="alert">
          {submissionError}
        </p>
      )}

      {/* Navigation */}
      {step.type === "cal" && currentStep > 0 && (
        <div className="msf-nav">
          <button
            type="button"
            className="msf-btn msf-btn-back"
            onClick={handleBack}
          >
            ← Back
          </button>
        </div>
      )}
      {step.type !== "cal" && (
        <div className="msf-nav">
          {currentStep > 0 && (
            <button
              type="button"
              className="msf-btn msf-btn-back"
              onClick={handleBack}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            className="msf-btn msf-btn-primary"
            onClick={handleNext}
            disabled={
              submitting ||
              emailStatus === "verifying" ||
              emailStatus === "invalid"
            }
          >
            {submitting ? "Submitting…" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
