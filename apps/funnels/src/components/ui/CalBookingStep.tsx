"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

import type { CalStep } from "./MultiStepForm";

type CalBookingStepProps = {
  step: CalStep;
  formData: Readonly<Record<string, string | string[]>>;
  bookingIdentity: { submissionId: string; token: string };
  onBookingSuccessful(): void;
};

export function CalBookingStep({
  step,
  formData,
  bookingIdentity,
  onBookingSuccessful,
}: CalBookingStepProps) {
  const namespace = step.namespace ?? "default";

  useEffect(() => {
    void (async () => {
      const cal = await getCalApi({ namespace });
      cal("ui", {
        theme: "dark",
        cssVarsPerTheme: {
          dark: { "cal-brand": "#f97316" },
          light: { "cal-brand": "#f97316" },
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
      calLink={step.calLink}
      style={{ width: "100%", height: "100%", overflow: "scroll" }}
      config={Object.fromEntries(
        Object.entries({
          layout: "month_view",
          theme: "dark",
          useSlotsViewOnSmallScreen: "true",
          firstName: formData.firstName as string,
          lastName: formData.lastName as string,
          email: formData.email as string,
          brandUrl: formData.brandUrl as string,
          paidSocialSpend: formData.paidSocialSpend as string,
          winnerStatus: formData.winnerStatus as string,
          platforms: Array.isArray(formData.platforms)
            ? formData.platforms.join(", ")
            : "",
          deliveryTimeline: formData.deliveryTimeline as string,
          "metadata[pulpsenseSubmissionId]": bookingIdentity.submissionId,
          "metadata[pulpsenseBookingToken]": bookingIdentity.token,
        }).filter(([, value]) => Boolean(value)),
      )}
    />
  );
}
