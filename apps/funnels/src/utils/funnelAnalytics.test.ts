import { describe, expect, it, vi } from "vitest";

import {
  configureFunnelAnalytics,
  createFunnelAnalyticsClient,
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

  it("records production funnels with replay privacy and clean custom events", () => {
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
        capture_pageview: false,
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: true,
        },
        capture_performance: { network_timing: true, web_vitals: false },
        disable_session_recording: false,
        person_profiles: "identified_only",
        sanitize_properties: expect.any(Function),
        session_recording: expect.objectContaining({ maskAllInputs: true }),
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
    expect(
      config.session_recording.maskCapturedNetworkRequestFn({
        name: "https://example.com/api/funnel-events?token=secret",
        entryType: "resource",
        startTime: 12,
        method: "POST",
        requestBody: "private",
        responseBody: "private",
        headers: { authorization: "secret" },
        status: 202,
        duration: 42,
      }),
    ).toEqual({
      name: "https://example.com/api/funnel-events",
      entryType: "resource",
      startTime: 12,
      method: "POST",
      status: 202,
      duration: 42,
      failure_class: "none",
    });
    expect(
      config.sanitize_properties({
        $current_url: "https://example.com/landing?email=maya@example.com",
        $elements: [{ href: "https://example.com/book?token=secret#calendar" }],
      }),
    ).toEqual({
      $current_url: "https://example.com/landing",
      $elements: [{ href: "https://example.com/book" }],
    });
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
