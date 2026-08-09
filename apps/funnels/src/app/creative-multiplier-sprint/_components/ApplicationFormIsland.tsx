"use client";

import { useCallback, useRef } from "react";

import { MultiStepForm } from "@/components/ui/MultiStepForm";
import type {
  ContactSubmissionInput,
  ContactSubmissionResult,
  MultiStepFormConfig,
} from "@/components/ui/MultiStepForm";

import s from "./CreativeMultiplier.module.css";

type ApplicationFormIslandProps = {
  config: MultiStepFormConfig;
  turnstileSiteKey?: string;
};

export function ApplicationFormIsland({
  config,
  turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
}: ApplicationFormIslandProps) {
  const attemptIdRef = useRef("");
  const retryRef = useRef<{ submissionId: string; token: string } | undefined>(
    undefined,
  );

  const submitContact = useCallback(
    async (input: ContactSubmissionInput): Promise<ContactSubmissionResult> => {
      if (!retryRef.current && !input.turnstileToken) {
        return { accepted: false, error: "turnstile_unavailable" };
      }

      attemptIdRef.current ||= crypto.randomUUID();
      const phone = input.data.phone as string | undefined;
      const response = await fetch("/api/funnel-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          eventType: "contact_submitted",
          funnelId: "creative-multiplier-sprint",
          attemptId: attemptIdRef.current,
          turnstileToken: input.turnstileToken || "verified-by-retry-token",
          ...(retryRef.current ? { retry: retryRef.current } : {}),
          payload: {
            firstName: input.data.firstName,
            lastName: input.data.lastName,
            email: input.data.email,
            phone: phone ? `${input.phoneCountryCode} ${phone}` : "",
          },
          attribution: input.attribution,
          sourceUrl: input.sourceUrl,
          ...(input.referrer ? { referrer: input.referrer } : {}),
          ...(input.fbp ? { fbp: input.fbp } : {}),
          ...(input.fbc ? { fbc: input.fbc } : {}),
        }),
      });
      const result = (await response.json()) as {
        accepted?: boolean;
        error?: string;
        eventId?: string;
        retry?: { submissionId: string; token: string };
      };

      if (result.retry) retryRef.current = result.retry;

      return {
        accepted: response.ok && result.accepted === true,
        ...(result.eventId ? { eventId: result.eventId } : {}),
        ...(result.error ? { error: result.error } : {}),
        retryAvailable: Boolean(retryRef.current),
      };
    },
    [],
  );

  const resetContactIdentity = useCallback(() => {
    const hadRetryIdentity = Boolean(retryRef.current);
    retryRef.current = undefined;
    attemptIdRef.current = "";
    return hadRetryIdentity;
  }, []);

  return (
    <div className={s.formEmbed}>
      <MultiStepForm
        config={{
          ...config,
          ...(turnstileSiteKey ? { turnstileSiteKey } : {}),
        }}
        onContactSubmit={submitContact}
        onContactInputChanged={resetContactIdentity}
      />
    </div>
  );
}
