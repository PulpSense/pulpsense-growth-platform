"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

import { trackFunnelEvent } from "@/utils/funnelAnalytics";

type CalBookingStepProps = {
  calLink: string;
  namespace?: string;
  prefill: Readonly<{
    firstName: string;
    lastName?: string;
    email: string;
  }>;
  bookingIdentity: { submissionId: string; token: string };
  onBookingSuccessful(): void;
};

export function CalBookingStep({
  calLink,
  namespace = "default",
  prefill,
  bookingIdentity,
  onBookingSuccessful,
}: CalBookingStepProps) {
  const isLocalDryRun = import.meta.env.DEV;
  const config: Record<string, string> = {
    layout: "month_view",
    theme: "light",
    useSlotsViewOnSmallScreen: "true",
    firstName: prefill.firstName,
    lastName: prefill.lastName ?? "",
    email: prefill.email,
    "metadata[pulpsenseSubmissionId]": bookingIdentity.submissionId,
    "metadata[pulpsenseBookingToken]": bookingIdentity.token,
    ...(isLocalDryRun ? { "cal.isBookingDryRun": "true" } : {}),
  };

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    trackFunnelEvent("booking_interaction", { action: "widget_viewed" });
    void (async () => {
      const cal = await getCalApi({ namespace });
      if (disposed) return;
      cal("ui", {
        theme: "light",
        cssVarsPerTheme: {
          dark: { "cal-brand": "#0080ff" },
          light: { "cal-brand": "#0080ff" },
        },
        hideEventTypeDetails: true,
        layout: "month_view",
      });
      const callback = () => onBookingSuccessful();
      const dryRunCallback = (event: unknown) => {
        const eventType = (
          event as { detail?: { type?: string } } | null | undefined
        )?.detail?.type;
        if (eventType === "dryRunBookingSuccessfulV2") callback();
      };
      cal("on", { action: "bookingSuccessful", callback });
      if (isLocalDryRun) {
        cal("on", { action: "*", callback: dryRunCallback });
      }
      unsubscribe = () => {
        cal("off", { action: "bookingSuccessful", callback });
        if (isLocalDryRun) {
          cal("off", { action: "*", callback: dryRunCallback });
        }
      };
    })();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [isLocalDryRun, namespace, onBookingSuccessful]);

  return (
    <Cal
      namespace={namespace}
      calLink={calLink}
      // Cal's inline embed sets its iframe height whenever the booking view changes.
      // A host-controlled height here prevents the month and slot views from fitting
      // their actual rendered content.
      style={{ width: "100%" }}
      config={config}
    />
  );
}
