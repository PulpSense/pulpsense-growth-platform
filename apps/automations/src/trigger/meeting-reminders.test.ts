import type { BookingCompletedEvent } from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  deliverMeetingReminder,
  scheduleMeetingReminders,
  type MeetingReminderPayload,
  type ReminderEnvironment,
} from "./meeting-reminders.js";

const bookingEvent: BookingCompletedEvent = {
  schemaVersion: 1,
  eventType: "booking_completed",
  funnelId: "ai-seo",
  submissionId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  eventId: "booking_completed:cal_uid_123",
  occurredAt: "2026-08-10T10:00:00.000Z",
  payload: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@brand.com",
    phone: "+1 555 123 4567",
    emailVerification: { status: "verified", result: "business" },
    booking: {
      uid: "cal_uid_123",
      title: "AI SEO Audit",
      startTime: "2026-08-12T14:00:00.000Z",
      endTime: "2026-08-12T14:30:00.000Z",
      attendeeTimeZone: "America/New_York",
      meetingUrl: "https://meet.example.com/cal_uid_123",
    },
  },
  qualificationStatus: "qualified",
  attribution: { firstTouch: {}, lastTouch: {} },
  requestContext: {
    clientIp: "203.0.113.9",
    userAgent: "Browser",
    sourceUrl: "https://example.com/ai-seo/",
  },
  environment: "preview",
};

const payload: MeetingReminderPayload = {
  submissionId: bookingEvent.submissionId,
  firstName: bookingEvent.payload.firstName,
  bookingUid: bookingEvent.payload.booking.uid,
  expectedStartTime: bookingEvent.payload.booking.startTime,
  threshold: "2h",
  expiresAt: "2026-08-12T13:45:00.000Z",
  environment: "preview",
};

const enabledEnvironment: ReminderEnvironment = {
  PULPSENSE_AUTOMATION_ENVIRONMENT: "preview",
  CAL_API_KEY: "cal-test",
  GMAIL_REMINDERS_ENABLED: "true",
  GMAIL_CLIENT_ID: "gmail-client",
  GMAIL_CLIENT_SECRET: "gmail-secret",
  GMAIL_REFRESH_TOKEN: "gmail-refresh",
  GMAIL_SENDER_EMAIL: "santi@pulpsense.com",
  GMAIL_REMINDER_2H_SUBJECT: "Quick reminder",
  GMAIL_REMINDER_2H_BODY:
    "Hey {{first_name}} - see you {{daypart}} at {{local_time}}.\\n\\n{{meeting_url}}",
};

describe("meeting reminder scheduling", () => {
  it("schedules only future thresholds with stable idempotency keys", async () => {
    const trigger = vi.fn().mockResolvedValue({ id: "run" });
    const createKey = vi.fn(async (key: string) => `key:${key}`);

    await expect(
      scheduleMeetingReminders(
        bookingEvent,
        trigger,
        new Date("2026-08-12T13:30:00.000Z"),
        createKey,
      ),
    ).resolves.toEqual({ scheduled: ["15m"] });
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0]?.[0]).toMatchObject({
      firstName: "Maya",
      threshold: "15m",
      bookingUid: "cal_uid_123",
      expiresAt: "2026-08-12T14:00:00.000Z",
    });
    expect(trigger.mock.calls[0]?.[1]).toMatchObject({
      delay: new Date("2026-08-12T13:45:00.000Z"),
      idempotencyKey:
        "key:meeting-reminder:cal_uid_123:2026-08-12T14:00:00.000Z:15m",
    });
  });
});

describe("meeting reminder delivery", () => {
  it("fails closed for an expired reminder without calling a provider", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      deliverMeetingReminder(payload, enabledEnvironment, {
        fetch: fetcher,
        now: () => new Date(payload.expiresAt),
      }),
    ).resolves.toEqual({ skipped: "expired" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("skips a cancelled or superseded booking before Gmail delivery", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        status: "success",
        data: {
          uid: payload.bookingUid,
          title: "AI SEO Audit",
          status: "cancelled",
          start: payload.expectedStartTime,
          end: "2026-08-12T14:30:00.000Z",
          attendees: [
            { email: "maya@brand.com", timeZone: "America/New_York" },
          ],
        },
      }),
    );
    await expect(
      deliverMeetingReminder(payload, enabledEnvironment, {
        fetch: fetcher,
        now: () => new Date("2026-08-12T13:00:00.000Z"),
      }),
    ).resolves.toEqual({ skipped: "inactive_or_superseded" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes Gmail authorization and sends the configured template", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          status: "success",
          data: {
            uid: payload.bookingUid,
            title: "AI SEO Audit",
            status: "accepted",
            start: payload.expectedStartTime,
            end: "2026-08-12T14:30:00.000Z",
            meetingUrl: "https://meet.example.com/cal_uid_123",
            attendees: [
              { email: "maya@brand.com", timeZone: "America/New_York" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ access_token: "access-token" }))
      .mockResolvedValueOnce(Response.json({ id: "gmail-message-id" }));

    await expect(
      deliverMeetingReminder(payload, enabledEnvironment, {
        fetch: fetcher,
        now: () => new Date("2026-08-12T13:00:00.000Z"),
      }),
    ).resolves.toEqual({ sent: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    const gmailRequest = fetcher.mock.calls[2];
    expect(gmailRequest?.[0]).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    const gmailBody = JSON.parse(String(gmailRequest?.[1]?.body));
    const padded = String(gmailBody.raw)
      .replaceAll("-", "+")
      .replaceAll("_", "/");
    const raw = Buffer.from(padded, "base64").toString("utf8");
    expect(raw).toContain("From: santi@pulpsense.com");
    expect(raw).toContain("To: maya@brand.com");
    expect(raw).toContain("Subject: =?UTF-8?B?UXVpY2sgcmVtaW5kZXI=?=");
    expect(raw).toContain("Message-ID: <pulpsense-cal_uid_123-");
    const encodedBody = raw.split("\r\n\r\n").at(-1);
    expect(Buffer.from(String(encodedBody), "base64").toString("utf8")).toBe(
      "Hey Maya - see you morning at 10:00am.\n\nhttps://meet.example.com/cal_uid_123",
    );
  });
});
