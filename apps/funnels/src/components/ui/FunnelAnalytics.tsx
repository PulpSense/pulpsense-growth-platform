"use client";

import { useEffect } from "react";

import {
  configureFunnelAnalytics,
  trackFunnelEvent,
} from "@/utils/funnelAnalytics";
import { captureFunnelAttribution } from "@/utils/funnelAttribution";

type FunnelAnalyticsProps = {
  apiKey?: string;
  host?: string;
  funnelId: string;
  page: "landing" | "qualified" | "unqualified";
};

export function FunnelAnalytics({
  apiKey,
  host = "https://us.i.posthog.com",
  funnelId,
  page,
}: FunnelAnalyticsProps) {
  useEffect(() => {
    const { analyticsId } = captureFunnelAttribution({
      funnelId,
      href: window.location.href,
      referrer: document.referrer,
      storage: window.localStorage,
      createAnalyticsId: () => crypto.randomUUID(),
    });
    trackFunnelEvent("funnel_viewed", { page });

    if (!apiKey) return;
    configureFunnelAnalytics({ apiKey, host, analyticsId, funnelId });
  }, [apiKey, funnelId, host, page]);

  return null;
}
