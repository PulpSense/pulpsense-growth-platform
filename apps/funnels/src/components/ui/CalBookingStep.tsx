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
  const config: Record<string, string> = {
    layout: "month_view",
    theme: "light",
    useSlotsViewOnSmallScreen: "true",
    firstName: prefill.firstName,
    lastName: prefill.lastName ?? "",
    email: prefill.email,
    "metadata[pulpsenseSubmissionId]": bookingIdentity.submissionId,
    "metadata[pulpsenseBookingToken]": bookingIdentity.token,
  };

  useEffect(() => {
    trackFunnelEvent("booking_interaction", { action: "widget_viewed" });
    void (async () => {
      const cal = await getCalApi({ namespace });
      cal("ui", {
        theme: "light",
        cssVarsPerTheme: {
          dark: { "cal-brand": "#0080ff" },
          light: { "cal-brand": "#0080ff" },
        },
        hideEventTypeDetails: true,
        layout: "month_view",
      });
      cal("on", {
        action: "bookingSuccessful",
        callback: onBookingSuccessful,
      });
    })();
  }, [namespace, onBookingSuccessful]);

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
