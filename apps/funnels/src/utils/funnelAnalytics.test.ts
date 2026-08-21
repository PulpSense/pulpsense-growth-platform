import { describe, expect, it, vi } from "vitest";

import {
  CTA_PLACEMENTS,
  configureFunnelAnalytics,
  createFunnelAnalyticsClient,
  isCtaPlacement,
  trackFunnelEvent,
} from "./funnelAnalytics";

const createPostHog = () => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(() => "anonymous-id"),
  get_session_id: vi.fn(() => "session-id"),
});

describe("CTA placements", () => {
  it("uses the shared placement contract for runtime validation", () => {
    for (const placement of CTA_PLACEMENTS) {
      expect(isCtaPlacement(placement)).toBe(true);
    }

    expect(isCtaPlacement("unknown")).toBe(false);
    expect(isCtaPlacement(undefined)).toBe(false);
  });
});

describe("createFunnelAnalyticsClient", () => {
  it("loads PostHog asynchronously and flushes events captured while loading", async () => {
    const posthog = createPostHog();
    let release!: (posthog: ReturnType<typeof createPostHog>) => void;
    const loader = vi.fn(
      () =>
        new Promise<ReturnType<typeof createPostHog>>((resolve) => {
          release = resolve;
        }),
    );

    const configuring = configureFunnelAnalytics(
      {
        apiKey: "phc_production",
        host: "https://eu.i.posthog.com",
        environment: "production",
        funnelId: "ai-seo",
      },
      loader,
    );
    trackFunnelEvent("cta_clicked", { placement: "hero" });

    expect(loader).toHaveBeenCalledOnce();
    expect(posthog.capture).not.toHaveBeenCalled();

    release(posthog);
    await configuring;

    expect(posthog.capture).toHaveBeenCalledWith(
      "cta_clicked",
      {
        funnel_id: "ai-seo",
        placement: "hero",
      },
      { timestamp: expect.any(Date) },
    );
  });

  it("records complete production replay input and network debugging context", () => {
    const posthog = createPostHog();
    const client = createFunnelAnalyticsClient(
      {
        apiKey: "phc_production",
        host: "https://eu.i.posthog.com/",
        environment: "production",
        funnelId: "ai-seo",
      },
      { posthog },
    );

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_production",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        ui_host: "https://eu.posthog.com",
        capture_pageview: false,
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: true,
        },
        capture_performance: { network_timing: true, web_vitals: false },
        disable_session_recording: false,
        person_profiles: "identified_only",
        session_recording: expect.objectContaining({
          maskAllInputs: false,
          recordHeaders: true,
          recordBody: true,
        }),
      }),
    );

    client.capture("funnel_validation_failed", {
      step: "contact",
      fields: ["email", "phone"],
      email: "maya@brand.com",
    } as never);

    expect(posthog.capture).toHaveBeenCalledWith("funnel_validation_failed", {
      funnel_id: "ai-seo",
      step: "contact",
      fields: ["email", "phone"],
    });

    const config = posthog.init.mock.calls[0]![1];
    expect(config).not.toHaveProperty("sanitize_properties");
    expect(config.session_recording).not.toHaveProperty(
      "maskCapturedNetworkRequestFn",
    );
  });

  it("uses the first-party proxy without changing deferred initialization", () => {
    const posthog = createPostHog();

    createFunnelAnalyticsClient(
      {
        apiKey: "phc_production",
        host: "/e/",
        environment: "production",
        funnelId: "ai-seo",
      },
      { posthog },
    );

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_production",
      expect.objectContaining({
        api_host: "/e",
        ui_host: "https://us.posthog.com",
      }),
    );
  });

  it("does not initialize or capture outside production", () => {
    const posthog = createPostHog();
    const client = createFunnelAnalyticsClient(
      {
        apiKey: "phc_preview",
        host: "https://eu.i.posthog.com",
        environment: "preview",
        funnelId: "ai-seo",
      },
      { posthog },
    );

    client.capture("cta_clicked", { placement: "hero" });

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("keeps Qualification Snapshot answers flexible and identifies accepted Prospects", () => {
    const posthog = createPostHog();
    const client = createFunnelAnalyticsClient(
      {
        apiKey: "phc_production",
        host: "https://us.i.posthog.com",
        environment: "production",
        funnelId: "ai-seo",
      },
      { posthog },
    );
    const prospectId = `prospect_v1_${"a".repeat(64)}`;

    client.capture("funnel_qualification_submitted", {
      qualification_status: "qualified",
      qualification_form_id: "ai-seo",
      qualification_form_version: "2026-08-15",
      qualification_questions: { future_question: "A future question?" },
      qualification_answers: {
        future_question: ["new", { arbitrary: true }],
      },
    });
    client.identify(
      prospectId,
      { email: "maya@brand.com", lead_journey_id: "journey" },
      { first_utm_source: "meta" },
    );

    expect(posthog.capture).toHaveBeenCalledWith(
      "funnel_qualification_submitted",
      expect.objectContaining({
        qualification_answers: {
          future_question: ["new", { arbitrary: true }],
        },
      }),
    );
    expect(posthog.identify).toHaveBeenCalledWith(
      prospectId,
      expect.objectContaining({ email: "maya@brand.com" }),
      { first_utm_source: "meta" },
    );
  });

  it("does not send an identified Prospect ID through UUID-only submission fields", () => {
    const posthog = createPostHog();
    posthog.get_distinct_id.mockReturnValue(`prospect_v1_${"a".repeat(64)}`);
    posthog.get_session_id.mockReturnValue(
      "311de7bf-a46f-49f9-a107-5cc030e960c3",
    );
    const client = createFunnelAnalyticsClient(
      {
        apiKey: "phc_production",
        host: "https://us.i.posthog.com",
        environment: "production",
        funnelId: "ai-seo",
      },
      { posthog },
    );

    expect(client.getIdentity()).toEqual({
      sessionId: "311de7bf-a46f-49f9-a107-5cc030e960c3",
    });

    posthog.get_distinct_id.mockReturnValue(
      "11111111-1111-1111-1111-111111111111",
    );
    posthog.get_session_id.mockReturnValue(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(client.getIdentity()).toEqual({});
  });
});
