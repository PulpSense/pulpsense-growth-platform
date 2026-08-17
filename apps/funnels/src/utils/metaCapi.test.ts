/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackMetaSchedule } from "./metaCapi";

describe("trackMetaSchedule", () => {
  beforeEach(() => {
    window.fbq = vi.fn();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fires the browser Schedule with the authoritative server event ID", () => {
    expect(
      trackMetaSchedule({
        bookingUid: "cal_booking_123",
        funnelId: "ai-seo-hair-restoration",
      }),
    ).toBe("booking_completed:cal_booking_123");

    expect(window.fbq).toHaveBeenCalledWith(
      "track",
      "Schedule",
      { funnel_id: "ai-seo-hair-restoration" },
      { eventID: "booking_completed:cal_booking_123" },
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
