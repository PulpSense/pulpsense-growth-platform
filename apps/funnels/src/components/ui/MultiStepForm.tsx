'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cal, { getCalApi } from '@calcom/embed-react';
import { isBusinessEmail } from '@/utils/businessEmail';
import { trackMetaEvent } from '@/utils/metaCapi';

/* ── Types ── */

export type FormStep = ContactStep | QualifyStep | CalStep;

type ContactStep = {
  type: 'contact';
  fields: ContactField[];
};

type ContactField = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
} & (
  | { inputType: 'text' | 'email' | 'tel' }
  | { inputType: 'phone' }
);

type QualifyStep = {
  type: 'qualify';
  fields: QualifyField[];
};

type QualifyField = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
} & (
  | { inputType: 'text' | 'url' }
  | { inputType: 'select'; options: string[] }
  | { inputType: 'multi-select'; options: string[] }
);

type CalStep = {
  type: 'cal';
  /** Cal.com link e.g. "santileoni/growth-mapping-funnel" */
  calLink: string;
  /** Cal.com namespace */
  namespace?: string;
  title?: string;
  subtitle?: string;
};

type QualificationRule = {
  field: string;
  disqualifyValues: string[];
};

export type MultiStepFormConfig = {
  funnelId?: string;
  steps: FormStep[];
  qualificationRules?: QualificationRule[];
  qualifiedRedirect: string;
  unqualifiedRedirect: string;
  onStepComplete?: (step: number, data: Record<string, string | string[]>) => void;
};

/* ── Phone: countries + formatting ── */

import { COUNTRIES } from './phoneCountries';
import type { Country } from './phoneCountries';

const DEFAULT_COUNTRY = COUNTRIES[0]!; // US

function stripToDigits(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/** Format US/CA numbers as (XXX) XXX-XXXX, others just group in threes */
function formatPhone(digits: string, country: Country): string {
  if (!digits) return '';
  if (country.code === '+1' && country.maxDigits === 10) {
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

function isValidPhone(raw: string, country: Country): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= country.minDigits && digits.length <= country.maxDigits;
}

function stripUrlProtocol(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '');
}

function normalizeHttpsUrl(raw: string): string {
  const withoutProtocol = stripUrlProtocol(raw);
  return withoutProtocol ? `https://${withoutProtocol}` : '';
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

function Dropdown({ options, value, onChange, placeholder, hasError, searchable, toggleLabel, toggleClass, fullWidth }: {
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
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase()) ||
        (o.suffix ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : options;

  return (
    <div className={`msf-dropdown ${fullWidth ? 'msf-dropdown-full' : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`msf-dropdown-toggle ${hasError ? 'msf-input-error' : ''} ${toggleClass ?? ''}`}
        onClick={() => setOpen(!open)}
      >
        {toggleLabel ?? (
          <span className={`msf-dropdown-label ${!selected ? 'msf-dropdown-placeholder' : ''}`}>
            {selected ? (
              <>
                {selected.prefix && <span className="msf-dropdown-prefix">{selected.prefix}</span>}
                {selected.label}
              </>
            ) : (placeholder ?? 'Select one')}
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
                className={`msf-dropdown-option ${o.value === value ? 'msf-dropdown-option-active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setSearch('');
                }}
              >
                {o.prefix && <span className="msf-dropdown-prefix">{o.prefix}</span>}
                <span className="msf-dropdown-option-label">{o.label}</span>
                {o.suffix && <span className="msf-dropdown-option-suffix">{o.suffix}</span>}
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

function CountryPicker({ value, onChange, hasError }: {
  value: Country;
  onChange: (c: Country) => void;
  hasError: boolean;
}) {
  const selectedIdx = COUNTRIES.findIndex((c) => c.name === value.name && c.code === value.code);

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
function EmailStatus({ status }: { status: 'idle' | 'verifying' | 'valid' | 'invalid' }) {
  if (status === 'idle') return null;
  if (status === 'verifying') {
    return <span className="msf-email-status msf-email-spinner" aria-label="Verifying email" />;
  }
  if (status === 'valid') {
    return <span className="msf-email-status msf-email-valid" aria-label="Email verified">✓</span>;
  }
  return <span className="msf-email-status msf-email-invalid" aria-label="Invalid email">✗</span>;
}

export function MultiStepForm({ config, className }: { config: MultiStepFormConfig; className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capture UTM params once on mount so they survive step transitions
  const utmParams = useRef<Record<string, string>>({});
  useEffect(() => {
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const params: Record<string, string> = {};
    for (const key of keys) {
      const val = searchParams.get(key);
      if (val) params[key] = val;
    }
    if (Object.keys(params).length > 0) utmParams.current = params;
  }, [searchParams]);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isQualified, setIsQualified] = useState(true);
  const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const emailAbortRef = useRef<AbortController | null>(null);
  const lastVerifiedEmail = useRef<string>('');

  const step = config.steps[currentStep]!;
  const totalSteps = config.steps.length;

  const updateField = useCallback((name: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handlePhoneChange = useCallback((name: string, raw: string) => {
    const digits = stripToDigits(raw, phoneCountry.maxDigits);
    const formatted = formatPhone(digits, phoneCountry);
    updateField(name, formatted);
  }, [updateField, phoneCountry]);

  const handleCountryChange = useCallback((name: string, country: Country) => {
    setPhoneCountry(country);
    const currentVal = (formData[name] as string) ?? '';
    const digits = stripToDigits(currentVal, country.maxDigits);
    updateField(name, formatPhone(digits, country));
  }, [formData, updateField]);

  const verifyEmail = useCallback(async (email: string) => {
    // Skip if the email hasn't changed since last verification
    if (email === lastVerifiedEmail.current) return;

    // Only verify if it passes the client-side business email check first
    if (!email || !isBusinessEmail(email)) {
      lastVerifiedEmail.current = '';

      setEmailStatus('idle');
      return;
    }

    // Cancel any in-flight request
    emailAbortRef.current?.abort();
    const controller = new AbortController();
    emailAbortRef.current = controller;

    setEmailStatus('verifying');
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      lastVerifiedEmail.current = email;

      if (data.valid) {
        setEmailStatus('valid');
        setErrors((prev) => {
          const next = { ...prev };
          delete next.email;
          return next;
        });
      } else {
        setEmailStatus('invalid');
        setErrors((prev) => ({ ...prev, email: "Hmm.. seems there's something wrong with this email. Can you double check?" }));
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // On network error, don't block the user
      setEmailStatus('idle');
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
    if (step.type === 'contact') {
      for (const field of step.fields) {
        const val = (formData[field.name] as string) ?? '';
        if (field.required && !val.trim()) {
          errs[field.name] = 'Required';
        } else if (field.inputType === 'email' && val && !isBusinessEmail(val)) {
          errs[field.name] = 'Please use your business email';
        } else if (field.inputType === 'phone' && val && !isValidPhone(val, phoneCountry)) {
          errs[field.name] = phoneCountry.minDigits === phoneCountry.maxDigits
            ? `Enter a valid ${phoneCountry.minDigits}-digit phone number`
            : `Enter a valid phone number (${phoneCountry.minDigits}–${phoneCountry.maxDigits} digits)`;
        }
      }
    }
    if (step.type === 'qualify') {
      for (const field of step.fields) {
        const val = formData[field.name];
        if (field.required) {
          if (field.inputType === 'multi-select') {
            if (!val || (val as string[]).length === 0) errs[field.name] = 'Select at least one';
          } else {
            if (!val || !(val as string).trim()) errs[field.name] = 'Required';
          }
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, formData, phoneCountry]);

  const checkQualification = useCallback((): boolean => {
    if (!config.qualificationRules) return true;
    for (const rule of config.qualificationRules) {
      const val = formData[rule.field];
      if (typeof val === 'string' && rule.disqualifyValues.includes(val)) return false;
      if (Array.isArray(val) && val.some((v) => rule.disqualifyValues.includes(v))) return false;
    }
    return true;
  }, [config.qualificationRules, formData]);

  const sendWebhook = useCallback(async (
    event: string,
    extraData?: Record<string, string | string[] | boolean>,
  ) => {
    // Enrich phone with country code for the webhook payload
    const phoneVal = formData.phone as string | undefined;
    const enriched = {
      funnelId: config.funnelId ?? 'default',
      ...formData,
      ...(phoneVal ? { phone: `${phoneCountry.code} ${phoneVal}` } : {}),
      ...extraData,
      ...utmParams.current,
    };
    try {
      await fetch('/api/form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          data: enriched,
          submittedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Silently fail — don't block the user
    }
  }, [config.funnelId, formData, phoneCountry]);

  const getMetaUserData = useCallback(() => {
    const email = formData.email;
    const phone = formData.phone;

    return {
      email: typeof email === 'string' ? email : undefined,
      phone: typeof phone === 'string' && phone
        ? `${phoneCountry.code} ${phone}`
        : undefined,
    };
  }, [formData.email, formData.phone, phoneCountry]);

  const handleNext = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);

    // After step 1 (contact), fire partial webhook + Lead event
    if (currentStep === 0) {
      await sendWebhook('contact_submitted');
      if (!leadEventSentRef.current) {
        leadEventSentRef.current = true;
        trackMetaEvent(
          'Lead',
          {
            content_name: 'Creative Multiplier Sprint Contact Step',
            funnel_id: config.funnelId ?? 'default',
          },
          getMetaUserData(),
        );
      }
    }

    // After step 2 (qualify), check qualification + SubmitApplication event
    if (step.type === 'qualify') {
      const qualified = checkQualification();
      setIsQualified(qualified);
      await sendWebhook('application_submitted', {
        qualified,
        qualificationStatus: qualified ? 'qualified' : 'unqualified',
      });
      if (!submitApplicationEventSentRef.current) {
        submitApplicationEventSentRef.current = true;
        trackMetaEvent(
          'SubmitApplication',
          {
            content_name: 'Creative Multiplier Sprint Application',
            funnel_id: config.funnelId ?? 'default',
            qualification_status: qualified ? 'qualified' : 'unqualified',
            paid_social_spend: formData.paidSocialSpend,
            winner_status: formData.winnerStatus,
          },
          getMetaUserData(),
        );
      }

      if (!qualified) {
        config.onStepComplete?.(currentStep, formData);
        router.push(config.unqualifiedRedirect);
        setSubmitting(false);
        return;
      }
    }

    config.onStepComplete?.(currentStep, formData);

    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
    setSubmitting(false);
  }, [validate, currentStep, step, totalSteps, sendWebhook, checkQualification, config, formData, router, getMetaUserData]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  }, [currentStep]);

  // Refs so the postMessage listener always sees current values
  const formDataRef = useRef(formData);
  const isQualifiedRef = useRef(isQualified);
  const phoneCountryRef = useRef(phoneCountry);
  const leadEventSentRef = useRef(false);
  const submitApplicationEventSentRef = useRef(false);
  const scheduleEventSentRef = useRef(false);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { isQualifiedRef.current = isQualified; }, [isQualified]);
  useEffect(() => { phoneCountryRef.current = phoneCountry; }, [phoneCountry]);

  // Initialize Cal.com API and listen for booking confirmation
  const calNamespace = step.type === 'cal' ? (step.namespace ?? 'default') : '';
  useEffect(() => {
    if (step.type !== 'cal') return;

    (async () => {
      const cal = await getCalApi({ namespace: calNamespace });
      cal('ui', {
        theme: 'dark',
        cssVarsPerTheme: {
          dark: { 'cal-brand': '#f97316' },
          light: { 'cal-brand': '#f97316' },
        },
        hideEventTypeDetails: true,
        layout: 'month_view',
      });
      cal('on', {
        action: 'bookingSuccessful',
        callback: async (e: { detail: { data?: Record<string, unknown> } }) => {
          const raw = e.detail?.data ?? {};
          // Cal.com embed may nest booking data under a `booking` key or at the top level
          const booking = (raw.booking as Record<string, unknown>) ?? raw;

          if (process.env.NODE_ENV === 'development') {
            console.log('[Cal.com bookingSuccessful] raw event data:', JSON.stringify(raw, null, 2));
          }

          const enrichedData = {
            funnelId: config.funnelId ?? 'default',
            ...formDataRef.current,
            ...(formDataRef.current.phone ? { phone: `${phoneCountryRef.current.code} ${formDataRef.current.phone}` } : {}),
            bookingUid: (booking.uid as string) ?? '',
            bookingDate: (booking.date as string) ?? (booking.startTime as string) ?? '',
            bookingTitle: (booking.title as string) ?? (booking.eventTitle as string) ?? '',
            ...utmParams.current,
          };

          try {
            await fetch('/api/form-submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'booking_completed',
                data: enrichedData,
                submittedAt: new Date().toISOString(),
              }),
            });
          } catch {
            // Silently fail
          }

          if (isQualifiedRef.current) {
            if (!scheduleEventSentRef.current) {
              scheduleEventSentRef.current = true;
              const phone = formDataRef.current.phone
                ? `${phoneCountryRef.current.code} ${formDataRef.current.phone}`
                : undefined;

              trackMetaEvent(
                'Schedule',
                {
                  content_name: 'Creative Multiplier Sprint Fit Call',
                  funnel_id: config.funnelId ?? 'default',
                  booking_uid: enrichedData.bookingUid,
                },
                {
                  email: formDataRef.current.email as string | undefined,
                  phone,
                },
              );
            }
            router.push(config.qualifiedRedirect);
          } else {
            router.push(config.unqualifiedRedirect);
          }
        },
      });
    })();
  }, [step.type, calNamespace, config, router]);

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
        {step.type === 'contact' && (
          <div className="msf-fields-grid">
            {step.fields.map((field) => (
              <div key={field.name} className="msf-field">
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="msf-required">*</span>}
                </label>
                {field.inputType === 'phone' ? (
                  <div className="msf-phone-row">
                    <CountryPicker
                      value={phoneCountry}
                      onChange={(c) => handleCountryChange(field.name, c)}
                      hasError={!!errors[field.name]}
                    />
                    <input
                      id={field.name}
                      type="tel"
                      placeholder={phoneCountry.code === '+1' ? '(555) 123-4567' : '123 456 789'}
                      value={(formData[field.name] as string) ?? ''}
                      onChange={(e) => handlePhoneChange(field.name, e.target.value)}
                      className={errors[field.name] ? 'msf-input-error' : ''}
                      autoComplete="tel"
                    />
                  </div>
                ) : (
                  <div className={field.inputType === 'email' ? 'msf-email-wrapper' : undefined}>
                    <input
                      id={field.name}
                      type={field.inputType}
                      placeholder={field.placeholder}
                      value={(formData[field.name] as string) ?? ''}
                      onChange={(e) => {
                        updateField(field.name, e.target.value);
                        if (field.inputType === 'email') setEmailStatus('idle');
                      }}
                      onBlur={field.inputType === 'email' ? () => verifyEmail((formData[field.name] as string) ?? '') : undefined}
                      className={errors[field.name] ? 'msf-input-error' : ''}
                      autoComplete={
                        field.inputType === 'email' ? 'email' :
                        field.name.includes('first') ? 'given-name' :
                        field.name.includes('last') ? 'family-name' :
                        'off'
                      }
                    />
                    {field.inputType === 'email' && <EmailStatus status={emailStatus} />}
                  </div>
                )}
                {errors[field.name] && <span className="msf-error">{errors[field.name]}</span>}
              </div>
            ))}
          </div>
        )}

        {step.type === 'qualify' && (
          <div className="msf-fields-stack">
            {step.fields.map((field) => (
              <div key={field.name} className="msf-field">
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="msf-required">*</span>}
                </label>

                {field.inputType === 'select' && (
                  <Dropdown
                    options={field.options.map((opt) => ({ value: opt, label: opt }))}
                    value={(formData[field.name] as string) ?? ''}
                    onChange={(v) => updateField(field.name, v)}
                    placeholder="Select one"
                    hasError={!!errors[field.name]}
                    fullWidth
                  />
                )}

                {(field.inputType === 'text' || field.inputType === 'url') && (
                  field.inputType === 'url' ? (
                    <div className={`msf-url-input ${errors[field.name] ? 'msf-input-error' : ''}`}>
                      <span className="msf-url-prefix">https://</span>
                      <input
                        id={field.name}
                        type="text"
                        inputMode="url"
                        placeholder={field.placeholder ? stripUrlProtocol(field.placeholder) : undefined}
                        value={stripUrlProtocol((formData[field.name] as string) ?? '')}
                        onChange={(e) => updateField(field.name, normalizeHttpsUrl(e.target.value))}
                        className={errors[field.name] ? 'msf-input-error' : ''}
                        autoComplete="url"
                      />
                    </div>
                  ) : (
                    <input
                      id={field.name}
                      type={field.inputType}
                      placeholder={field.placeholder}
                      value={(formData[field.name] as string) ?? ''}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      className={errors[field.name] ? 'msf-input-error' : ''}
                      autoComplete="off"
                    />
                  )
                )}

                {field.inputType === 'multi-select' && (
                  <div className="msf-chips">
                    {field.options.map((opt) => {
                      const selected = ((formData[field.name] as string[] | undefined) ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`msf-chip ${selected ? 'msf-chip-selected' : ''}`}
                          onClick={() => toggleMultiSelect(field.name, opt)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {errors[field.name] && <span className="msf-error">{errors[field.name]}</span>}
              </div>
            ))}
          </div>
        )}

        {step.type === 'cal' && (
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
              <Cal
                namespace={step.namespace ?? 'default'}
                calLink={step.calLink}
                style={{ width: '100%', height: '100%', overflow: 'scroll' }}
                config={Object.fromEntries(
                  Object.entries({
                    layout: 'month_view',
                    theme: 'dark',
                    useSlotsViewOnSmallScreen: 'true',
                    firstName: formData.firstName as string,
                    lastName: formData.lastName as string,
                    email: formData.email as string,
                    rev: formData.revenue as string,
                    biztype: formData.businessType as string,
                    leadgen: Array.isArray(formData.leadGen) ? formData.leadGen.join(', ') : '',
                    brandUrl: formData.brandUrl as string,
                    role: formData.role as string,
                    paidSocialSpend: formData.paidSocialSpend as string,
                    winnerStatus: formData.winnerStatus as string,
                    platforms: Array.isArray(formData.platforms) ? formData.platforms.join(', ') : '',
                    deliveryTimeline: formData.deliveryTimeline as string,
                  }).filter(([, v]) => !!v),
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step.type === 'cal' && currentStep > 0 && (
        <div className="msf-nav">
          <button type="button" className="msf-btn msf-btn-back" onClick={handleBack}>
            ← Back
          </button>
        </div>
      )}
      {step.type !== 'cal' && (
        <div className="msf-nav">
          {currentStep > 0 && (
            <button type="button" className="msf-btn msf-btn-back" onClick={handleBack}>
              ← Back
            </button>
          )}
          <button
            type="button"
            className="msf-btn msf-btn-primary"
            onClick={handleNext}
            disabled={submitting || emailStatus === 'verifying' || emailStatus === 'invalid'}
          >
            {submitting ? 'Submitting…' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}
