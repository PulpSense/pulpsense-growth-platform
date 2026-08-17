"use client";

import Cal, { getCalApi, type EmbedEvent } from "@calcom/embed-react";
import { useEffect, useRef } from "react";

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
  onBookingSuccessful(bookingUid: string): void;
};

export const bookingUidFromCalEvent = (event: unknown) => {
  if (!event || typeof event !== "object" || !("detail" in event)) {
    return undefined;
  }
  const detail = event.detail;
  if (!detail || typeof detail !== "object" || !("data" in detail)) {
    return undefined;
  }
  const data = detail.data;
  if (!data || typeof data !== "object" || !("uid" in data)) {
    return undefined;
  }
  return typeof data.uid === "string" && data.uid.trim()
    ? data.uid.trim()
    : undefined;
};

export function CalBookingStep({
  calLink,
  namespace = "default",
  prefill,
  bookingIdentity,
  onBookingSuccessful,
}: CalBookingStepProps) {
  const handledBookingUids = useRef(new Set<string>());
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
      const callback = (event: EmbedEvent<"bookingSuccessfulV2">) => {
        const bookingUid = bookingUidFromCalEvent(event);
        if (!bookingUid || handledBookingUids.current.has(bookingUid)) return;
        handledBookingUids.current.add(bookingUid);
        onBookingSuccessful(bookingUid);
      };
      cal("on", { action: "bookingSuccessfulV2", callback });
      unsubscribe = () =>
        cal("off", { action: "bookingSuccessfulV2", callback });
    })();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
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
