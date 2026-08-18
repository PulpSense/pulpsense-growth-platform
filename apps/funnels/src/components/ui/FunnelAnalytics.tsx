"use client";

import { useEffect } from "react";

import type { DeploymentEnvironment } from "@/lib/funnel/runtime-config";
import {
  configureFunnelAnalytics,
  trackFunnelEvent,
} from "@/utils/funnelAnalytics";
import { captureFunnelAttribution } from "@/utils/funnelAttribution";

type FunnelAnalyticsProps = {
  apiKey?: string;
  host?: string;
  funnelId: string;
  environment: DeploymentEnvironment;
  page: "landing" | "qualified" | "unqualified";
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

  return null;
}
