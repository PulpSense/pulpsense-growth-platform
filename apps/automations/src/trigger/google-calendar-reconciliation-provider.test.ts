import { describe, expect, it, vi } from "vitest";

import {
  patchGoogleEventDescription,
  type CalendarReconciliationEnvironment,
} from "./google-calendar-reconciliation.js";

const environment: CalendarReconciliationEnvironment = {
  GOOGLE_CALENDAR_CLIENT_ID: "client-id",
  GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
  GOOGLE_CALENDAR_REFRESH_TOKEN: "refresh-token",
  GOOGLE_CALENDAR_ID: "primary",
};

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
