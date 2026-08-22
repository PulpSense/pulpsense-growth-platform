type SlackValue = { mrkdwn: string };

type SlackNotificationTone = "failure" | "warning" | "success" | "info";

type SlackNotification = {
  tone: SlackNotificationTone;
  title: string;
  environment?: string;
  fields?: Array<{ label: string; value: SlackValue }>;
  links?: SlackValue[];
  note?: SlackValue;
};

const toneEmoji: Record<SlackNotificationTone, string> = {
  failure: ":rotating_light:",
  warning: ":warning:",
  success: ":white_check_mark:",
  info: ":information_source:",
};

export const escapeSlackText = (value: string) =>
  value
    .replace(/\s+/gu, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const slackText = (value: string): SlackValue => ({
  mrkdwn: escapeSlackText(value),
});

export const slackCode = (value: string): SlackValue => ({
  mrkdwn: `\`${escapeSlackText(value).replaceAll("`", "'")}\``,
});

export const slackLink = (label: string, url: string): SlackValue => ({
  mrkdwn: `<${url.replaceAll("<", "%3C").replaceAll(">", "%3E").replaceAll("|", "%7C")}|${escapeSlackText(label).replaceAll("|", "&#124;")}>`,
});

export const slackDate = (
  value: string,
  options?: { timeZone?: string },
): SlackValue => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return slackText("Invalid appointment time");
  }
  let fallback: string;
  try {
    fallback = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
    }).format(date);
  } catch {
    fallback = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }
  return {
    mrkdwn: `<!date^${Math.floor(date.getTime() / 1_000)}^{date_short_pretty} at {time}|${escapeSlackText(fallback)}>`,
  };
};

export const slackIdentifierFooter = (
  identifiers: Array<[label: string, value: string | undefined]>,
) =>
  slackCode(
    identifiers
      .filter((identifier): identifier is [string, string] =>
        Boolean(identifier[1]),
      )
      .map(([label, value]) => `${label} ${value}`)
      .join(" · "),
  );

export const formatSlackNotification = (input: SlackNotification) => {
  const heading = [
    `${toneEmoji[input.tone]} *${escapeSlackText(input.title)}*`,
    ...(input.environment && input.environment !== "production"
      ? [slackCode(input.environment).mrkdwn]
      : []),
  ].join(" · ");
  const details = (input.fields ?? []).map(
    ({ label, value }) => `*${escapeSlackText(label)}:* ${value.mrkdwn}`,
  );
  const actions = (input.links ?? []).map(({ mrkdwn }) => mrkdwn).join(" · ");

  return [
    heading,
    ...(details.length ? ["", ...details] : []),
    ...(actions ? ["", actions] : []),
    ...(input.note ? ["", input.note.mrkdwn] : []),
  ].join("\n");
};

export const slackDeliveryOptions = {
  unfurl_links: false,
  unfurl_media: false,
} as const;

export type { SlackNotification, SlackNotificationTone, SlackValue };
