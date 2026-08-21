/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calMock = vi.hoisted(() => ({ api: vi.fn(), render: vi.fn() }));

vi.mock("@calcom/embed-react", () => ({
  default: (props: unknown) => {
    calMock.render(props);
    return null;
  },
  getCalApi: vi.fn(async () => calMock.api),
}));

import { CalBookingStep } from "./CalBookingStep";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  calMock.api.mockReset();
  calMock.render.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("CalBookingStep", () => {
  it("subscribes to booking success and removes the same listener", async () => {
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
    expect(onCall?.[1]).toMatchObject({ action: "bookingSuccessful" });
    const callback = onCall?.[1].callback as () => void;

    act(() => callback());
    expect(onBookingSuccessful).toHaveBeenCalledWith();
    expect(onBookingSuccessful).toHaveBeenCalledTimes(1);

    await act(async () => root?.unmount());
    root = undefined;
    expect(calMock.api).toHaveBeenCalledWith("off", {
      action: "bookingSuccessful",
      callback,
    });
    expect(calMock.api).toHaveBeenCalledWith("off", {
      action: "*",
      callback: expect.any(Function),
    });
  });

  it("uses Cal dry-run mode during local development", async () => {
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

    expect(calMock.render).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ "cal.isBookingDryRun": "true" }),
      }),
    );
    expect(calMock.api).toHaveBeenCalledWith(
      "on",
      expect.objectContaining({ action: "*" }),
    );
    const dryRunOnCall = calMock.api.mock.calls.find(
      ([method, options]) => method === "on" && options.action === "*",
    );
    const dryRunCallback = dryRunOnCall?.[1].callback as (
      event: unknown,
    ) => void;

    act(() =>
      dryRunCallback({ detail: { type: "dryRunBookingSuccessfulV2" } }),
    );
    expect(onBookingSuccessful).toHaveBeenCalledOnce();
  });
});
