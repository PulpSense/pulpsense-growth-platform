/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("@calcom/embed-react", () => ({
  default: () => null,
  getCalApi: vi.fn(async () => calMock.api),
}));

import { bookingUidFromCalEvent, CalBookingStep } from "./CalBookingStep";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  calMock.api.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("bookingUidFromCalEvent", () => {
  it("extracts the confirmed booking UID from Cal's success event", () => {
    expect(
      bookingUidFromCalEvent({
        detail: { data: { uid: "  cal_booking_123  " } },
      }),
    ).toBe("cal_booking_123");
  });

  it("rejects malformed success events", () => {
    expect(bookingUidFromCalEvent({ detail: { data: {} } })).toBeUndefined();
  });
});

describe("CalBookingStep", () => {
  it("subscribes to V2 booking success and removes the same listener", async () => {
    const onBookingSuccessful = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(CalBookingStep, {
          calLink: "pulpsense/audit",
          namespace: "ai-seo",
          prefill: {
            firstName: "Maya",
            lastName: "Chen",
            email: "maya@example.com",
          },
          bookingIdentity: { submissionId: "submission-1", token: "token-1" },
          onBookingSuccessful,
        }),
      );
      await Promise.resolve();
    });

    const onCall = calMock.api.mock.calls.find(([method]) => method === "on");
    expect(onCall?.[1]).toMatchObject({ action: "bookingSuccessfulV2" });
    const callback = onCall?.[1].callback as (event: unknown) => void;

    act(() => callback({ detail: { data: { uid: "cal_booking_123" } } }));
    act(() => callback({ detail: { data: { uid: "cal_booking_123" } } }));
    expect(onBookingSuccessful).toHaveBeenCalledWith("cal_booking_123");
    expect(onBookingSuccessful).toHaveBeenCalledTimes(1);

    await act(async () => root?.unmount());
    root = undefined;
    expect(calMock.api).toHaveBeenCalledWith("off", {
      action: "bookingSuccessfulV2",
      callback,
    });
  });
});
