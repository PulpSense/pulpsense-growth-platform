import { describe, expect, it, vi } from "vitest";

import {
  ERROR_SLACK_CHANNEL_ID,
  sendReliabilityAlert,
} from "./reliability-alerts.js";

describe("Slack reliability alert delivery", () => {
  it("disables previews and preserves recovery threading", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true, ts: "100.300" }));

    await expect(
      sendReliabilityAlert(
        { token: "xoxb-test", text: "alert", threadTs: "100.200" },
        fetcher,
      ),
    ).resolves.toEqual({ threadTs: "100.200" });

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      channel: ERROR_SLACK_CHANNEL_ID,
      text: "alert",
      unfurl_links: false,
      unfurl_media: false,
      thread_ts: "100.200",
    });
  });
});
