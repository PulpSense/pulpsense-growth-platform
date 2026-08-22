import { describe, expect, it, vi } from "vitest";

import {
  createCalendarReconciliationAdapters,
  patchGoogleEventDescription,
  type CalendarReconciliationEnvironment,
} from "./google-calendar-reconciliation.js";

const environment: CalendarReconciliationEnvironment = {
  GOOGLE_CALENDAR_CLIENT_ID: "client-id",
  GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
  GOOGLE_CALENDAR_REFRESH_TOKEN: "refresh-token",
  GOOGLE_CALENDAR_ID: "primary",
};

const calBooking = {
  uid: "cal-new",
  title: "Sales call",
  status: "accepted",
  start: "2026-08-24T10:00:00.000Z",
  end: "2026-08-24T10:30:00.000Z",
  hosts: [],
  attendees: [],
};

describe("Cal reschedule provider", () => {
  it("omits the optional rescheduling reason", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: calBooking }), {
        status: 201,
      }),
    );
    const adapters = createCalendarReconciliationAdapters(
      {
        ...environment,
        TWENTY_API_ORIGIN: "https://twenty.example.com",
        TWENTY_API_KEY: "twenty-key",
        CAL_API_KEY: "cal-key",
      },
      fetcher as unknown as typeof fetch,
    );

    await adapters.rescheduleCalBooking({
      bookingUid: "cal-old",
      start: calBooking.start,
      rescheduledBy: "host@pulpsense.com",
      rescheduleWithSameHost: true,
      allowConflicts: true,
      allowBookingOutOfBounds: true,
      skipBookingLimits: true,
    });

    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      start: calBooking.start,
      rescheduledBy: "host@pulpsense.com",
      rescheduleWithSameHost: true,
      allowConflicts: true,
      allowBookingOutOfBounds: true,
      skipBookingLimits: true,
    });
  });
});

describe("Google Calendar description provider", () => {
  it("patches only the description on the designated event with etag protection and no guest updates", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "event/id" }), { status: 200 }),
      );

    await patchGoogleEventDescription(
      {
        calendarId: "primary",
        eventId: "event/id",
        etag: '"etag-1"',
        description: "Updated description",
      },
      environment,
      fetcher as unknown as typeof fetch,
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/event%2Fid?sendUpdates=none",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer access-token",
          Accept: "application/json",
          "Content-Type": "application/json",
          "If-Match": '"etag-1"',
        },
        body: JSON.stringify({ description: "Updated description" }),
      },
    );
  });

  it("rejects a mapped event outside the designated calendar before fetching", async () => {
    const fetcher = vi.fn();
    await expect(
      patchGoogleEventDescription(
        {
          calendarId: "another-calendar",
          eventId: "event-id",
          etag: '"etag-1"',
          description: "Updated description",
        },
        environment,
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toThrow("designated calendar");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
