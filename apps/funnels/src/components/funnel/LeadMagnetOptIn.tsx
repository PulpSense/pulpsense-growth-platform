"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

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

type Props = {
  magnetId: string;
  buttonLabel: string;
  successTitle: string;
  successDescription: string;
  turnstileSiteKey?: string;
};

export function LeadMagnetOptIn({
  magnetId,
  buttonLabel,
  successTitle,
  successDescription,
  turnstileSiteKey,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    let active = true;

    const render = () => {
      if (
        !active ||
        !window.turnstile ||
        !containerRef.current ||
        widgetRef.current
      ) {
        return;
      }
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        action: "lead_magnet_submit",
        appearance: "interaction-only",
        callback: (value) => {
          if (active) setToken(value);
        },
        "error-callback": () => {
          if (active) setToken("");
        },
        "expired-callback": () => {
          if (active) setToken("");
        },
      });
    };

    const script = document.querySelector<HTMLScriptElement>(
      "script[data-pulpsense-turnstile]",
    );
    if (window.turnstile) render();
    else script?.addEventListener("load", render, { once: true });

    return () => {
      active = false;
      script?.removeEventListener("load", render);
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
    };
  }, [turnstileSiteKey]);

  const resetTurnstile = () => {
    setToken("");
    if (widgetRef.current) window.turnstile?.reset(widgetRef.current);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!token) {
      setStatus("error");
      setMessage("Please complete the security check and try again.");
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch("/api/lead-magnets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magnetId,
          firstName,
          email,
          turnstileToken: token,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (result.error === "email_invalid") {
          setMessage("Please enter a valid email address.");
        } else if (result.error === "rate_limited") {
          setMessage("Too many attempts. Please wait a moment and try again.");
        } else {
          setMessage("We couldn’t send the skill right now. Please try again.");
        }
        setStatus("error");
        resetTurnstile();
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setMessage("We couldn’t send the skill right now. Please try again.");
      resetTurnstile();
    }
  };

  if (status === "success") {
    return (
      <div className="lm-success" role="status">
        <span className="lm-success-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2>{successTitle}</h2>
          <p>{successDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="lm-form" onSubmit={submit} noValidate>
      <label htmlFor="lead-magnet-first-name">First name</label>
      <input
        id="lead-magnet-first-name"
        name="firstName"
        autoComplete="given-name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        required
        maxLength={100}
        placeholder="Your first name"
      />
      <label htmlFor="lead-magnet-email">Email</label>
      <input
        id="lead-magnet-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        maxLength={320}
        placeholder="you@company.com"
      />
      <div ref={containerRef} className="lm-turnstile" aria-hidden="true" />
      {message && (
        <p className="lm-error" role="alert">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "submitting" || !firstName || !email}
      >
        {status === "submitting" ? "Sending…" : buttonLabel}
      </button>
    </form>
  );
}
