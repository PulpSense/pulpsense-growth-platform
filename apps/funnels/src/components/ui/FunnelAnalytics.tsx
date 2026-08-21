"use client";

import { useEffect } from "react";

import type { DeploymentEnvironment } from "@/lib/funnel/runtime-config";
import {
  configureFunnelAnalytics,
  isCtaPlacement,
  trackFunnelEvent,
} from "@/utils/funnelAnalytics";
import { captureFunnelAttribution } from "@/utils/funnelAttribution";

type FunnelAnalyticsProps = {
  apiKey?: string;
  host?: string;
  funnelId: string;
  environment: DeploymentEnvironment;
  page: "landing" | "application" | "qualified" | "unqualified";
};

export function FunnelAnalytics({
  apiKey,
  host = "/e",
  funnelId,
  environment,
  page,
}: FunnelAnalyticsProps) {
  useEffect(() => {
    captureFunnelAttribution({
      funnelId,
      href: window.location.href,
      referrer: document.referrer,
      storage: window.localStorage,
    });
    if (!apiKey) return;
    void configureFunnelAnalytics({ apiKey, host, environment, funnelId });
    trackFunnelEvent("funnel_viewed", { page });
  }, [apiKey, environment, funnelId, host, page]);

  useEffect(() => {
    const trackCta = (event: Event) => {
      const placement = (event as CustomEvent<{ placement?: string }>).detail
        ?.placement;
      if (isCtaPlacement(placement)) {
        trackFunnelEvent("cta_clicked", { placement });
      }
    };
    window.addEventListener("pulpsense:cta-clicked", trackCta);
    return () => window.removeEventListener("pulpsense:cta-clicked", trackCta);
  }, []);

  return null;
}
