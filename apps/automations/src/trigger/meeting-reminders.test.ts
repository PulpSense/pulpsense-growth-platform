import type { BookingCompletedEvent } from "@pulpsense/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  deliverMeetingReminder,
  formatMeetingReminderFailureAlert,
  meetingReminderPayloadSchema,
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
  lastName: bookingEvent.payload.lastName,
  phone: bookingEvent.payload.phone,
  channel: "gmail",
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

const salesAppointmentGuard = {
  salesAppointmentId: "22222222-2222-4222-8222-222222222222",
  automationGeneration: 1,
};

describe("meeting reminder Slack alerts", () => {
  it("names the lead, channel, call time, impact, and investigation links", () => {
    const text = formatMeetingReminderFailureAlert(
      { ...payload, ...salesAppointmentGuard },
      {
        ...enabledEnvironment,
        TWENTY_API_ORIGIN: "https://pulpsense.twenty.com/",
      },
      "https://cloud.trigger.dev/runs/run-1",
      "run-1",
    );

    expect(text).toContain("*Maya Chen's 2h email reminder was not sent*");
    expect(text).toContain("*Channel:* Email");
    expect(text).toContain("*Call:* <!date^");
    expect(text).toContain("This reminder was not delivered");
    expect(text).toContain("verify the appointment status");
    expect(text).not.toContain("appointment is still active");
    expect(text).toContain("Open appointment");
    expect(text).toContain("Open in Trigger");
    expect(text).toContain("Journey b0a10d9a");
    expect(text).toContain("Run run-1");
  });
});

const guardedPayload = { ...payload, ...salesAppointmentGuard };

const currentSalesAppointmentResponse = () =>
  Response.json({
    data: {
      salesAppointment: {
        automationGeneration: 1,
        currentCalBookingUid: payload.bookingUid,
        scheduledStartAt: payload.expectedStartTime,
        synchronizationStatus: "SYNCHRONIZED",
      },
    },
  });

describe("meeting reminder scheduling", () => {
  it("embeds the canonical Sales Appointment generation in new work", async () => {
    const trigger = vi.fn().mockResolvedValue({ id: "run" });
    await scheduleMeetingReminders(
      bookingEvent,
      { channel: "gmail" },
      trigger,
      new Date("2026-08-12T13:30:00.000Z"),
      async (key) => key,
      salesAppointmentGuard,
    );
    expect(trigger).toHaveBeenCalledWith(
      expect.objectContaining(salesAppointmentGuard),
      expect.any(Object),
    );
  });

  it("schedules only future thresholds with stable idempotency keys", async () => {
    const trigger = vi.fn().mockResolvedValue({ id: "run" });
    const createKey = vi.fn(async (key: string) => `key:${key}`);

    await expect(
      scheduleMeetingReminders(
        bookingEvent,
        { channel: "gmail" },
        trigger,
        new Date("2026-08-12T13:30:00.000Z"),
        createKey,
      ),
    ).resolves.toEqual({ scheduled: ["gmail:15m"] });
    await expect(
      scheduleMeetingReminders(
        bookingEvent,
        {
          channel: "sms",
          personId: "11111111-1111-4111-8111-111111111111",
        },
        trigger,
        new Date("2026-08-12T13:30:00.000Z"),
        createKey,
      ),
    ).resolves.toEqual({ scheduled: ["sms:5m"] });
    expect(trigger).toHaveBeenCalledTimes(2);
    expect(trigger.mock.calls[0]?.[0]).toMatchObject({
      firstName: "Maya",
      channel: "gmail",
      threshold: "15m",
      bookingUid: "cal_uid_123",
      expiresAt: "2026-08-12T14:00:00.000Z",
    });
    expect(trigger.mock.calls[0]?.[0]).not.toHaveProperty("phone");
    expect(trigger.mock.calls[0]?.[0]).not.toHaveProperty("personId");
    expect(trigger.mock.calls[0]?.[1]).toMatchObject({
      delay: new Date("2026-08-12T13:45:00.000Z"),
      idempotencyKey:
        "key:meeting-reminder:cal_uid_123:2026-08-12T14:00:00.000Z:15m",
    });
    expect(trigger.mock.calls[1]?.[0]).toMatchObject({
      channel: "sms",
      personId: "11111111-1111-4111-8111-111111111111",
      threshold: "5m",
      expiresAt: "2026-08-12T14:00:00.000Z",
    });
    expect(trigger.mock.calls[1]?.[1]).toMatchObject({
      delay: new Date("2026-08-12T13:55:00.000Z"),
      idempotencyKey:
        "key:meeting-reminder:cal_uid_123:2026-08-12T14:00:00.000Z:5m",
    });
  });
});

describe("meeting reminder delivery", () => {
  it("fails closed when Twenty is configured but a queued run lacks a generation", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      deliverMeetingReminder(
        payload,
        {
          ...enabledEnvironment,
          TWENTY_API_ORIGIN: "https://twenty.example.com",
          TWENTY_API_KEY: "twenty",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({ skipped: "sales_appointment_guard_failed" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts legacy queued Gmail payloads without a channel or phone", () => {
    const { channel, phone } = meetingReminderPayloadSchema.parse({
      ...payload,
      channel: undefined,
      phone: undefined,
    });
    expect(channel).toBe("gmail");
    expect(phone).toBeUndefined();
  });

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
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(currentSalesAppointmentResponse())
      .mockResolvedValueOnce(
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
      deliverMeetingReminder(
        guardedPayload,
        {
          ...enabledEnvironment,
          TWENTY_API_ORIGIN: "https://twenty.example.com",
          TWENTY_API_KEY: "twenty",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({ skipped: "inactive_or_superseded" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("refreshes Gmail authorization and sends the configured template", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(currentSalesAppointmentResponse())
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
      deliverMeetingReminder(
        guardedPayload,
        {
          ...enabledEnvironment,
          TWENTY_API_ORIGIN: "https://twenty.example.com",
          TWENTY_API_KEY: "twenty",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({
      sent: true,
      channel: "gmail",
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    const gmailRequest = fetcher.mock.calls[3];
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

  it("sends a Person-bound SMS through the Twenty communications action", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(currentSalesAppointmentResponse())
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
      .mockResolvedValueOnce(
        Response.json({
          accepted: true,
          interactionId: "interaction-1",
          messageId: "sms-id",
          status: "accepted",
        }),
      );

    const smsPayload = {
      ...payload,
      ...salesAppointmentGuard,
      personId: "11111111-1111-4111-8111-111111111111",
      channel: "sms" as const,
      threshold: "90m" as const,
      expiresAt: "2026-08-12T13:45:00.000Z",
    };

    await expect(
      deliverMeetingReminder(
        smsPayload,
        {
          ...enabledEnvironment,
          GMAIL_REMINDERS_ENABLED: "false",
          TELNYX_SMS_REMINDERS_ENABLED: "true",
          TWENTY_API_KEY: "twenty-test",
          TWENTY_API_ORIGIN: "https://twenty.test/",
          TELNYX_SMS_REMINDER_90M_BODY:
            "PulpSense reminder: Hi {{first_name}}, your call is at {{local_time}}. {{meeting_url}}",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({
      sent: true,
      channel: "sms",
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2]?.[0]).toBe("https://twenty.test/s/telnyx/sms");
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer twenty-test",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({
      clientRequestId:
        "appointment-reminder:cal_uid_123:2026-08-12T14:00:00.000Z:90m",
      personId: "11111111-1111-4111-8111-111111111111",
      text: "PulpSense reminder: Hi Maya, your call is at 10:00am. https://meet.example.com/cal_uid_123",
    });
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes("api.telnyx.com"),
      ),
    ).toBe(false);
  });

  it("fails closed for a legacy queued SMS without a Twenty Person", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
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
    );

    await expect(
      deliverMeetingReminder(
        { ...payload, channel: "sms", threshold: "90m" },
        {
          ...enabledEnvironment,
          GMAIL_REMINDERS_ENABLED: "false",
          TELNYX_SMS_REMINDERS_ENABLED: "true",
          TWENTY_API_KEY: "twenty-test",
          TWENTY_API_ORIGIN: "https://twenty.test",
          TELNYX_SMS_REMINDER_90M_BODY: "Join: {{meeting_url}}",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).rejects.toThrow("Twenty Person ID is required for an SMS reminder");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("treats a Twenty application-level refusal as a failed reminder", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(currentSalesAppointmentResponse())
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
      .mockResolvedValueOnce(
        Response.json({ accepted: false, error: "SMS consent is required" }),
      );

    await expect(
      deliverMeetingReminder(
        {
          ...payload,
          ...salesAppointmentGuard,
          personId: "11111111-1111-4111-8111-111111111111",
          channel: "sms",
          threshold: "90m",
        },
        {
          ...enabledEnvironment,
          GMAIL_REMINDERS_ENABLED: "false",
          TELNYX_SMS_REMINDERS_ENABLED: "true",
          TWENTY_API_KEY: "twenty-test",
          TWENTY_API_ORIGIN: "https://twenty.test",
          TELNYX_SMS_REMINDER_90M_BODY: "Join: {{meeting_url}}",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).rejects.toThrow("Twenty SMS reminder refused: SMS consent is required");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("fails closed before sending SMS when Cal omits the join link", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(currentSalesAppointmentResponse())
      .mockResolvedValueOnce(
        Response.json({
          status: "success",
          data: {
            uid: payload.bookingUid,
            title: "AI SEO Audit",
            status: "accepted",
            start: payload.expectedStartTime,
            end: "2026-08-12T14:30:00.000Z",
            attendees: [
              { email: "maya@brand.com", timeZone: "America/New_York" },
            ],
          },
        }),
      );

    await expect(
      deliverMeetingReminder(
        {
          ...payload,
          ...salesAppointmentGuard,
          personId: "11111111-1111-4111-8111-111111111111",
          channel: "sms",
          threshold: "90m",
        },
        {
          ...enabledEnvironment,
          GMAIL_REMINDERS_ENABLED: "false",
          TELNYX_SMS_REMINDERS_ENABLED: "true",
          TWENTY_API_KEY: "twenty-test",
          TWENTY_API_ORIGIN: "https://twenty.test",
          TELNYX_SMS_REMINDER_90M_BODY: "Join: {{meeting_url}}",
        },
        {
          fetch: fetcher,
          now: () => new Date("2026-08-12T13:00:00.000Z"),
        },
      ),
    ).rejects.toThrow("Cal meeting URL is not configured");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
