import { describe, expect, it, vi } from "vitest";

import {
  refreshGoogleRescheduleLink,
  replaceCalRescheduleUid,
  type RescheduleLinkAdapters,
} from "./calendar-reschedule-link.js";

const previousUid = "cal-old";
const replacementUid = "cal-new";
const oldDescription = [
  "Join the meeting from the link above.",
  "",
  `<a href="https://cal.com/santi/sales-call?rescheduleUid=${previousUid}&amp;eventTypeSlug=sales-call">Reschedule</a>`,
  `<a href="https://cal.com/cancel/${previousUid}">Cancel</a>`,
].join("\n");

describe("replaceCalRescheduleUid", () => {
  it("changes only the UID query parameter in one recognized Cal link", () => {
    const result = replaceCalRescheduleUid(
      oldDescription,
      previousUid,
      replacementUid,
    );

    expect(result).toEqual({
      outcome: "updated",
      description: oldDescription.replace(
        `rescheduleUid=${previousUid}`,
        `rescheduleUid=${replacementUid}`,
      ),
    });
    expect(result.description).toContain(`/cancel/${previousUid}`);
  });

  it("is idempotent when the recognized link is already current", () => {
    const current = oldDescription.replaceAll(previousUid, replacementUid);
    expect(
      replaceCalRescheduleUid(current, previousUid, replacementUid),
    ).toEqual({ outcome: "already_current", description: current });
  });

  it("changes Cal's booking-path reschedule link format", () => {
    const description = `<a href="https://cal.com/booking/${previousUid}?changes=true">Reschedule</a>`;

    expect(
      replaceCalRescheduleUid(description, previousUid, replacementUid),
    ).toEqual({
      outcome: "updated",
      description: description.replace(previousUid, replacementUid),
    });
  });

  it("recognizes Cal's current booking-path link without writing", () => {
    const description = `<a href="https://cal.com/booking/${replacementUid}?changes=true">Reschedule</a>`;

    expect(
      replaceCalRescheduleUid(description, previousUid, replacementUid),
    ).toEqual({ outcome: "already_current", description });
  });

  it("refuses unrelated hosts and ambiguous descriptions", () => {
    expect(() =>
      replaceCalRescheduleUid(
        `https://example.com/book?rescheduleUid=${previousUid}`,
        previousUid,
        replacementUid,
      ),
    ).toThrow("google_reschedule_link_not_uniquely_recognized");
    expect(() =>
      replaceCalRescheduleUid(
        `${oldDescription}\n${oldDescription}`,
        previousUid,
        replacementUid,
      ),
    ).toThrow("google_reschedule_link_not_uniquely_recognized");
    const currentDescription = oldDescription.replaceAll(
      previousUid,
      replacementUid,
    );
    expect(() =>
      replaceCalRescheduleUid(
        `${currentDescription}\n${currentDescription}`,
        previousUid,
        replacementUid,
      ),
    ).toThrow("google_reschedule_link_not_uniquely_recognized");
    expect(() =>
      replaceCalRescheduleUid(
        `${oldDescription}\n${currentDescription}`,
        previousUid,
        replacementUid,
      ),
    ).toThrow("google_reschedule_link_not_uniquely_recognized");
  });
});

describe("refreshGoogleRescheduleLink", () => {
  const harness = () => {
    let description = oldDescription;
    const adapters: RescheduleLinkAdapters = {
      getCalBookingReferences: vi.fn(async () => [
        {
          type: "google_calendar",
          destinationCalendarId: "primary",
          eventUid: "google-event",
        },
      ]),
      getGoogleEvent: vi.fn(async () => ({
        id: "google-event",
        etag: '"etag-1"',
        description,
      })),
      patchGoogleEventDescription: vi.fn(async (input) => {
        description = input.description;
      }),
    };
    return { adapters, description: () => description };
  };

  it("patches the directly referenced event with its observed etag and verifies read-back", async () => {
    const { adapters, description } = harness();
    await expect(
      refreshGoogleRescheduleLink(
        {
          previousBookingUid: previousUid,
          replacementBookingUid: replacementUid,
        },
        adapters,
      ),
    ).resolves.toMatchObject({ outcome: "updated" });
    expect(adapters.getCalBookingReferences).toHaveBeenCalledWith(
      replacementUid,
    );
    expect(adapters.patchGoogleEventDescription).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "google-event",
      etag: '"etag-1"',
      description: expect.stringContaining(`rescheduleUid=${replacementUid}`),
    });
    expect(description()).not.toContain(`rescheduleUid=${previousUid}`);
    expect(adapters.getGoogleEvent).toHaveBeenCalledTimes(2);
  });

  it("does not write when a replay sees the replacement UID", async () => {
    const { adapters } = harness();
    vi.mocked(adapters.getGoogleEvent).mockResolvedValue({
      id: "google-event",
      etag: '"etag-2"',
      description: oldDescription.replace(
        `rescheduleUid=${previousUid}`,
        `rescheduleUid=${replacementUid}`,
      ),
    });
    await expect(
      refreshGoogleRescheduleLink(
        {
          previousBookingUid: previousUid,
          replacementBookingUid: replacementUid,
        },
        adapters,
      ),
    ).resolves.toMatchObject({ outcome: "already_current" });
    expect(adapters.patchGoogleEventDescription).not.toHaveBeenCalled();
  });

  it("fails closed when the provider read-back does not contain the replacement link", async () => {
    const { adapters } = harness();
    vi.mocked(adapters.getGoogleEvent)
      .mockResolvedValueOnce({
        id: "google-event",
        etag: '"etag-1"',
        description: oldDescription,
      })
      .mockResolvedValueOnce({
        id: "google-event",
        etag: '"etag-2"',
        description: oldDescription,
      });
    await expect(
      refreshGoogleRescheduleLink(
        {
          previousBookingUid: previousUid,
          replacementBookingUid: replacementUid,
        },
        adapters,
      ),
    ).rejects.toThrow("google_reschedule_link_readback_failed");
  });
});
