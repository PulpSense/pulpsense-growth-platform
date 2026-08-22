import { describe, expect, it, vi } from "vitest";

import type { ReconciliationAlert } from "./calendar-reconciliation.js";
import {
  createCalendarReconciliationAdapters,
  formatCalendarReconciliationAlert,
  formatGoogleRescheduleLinkFailureAlert,
  parseAutomationEnvironment,
  rescheduleLinkPayloadSchema,
} from "./google-calendar-reconciliation.js";
import type { SalesAppointmentRecord } from "./sales-appointment-ledger.js";
import { slackLink } from "./slack-notifications.js";

const appointment: SalesAppointmentRecord = {
  id: "8e864291-38b5-4fb6-8f25-664c6db9dc61",
  name: "AI Visibility Audit",
  rootCalBookingUid: "cal-old",
  currentCalBookingUid: "cal-old",
  originatingLeadJourneyId: "f18cd350-48e6-4f8b-8ed0-dfd804cd47c5",
  initialConfirmedAt: "2026-08-20T12:00:00.000Z",
  scheduledStartAt: "2026-09-10T15:00:00.000Z",
  scheduledEndAt: "2026-09-10T15:25:00.000Z",
  status: "SCHEDULED",
  personId: "92a3e458-9ef1-4827-bd89-e04be6deae74",
  opportunityId: "8509935c-e0f5-4508-9527-26cba48cab12",
};

const alert: ReconciliationAlert = {
  salesAppointment: appointment,
  revision: "revision-1",
  classification: "mapping_lookup_failed",
  oldStart: "2026-09-10T15:00:00.000Z",
  intendedStart: "2026-09-10T15:00:00.000Z",
  retryState: "will retry on next poll",
  repairAction: "Verify the Cal booking references and Google OAuth access.",
};

describe("calendar reconciliation Slack alerts", () => {
  it("identifies the lead and failure impact when a reschedule link refresh fails", () => {
    const text = formatGoogleRescheduleLinkFailureAlert(
      {
        submissionId: "f18cd350-48e6-4f8b-8ed0-dfd804cd47c5",
        lifecycleEventId: "event-123",
        firstName: "Ada",
        lastName: "Prospect",
        previousBookingUid: "cal-old",
        replacementBookingUid: "cal-new",
      },
      {
        environment: "preview",
        runUrl: "https://cloud.trigger.dev/run/run-123",
        runId: "run-123",
      },
    );

    expect(text).toContain(
      ":rotating_light: *Couldn't refresh Ada Prospect's calendar reschedule link* · `preview`",
    );
    expect(text).toContain("*Failed step:* Update the Google Calendar event");
    expect(text).toContain("*Impact:* The meeting time remains correct");
    expect(text).toContain("*Retry:* Exhausted");
    expect(text).toContain(
      "<https://cloud.trigger.dev/run/run-123|Open in Trigger>",
    );
    expect(text).toContain("Run run-123");
    expect(text).not.toContain("Classification");
  });

  it("accepts queued reschedule-link payloads created before names were added", () => {
    const payload = rescheduleLinkPayloadSchema.parse({
      submissionId: "f18cd350-48e6-4f8b-8ed0-dfd804cd47c5",
      lifecycleEventId: "event-123",
      previousBookingUid: "cal-old",
      replacementBookingUid: "cal-new",
    });
    const text = formatGoogleRescheduleLinkFailureAlert(payload, {
      environment: "production",
      runUrl: "https://cloud.trigger.dev/run/run-123",
      runId: "run-123",
    });

    expect(text).toContain(
      "*Couldn't refresh the affected person's calendar reschedule link*",
    );
  });

  it("explains a missing mapping without repeating identical timestamps", () => {
    const text = formatCalendarReconciliationAlert(alert, {
      subject: "Ada Prospect",
      timeZone: "America/New_York",
      links: [
        slackLink("Open appointment", "https://twenty.test/appointment"),
        slackLink("Open in Trigger", "https://cloud.trigger.dev/run/run-123"),
      ],
      runId: "run-123",
    });

    expect(text).toContain(
      "*Calendar mapping missing for Ada Prospect's appointment*",
    );
    expect(text).toContain("could not be matched to a Google Calendar event");
    expect(text).toContain("*Retry:* will retry on next poll");
    expect(text).toContain("*Action:* Verify the Cal booking references");
    expect(text).toContain("Open in Trigger");
    expect(text).toContain("Run run-123");
    expect(text).not.toContain("Previous Cal time");
    expect(text).not.toContain("2026-09-10T15:00:00.000Z");
  });

  it("formats recovery as a concise status in the same message family", () => {
    const text = formatCalendarReconciliationAlert(
      { ...alert, classification: "recovered", recovered: true },
      { subject: "Ada Prospect", links: [] },
    );

    expect(text).toContain(
      ":white_check_mark: *Calendar reconciliation recovered for Ada Prospect*",
    );
    expect(text).toContain("mapped and synchronized again");
    expect(text).not.toContain("*Problem:*");
  });

  it("formats automatic Cal retries as warnings with no operator action", () => {
    const text = formatCalendarReconciliationAlert(
      {
        ...alert,
        classification: "cal_reschedule_retry",
        retryState: "attempt 1 failed; retrying",
        repairAction: "No action is required while automatic retries continue.",
      },
      { subject: "Ada Prospect", links: [] },
    );

    expect(text).toContain(":warning: *Calendar reconciliation retrying");
    expect(text).toContain("automatic retries continue");
    expect(text).not.toContain(":rotating_light:");
  });

  it("uses plain language for known and unexpected reconciliation failures", () => {
    const pastTime = formatCalendarReconciliationAlert(
      { ...alert, classification: "past_time_candidate" },
      { subject: "Ada Prospect", links: [] },
    );
    const unexpected = formatCalendarReconciliationAlert(
      { ...alert, classification: "vendor_secret_error_code" },
      { subject: "Ada Prospect", links: [] },
    );
    const missingAppointment = formatCalendarReconciliationAlert(
      { ...alert, classification: "preflight_appointment_missing" },
      { subject: "Ada Prospect", links: [] },
    );
    const terminalAppointment = formatCalendarReconciliationAlert(
      { ...alert, classification: "preflight_terminal" },
      { subject: "Ada Prospect", links: [] },
    );
    const googleAdvanced = formatCalendarReconciliationAlert(
      { ...alert, classification: "preflight_google_advanced" },
      { subject: "Ada Prospect", links: [] },
    );
    const calMissing = formatCalendarReconciliationAlert(
      { ...alert, classification: "preflight_cal_missing" },
      { subject: "Ada Prospect", links: [] },
    );

    expect(pastTime).toContain("intended Google Calendar time is already");
    expect(unexpected).toContain("unexpected provider error occurred");
    expect(unexpected).not.toContain("vendor secret error code");
    expect(missingAppointment).toContain("Sales Appointment disappeared");
    expect(terminalAppointment).toContain("became completed or cancelled");
    expect(googleAdvanced).toContain("Google Calendar event changed again");
    expect(calMissing).toContain("Cal booking disappeared");
  });

  it("requires an explicit supported automation environment", () => {
    expect(parseAutomationEnvironment("preview")).toBe("preview");
    expect(() => parseAutomationEnvironment(undefined)).toThrow(
      "PULPSENSE_AUTOMATION_ENVIRONMENT",
    );
    expect(() => parseAutomationEnvironment("staging")).toThrow(
      "PULPSENSE_AUTOMATION_ENVIRONMENT",
    );
  });

  it("resolves the person from Twenty when the Cal read fails", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("api.cal.com")) {
        return new Response("unavailable", { status: 503 });
      }
      if (url.includes("/rest/people/person-1")) {
        return Response.json({
          person: { name: { firstName: "Ada", lastName: "Prospect" } },
        });
      }
      if (url === "https://slack.com/api/chat.postMessage") {
        return Response.json({ ok: true, ts: "100.200" });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const adapters = createCalendarReconciliationAdapters(
      {
        TWENTY_API_ORIGIN: "https://twenty.test",
        TWENTY_API_KEY: "twenty",
        CAL_API_KEY: "cal",
        SLACK_BOT_TOKEN: "slack",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "production",
      },
      fetcher,
      {
        id: "run-123",
        url: "https://cloud.trigger.dev/run/run-123",
      },
    );

    await adapters.sendAlert({
      ...alert,
      classification: "cal_preflight_read_failed",
      salesAppointment: { ...appointment, personId: "person-1" },
    });

    const slackRequest = fetcher.mock.calls.find(
      ([input]) => String(input) === "https://slack.com/api/chat.postMessage",
    );
    const body = JSON.parse(String(slackRequest?.[1]?.body));
    expect(body.text).toContain("for Ada Prospect");
    expect(body.text).toContain("Open in Trigger");
    expect(body.text).toContain("Run run-123");
    expect(body.text).not.toContain(appointment.name);
  });

  it("identifies the Person record if both provider name lookups fail", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "https://slack.com/api/chat.postMessage") {
        return Response.json({ ok: true, ts: "100.200" });
      }
      return new Response("unavailable", { status: 503 });
    });
    const adapters = createCalendarReconciliationAdapters(
      {
        TWENTY_API_ORIGIN: "https://twenty.test",
        TWENTY_API_KEY: "twenty",
        CAL_API_KEY: "cal",
        SLACK_BOT_TOKEN: "slack",
        PULPSENSE_AUTOMATION_ENVIRONMENT: "production",
      },
      fetcher,
    );

    await adapters.sendAlert(alert);

    const slackRequest = fetcher.mock.calls.find(
      ([input]) => String(input) === "https://slack.com/api/chat.postMessage",
    );
    const body = JSON.parse(String(slackRequest?.[1]?.body));
    expect(body.text).toContain("for the affected person");
    expect(body.text).toContain(`Person ${appointment.personId}`);
    expect(body.text).not.toContain(`*Person ${appointment.personId}`);
    expect(body.text).toContain("Open Person");
  });
});
