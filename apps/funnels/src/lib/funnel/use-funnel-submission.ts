import { useCallback, useRef } from "react";
import type { FunnelId } from "@pulpsense/contracts";

import type { FunnelAttribution } from "@/utils/funnelAttribution";
import {
  getFunnelAnalyticsIdentity,
  identifyFunnelProspect,
} from "@/utils/funnelAnalytics";

const touchPropertyNames = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
  gclid: "gclid",
  fbclid: "fbclid",
  msclkid: "msclkid",
  ttclid: "ttclid",
  liFatId: "li_fat_id",
  landingPage: "landing_page",
  referrer: "referrer",
} as const;

const touchPersonProperties = (
  prefix: "first" | "last",
  touch: FunnelAttribution["firstTouch"],
) =>
  Object.fromEntries(
    Object.entries(touch).map(([key, value]) => [
      `${prefix}_${touchPropertyNames[key as keyof typeof touchPropertyNames]}`,
      value,
    ]),
  );

export type ContactSubmissionInput = {
  data: Readonly<Record<string, string | string[]>>;
  phoneCountryCode: string;
  attribution: FunnelAttribution;
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
  | {
      accepted: true;
      eventId: string;
      prospectId: string;
      leadJourneyId: string;
    }
  | {
      accepted: false;
      error: ContactSubmissionError;
      retryAvailable: boolean;
    };

export type ApplicationSubmissionInput = {
  data: Readonly<Record<string, string | string[]>>;
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

const knownSubmissionErrors = new Set<ContactSubmissionError>([
  "email_invalid",
  "rate_limited",
  "turnstile_unavailable",
  "submission_failed",
]);

const isLocalDevelopment = import.meta.env.DEV;

const normalizeSubmissionError = (
  error: string | undefined,
): ContactSubmissionError =>
  error && knownSubmissionErrors.has(error as ContactSubmissionError)
    ? (error as ContactSubmissionError)
    : "submission_failed";

export function useFunnelSubmission(funnelId: FunnelId) {
  const attemptIdRef = useRef("");
  const retryRef = useRef<{ submissionId: string; token: string } | undefined>(
    undefined,
  );

  const submitContact = useCallback(
    async (input: ContactSubmissionInput): Promise<ContactSubmissionResult> => {
      if (!retryRef.current && !input.turnstileToken) {
        return {
          accepted: false,
          error: "turnstile_unavailable",
          retryAvailable: false,
        };
      }

      attemptIdRef.current ||= crypto.randomUUID();
      if (isLocalDevelopment) {
        const submissionId = attemptIdRef.current;
        retryRef.current = {
          submissionId,
          token: "local-development",
        };
        return {
          accepted: true,
          eventId: `contact_submitted:${submissionId}`,
          prospectId: `local-${submissionId}`,
          leadJourneyId: submissionId,
        };
      }

      const phone = input.data.phone as string | undefined;
      const measurement = getFunnelAnalyticsIdentity();
      const response = await fetch("/api/funnel-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          eventType: "contact_submitted",
          funnelId,
          attemptId: attemptIdRef.current,
          turnstileToken: input.turnstileToken || "verified-by-retry-token",
          ...(retryRef.current ? { retry: retryRef.current } : {}),
          payload: {
            firstName: input.data.firstName,
            lastName: input.data.lastName || "",
            email: input.data.email,
            phone: phone ? `${input.phoneCountryCode} ${phone}` : "",
          },
          attribution: input.attribution,
          ...(measurement.analyticsId
            ? { analyticsId: measurement.analyticsId }
            : {}),
          ...(measurement.sessionId
            ? { sessionId: measurement.sessionId }
            : {}),
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
        prospectId?: string;
        submissionId?: string;
        retry?: { submissionId: string; token: string };
      };

      if (result.retry) retryRef.current = result.retry;
      if (
        response.ok &&
        result.accepted === true &&
        result.eventId &&
        result.prospectId &&
        result.submissionId
      ) {
        const email = String(input.data.email ?? "")
          .trim()
          .toLowerCase();
        const companyDomain = email.split("@").at(-1);
        const name = [input.data.firstName, input.data.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        identifyFunnelProspect(
          result.prospectId,
          {
            email,
            name,
            phone: phone ? `${input.phoneCountryCode} ${phone}` : "",
            ...(companyDomain ? { company_domain: companyDomain } : {}),
            funnel_id: funnelId,
            lead_journey_id: result.submissionId,
            ...touchPersonProperties("last", input.attribution.lastTouch),
          },
          {
            created_at: new Date().toISOString(),
            ...touchPersonProperties("first", input.attribution.firstTouch),
          },
        );
        return {
          accepted: true,
          eventId: result.eventId,
          prospectId: result.prospectId,
          leadJourneyId: result.submissionId,
        };
      }

      return {
        accepted: false,
        error: normalizeSubmissionError(result.error),
        retryAvailable: Boolean(retryRef.current),
      };
    },
    [funnelId],
  );

  const submitApplication = useCallback(
    async (
      input: ApplicationSubmissionInput,
    ): Promise<ApplicationSubmissionResult> => {
      if (!retryRef.current) {
        return { accepted: false, error: "invalid_submission_identity" };
      }

      if (isLocalDevelopment) {
        return {
          accepted: true,
          eventId: `application_submitted:${retryRef.current.submissionId}`,
          qualificationStatus: "qualified",
          nextStep: "booking",
          bookingIdentity: retryRef.current,
        };
      }

      const response = await fetch("/api/funnel-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          eventType: "application_submitted",
          funnelId,
          identity: retryRef.current,
          payload: input.data,
          ...getFunnelAnalyticsIdentity(),
          sourceUrl: input.sourceUrl,
          ...(input.referrer ? { referrer: input.referrer } : {}),
          ...(input.fbp ? { fbp: input.fbp } : {}),
          ...(input.fbc ? { fbc: input.fbc } : {}),
        }),
      });
      const result = (await response.json()) as {
        accepted?: boolean;
        eventId?: string;
        qualificationStatus?: "qualified" | "unqualified";
        nextStep?: "booking" | "unqualified";
        bookingIdentity?: { submissionId: string; token: string };
        error?: string;
      };

      return {
        accepted: response.ok && result.accepted === true,
        ...(result.eventId ? { eventId: result.eventId } : {}),
        ...(result.qualificationStatus
          ? { qualificationStatus: result.qualificationStatus }
          : {}),
        ...(result.nextStep ? { nextStep: result.nextStep } : {}),
        ...(result.bookingIdentity
          ? { bookingIdentity: result.bookingIdentity }
          : {}),
        ...(result.error ? { error: result.error } : {}),
      };
    },
    [funnelId],
  );

  const resetContactIdentity = useCallback(() => {
    const hadRetryIdentity = Boolean(retryRef.current);
    retryRef.current = undefined;
    attemptIdRef.current = "";
    return hadRetryIdentity;
  }, []);

  return { submitContact, submitApplication, resetContactIdentity };
}
