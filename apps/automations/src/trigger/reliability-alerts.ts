import { slackDeliveryOptions } from "./slack-notifications.js";

export const ERROR_SLACK_CHANNEL_ID = "C09FTA0TEEN";

export const sendReliabilityAlert = async (
  input: { token: string; text: string; threadTs?: string },
  fetcher: typeof fetch,
) => {
  const response = await fetcher("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: ERROR_SLACK_CHANNEL_ID,
      text: input.text,
      ...slackDeliveryOptions,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    }),
  });
  const result = (await response.json()) as { ok?: boolean; ts?: string };
  if (!response.ok || result.ok !== true) {
    throw new Error("Slack reliability alert was rejected");
  }
  return { threadTs: input.threadTs ?? result.ts };
};
