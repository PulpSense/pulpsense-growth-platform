import { describe, expect, it } from "vitest";

import {
  formatSlackNotification,
  slackCode,
  slackDate,
  slackDeliveryOptions,
  slackIdentifierFooter,
  slackLink,
  slackText,
} from "./slack-notifications.js";

describe("Slack notification standard", () => {
  it("formats a scannable alert with Slack mrkdwn and separated actions", () => {
    expect(
      formatSlackNotification({
        tone: "failure",
        title: "Pre-call sequence failed",
        environment: "production",
        fields: [
          { label: "Sales appointment", value: slackCode("appointment-1") },
          { label: "Booking", value: slackCode("booking-1") },
        ],
        links: [
          slackLink("Open in Trigger", "https://cloud.trigger.dev/runs/run-1"),
        ],
      }),
    ).toBe(
      [
        ":rotating_light: *Pre-call sequence failed*",
        "",
        "*Sales appointment:* `appointment-1`",
        "*Booking:* `booking-1`",
        "",
        "<https://cloud.trigger.dev/runs/run-1|Open in Trigger>",
      ].join("\n"),
    );
  });

  it("keeps non-production visible and formats dates and identifier footers", () => {
    expect(
      formatSlackNotification({
        tone: "warning",
        title: "Needs attention",
        environment: "preview",
        fields: [
          {
            label: "Call",
            value: slackDate("2026-08-24T18:00:00.000Z", {
              timeZone: "America/New_York",
            }),
          },
        ],
        note: slackIdentifierFooter([
          ["Journey", "journey-1"],
          ["Booking", undefined],
        ]),
      }),
    ).toContain(
      ":warning: *Needs attention* · `preview`\n\n*Call:* <!date^1787594400^{date_short_pretty} at {time}|Aug 24, 2026, 2:00 PM>\n\n`Journey journey-1`",
    );
  });

  it("escapes untrusted text and disables link previews", () => {
    const text = formatSlackNotification({
      tone: "info",
      title: "New <lead>",
      fields: [{ label: "Company", value: slackText(" A & B\n<script> ") }],
    });

    expect(text).toContain("New &lt;lead&gt;");
    expect(text).toContain("A &amp; B &lt;script&gt;");
    expect(text).not.toContain("\n<script>");
    expect(slackDeliveryOptions).toEqual({
      unfurl_links: false,
      unfurl_media: false,
    });
  });

  it("does not expose malformed date input", () => {
    expect(slackDate("2026-raw-provider-garbage").mrkdwn).toBe(
      "Invalid appointment time",
    );
  });
});
