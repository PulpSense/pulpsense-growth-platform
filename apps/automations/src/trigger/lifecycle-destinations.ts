import type {
  ApplicationSubmittedEvent,
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingRescheduledEvent,
  ContactSubmittedEvent,
} from "@pulpsense/contracts";

import {
  formatSlackNotification,
  slackDate,
  slackDeliveryOptions,
  slackIdentifierFooter,
  slackLink,
  slackText,
} from "./slack-notifications.js";

type Fetcher = typeof fetch;

type SlackConfig = {
  botToken: string;
  channelId: string;
  internalBookingBaseUrl?: string;
};

type SlackMessage = {
  ts?: string;
  thread_ts?: string;
  metadata?: {
    event_type?: string;
    event_payload?: Record<string, unknown>;
  };
};

type SlackResponse = {
  ok?: boolean;
  error?: string;
  ts?: string;
  messages?: SlackMessage[];
  response_metadata?: { next_cursor?: string };
};

const slackApi = async (
  config: SlackConfig,
  fetcher: Fetcher,
  method: string,
  body: Record<string, unknown>,
) => {
  const response = await fetcher(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as SlackResponse;
  if (!response.ok || !result.ok) {
    throw new Error(
      `Slack ${method} failed (${result.error ?? response.status})`,
    );
  }
  return result;
};

type LeadNotificationEvent = Pick<
  ContactSubmittedEvent,
  "payload" | "attribution" | "funnelId"
>;

const attributionLine = (event: LeadNotificationEvent) => {
  const touch = event.attribution.lastTouch;
  return [touch.utmSource, touch.utmMedium, touch.utmCampaign]
    .filter(Boolean)
    .map((value) => value!)
    .join(" / ");
};

const companyDomainFromEmail = (email: string) =>
  email.trim().toLowerCase().split("@").at(-1) ?? "unknown";

const leadName = (event: {
  payload: { firstName: string; lastName: string };
}) =>
  [event.payload.firstName, event.payload.lastName].filter(Boolean).join(" ");

const leadFields = (event: LeadNotificationEvent) => {
  const attribution = attributionLine(event);
  return [
    { label: "Email", value: slackText(event.payload.email) },
    { label: "Phone", value: slackText(event.payload.phone) },
    {
      label: "Company",
      value: slackText(companyDomainFromEmail(event.payload.email)),
    },
    { label: "Funnel", value: slackText(event.funnelId) },
    {
      label: "Source",
      value: slackText(attribution || "Direct / unknown"),
    },
  ];
};

const rootMetadata = (
  event: ContactSubmittedEvent,
  bookingEventId?: string,
) => ({
  event_type: "pulpsense_lead_journey",
  event_payload: {
    lead_journey_id: event.submissionId,
    contact_event_id: event.eventId,
    ...(bookingEventId ? { booking_event_id: bookingEventId } : {}),
  },
});

export const findSlackJourneyRoot = async (
  submissionId: string,
  config: SlackConfig,
  fetcher: Fetcher,
) => {
  let cursor: string | undefined;
  do {
    const result = await slackApi(config, fetcher, "conversations.history", {
      channel: config.channelId,
      limit: 200,
      include_all_metadata: true,
      ...(cursor ? { cursor } : {}),
    });
    const root = result.messages?.find(
      (message) =>
        !message.thread_ts &&
        message.metadata?.event_type === "pulpsense_lead_journey" &&
        message.metadata.event_payload?.lead_journey_id === submissionId &&
        message.ts,
    );
    if (root?.ts) return root.ts;
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return undefined;
};

export const postSlackLead = async (
  event: ContactSubmittedEvent,
  config: SlackConfig,
  fetcher: Fetcher,
) => {
  const existing = await findSlackJourneyRoot(
    event.submissionId,
    config,
    fetcher,
  );
  if (existing) return { threadTs: existing, created: false as const };

  const result = await slackApi(config, fetcher, "chat.postMessage", {
    channel: config.channelId,
    text: formatSlackNotification({
      tone: "info",
      title: `New funnel lead: ${leadName(event)}`,
      environment: event.environment,
      fields: leadFields(event),
      note: slackIdentifierFooter([["Journey", event.submissionId]]),
    }),
    ...slackDeliveryOptions,
    metadata: rootMetadata(event),
  });
  if (!result.ts) throw new Error("Slack lead message omitted timestamp");
  return { threadTs: result.ts, created: true as const };
};

const bookingNotification = (
  event: BookingCompletedEvent,
  internalBookingBaseUrl?: string,
  options?: { includeLeadDetails?: boolean },
) => {
  const booking = event.payload.booking;
  const durationMinutes = Math.round(
    (new Date(booking.endTime).getTime() -
      new Date(booking.startTime).getTime()) /
      60_000,
  );
  const internalUrl =
    booking.internalBookingUrl ??
    (internalBookingBaseUrl
      ? `${internalBookingBaseUrl.replace(/\/+$/u, "")}/${encodeURIComponent(booking.uid)}`
      : undefined);
  return formatSlackNotification({
    tone: "success",
    title: `${leadName(event)} booked a sales call`,
    environment: event.environment,
    fields: [
      ...(options?.includeLeadDetails ? leadFields(event) : []),
      {
        label: "When",
        value: slackDate(booking.startTime, {
          timeZone: booking.attendeeTimeZone,
        }),
      },
      { label: "Meeting", value: slackText(booking.title) },
      { label: "Duration", value: slackText(`${durationMinutes} minutes`) },
      { label: "Timezone", value: slackText(booking.attendeeTimeZone) },
    ],
    links: internalUrl ? [slackLink("Open booking", internalUrl)] : undefined,
    note: slackIdentifierFooter([
      ["Journey", event.submissionId],
      ["Booking", booking.uid],
    ]),
  });
};

const hasSlackBookingReply = async (
  threadTs: string,
  eventId: string,
  config: SlackConfig,
  fetcher: Fetcher,
) => {
  let cursor: string | undefined;
  do {
    const result = await slackApi(config, fetcher, "conversations.replies", {
      channel: config.channelId,
      ts: threadTs,
      limit: 200,
      include_all_metadata: true,
      ...(cursor ? { cursor } : {}),
    });
    if (
      result.messages?.some(
        (message) =>
          (message.metadata?.event_type === "pulpsense_booking" &&
            message.metadata.event_payload?.event_id === eventId) ||
          (message.metadata?.event_type === "pulpsense_lead_journey" &&
            message.metadata.event_payload?.booking_event_id === eventId),
      )
    ) {
      return true;
    }
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return false;
};

export const postSlackBooking = async (
  event: BookingCompletedEvent,
  config: SlackConfig,
  fetcher: Fetcher,
) => {
  const contactEvent: ContactSubmittedEvent = {
    ...event,
    eventType: "contact_submitted",
    eventId: `contact_submitted:${event.submissionId}`,
  };
  const root = await findSlackJourneyRoot(event.submissionId, config, fetcher);
  const metadata = {
    event_type: "pulpsense_booking",
    event_payload: {
      lead_journey_id: event.submissionId,
      event_id: event.eventId,
      booking_uid: event.payload.booking.uid,
    },
  };
  if (!root) {
    const result = await slackApi(config, fetcher, "chat.postMessage", {
      channel: config.channelId,
      text: bookingNotification(event, config.internalBookingBaseUrl, {
        includeLeadDetails: true,
      }),
      ...slackDeliveryOptions,
      metadata: rootMetadata(contactEvent, event.eventId),
    });
    if (!result.ts) throw new Error("Slack fallback root omitted timestamp");
    return { threadTs: result.ts, fallbackRoot: true as const };
  }
  try {
    if (await hasSlackBookingReply(root, event.eventId, config, fetcher)) {
      return { threadTs: root, fallbackRoot: false as const, duplicate: true };
    }
  } catch (error) {
    // A malformed/stale Slack thread timestamp must not suppress a valid
    // booking notification. Posting the reply is safer than dropping the
    // customer-facing event; Slack remains an at-least-once destination.
    if (
      !(error instanceof Error) ||
      !/invalid_arguments|thread_not_found/u.test(error.message)
    ) {
      throw error;
    }
  }
  await slackApi(config, fetcher, "chat.postMessage", {
    channel: config.channelId,
    thread_ts: root,
    text: bookingNotification(event, config.internalBookingBaseUrl),
    ...slackDeliveryOptions,
    metadata,
  });
  return { threadTs: root, fallbackRoot: false as const, duplicate: false };
};

type BrevoLifecycleEvent =
  | ContactSubmittedEvent
  | ApplicationSubmittedEvent
  | BookingCompletedEvent
  | BookingRescheduledEvent
  | BookingCancelledEvent;

type BrevoConfig = {
  apiKey: string;
  adsListId: number;
  newsletterListId?: number;
  leadMagnetsListId?: number;
};

type BrevoContact = { attributes?: Record<string, unknown> };

const brevoHeaders = (apiKey: string) => ({
  "api-key": apiKey,
  Accept: "application/json",
  "Content-Type": "application/json",
});

const normalizeSms = (phone: string) => {
  const digits = phone.replace(/\D/gu, "");
  return digits ? `+${digits}` : undefined;
};

const ownedAttribution = (event: BrevoLifecycleEvent) => ({
  ...(event.attribution.lastTouch.utmSource
    ? { PULPSENSE_UTM_SOURCE: event.attribution.lastTouch.utmSource }
    : {}),
  ...(event.attribution.lastTouch.utmMedium
    ? { PULPSENSE_UTM_MEDIUM: event.attribution.lastTouch.utmMedium }
    : {}),
  ...(event.attribution.lastTouch.utmCampaign
    ? { PULPSENSE_UTM_CAMPAIGN: event.attribution.lastTouch.utmCampaign }
    : {}),
});

const lifecycleProjection = (event: BrevoLifecycleEvent) => {
  if (event.eventType === "contact_submitted") {
    return {
      state: "captured",
      eventName: "pulpsense_contact_submitted",
      attributes: {},
      eventProperties: { capture_source: event.funnelId },
    } as const;
  }
  if (event.eventType === "application_submitted") {
    if (event.qualificationStatus !== "qualified") return undefined;
    if (!event.bookingLink) return undefined;
    return {
      state: "qualified_unbooked",
      eventName: "pulpsense_qualified_unbooked",
      attributes: {
        PULPSENSE_COMPANY_DOMAIN: event.companyDomain,
        PULPSENSE_BOOKING_LINK: event.bookingLink,
      },
      eventProperties: { qualification_status: "qualified" },
    } as const;
  }
  const booking = event.payload.booking;
  const commonBookingAttributes = {
    PULPSENSE_CAL_UID: booking.uid,
    PULPSENSE_MEETING_TITLE: booking.title,
    PULPSENSE_APPOINTMENT_START: booking.startTime,
    PULPSENSE_APPOINTMENT_END: booking.endTime,
    PULPSENSE_ATTENDEE_TIMEZONE: booking.attendeeTimeZone,
    ...(booking.meetingUrl
      ? { PULPSENSE_MEETING_JOIN_URL: booking.meetingUrl }
      : {}),
  };
  if (event.eventType === "booking_completed") {
    return {
      state: "booked",
      eventName: "pulpsense_booking_created",
      attributes: {
        ...commonBookingAttributes,
        PULPSENSE_PRECALL_STATUS: "active",
        PULPSENSE_PRECALL_SEQUENCE_ID: `precall:${booking.uid}:${booking.startTime}:precall-v1`,
        PULPSENSE_PRECALL_SENT_MASK: 0,
        PULPSENSE_PRECALL_COPY_VERSION: "precall-v1",
      },
      eventProperties: { booking_uid: booking.uid },
    } as const;
  }
  if (event.eventType === "booking_rescheduled") {
    return {
      state: "booked",
      eventName: "pulpsense_booking_rescheduled",
      attributes: {
        ...commonBookingAttributes,
        PULPSENSE_PRECALL_STATUS: "active",
        PULPSENSE_PRECALL_SEQUENCE_ID: `precall:${booking.uid}:${booking.startTime}:precall-v1`,
        PULPSENSE_PRECALL_COPY_VERSION: "precall-v1",
      },
      eventProperties: {
        booking_uid: booking.uid,
        previous_booking_uid: event.payload.booking.previousUid,
      },
    } as const;
  }
  return {
    state: "cancelled",
    eventName: "pulpsense_booking_cancelled",
    attributes: {
      ...commonBookingAttributes,
      PULPSENSE_PRECALL_STATUS: "cancelled",
    },
    eventProperties: { booking_uid: booking.uid },
  } as const;
};

const stateRank = (state: unknown) => {
  if (state === "cancelled") return 3;
  if (state === "booked") return 2;
  if (state === "qualified_unbooked") return 1;
  return 0;
};

const readBrevoContact = async (
  email: string,
  config: BrevoConfig,
  fetcher: Fetcher,
) => {
  const response = await fetcher(
    `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?identifierType=email_id`,
    { headers: brevoHeaders(config.apiKey) },
  );
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Brevo contact read failed (${response.status})`);
  }
  return (await response.json()) as BrevoContact;
};

const responseDetail = async (response: Response) => {
  const body = (await response.text()).trim();
  if (!body) return "";
  const redacted = body
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/gu, "[redacted-phone]");
  return `: ${redacted.slice(0, 1_000)}`;
};

export const publishBrevoLifecycle = async (
  event: BrevoLifecycleEvent,
  config: BrevoConfig,
  fetcher: Fetcher,
) => {
  const projection = lifecycleProjection(event);
  if (!projection) {
    return {
      skipped:
        event.eventType === "application_submitted" &&
        event.qualificationStatus === "qualified"
          ? ("booking_link_unavailable" as const)
          : ("unqualified" as const),
    };
  }
  const email = event.payload.email.trim().toLowerCase();
  const existing = await readBrevoContact(email, config, fetcher);
  const existingState = existing?.attributes?.PULPSENSE_LIFECYCLE_STATE;
  const existingAt = existing?.attributes?.PULPSENSE_LIFECYCLE_AT;
  const existingTimestamp =
    typeof existingAt === "string" ? Date.parse(existingAt) : Number.NaN;
  const incomingTimestamp = Date.parse(event.occurredAt);
  const wouldRegressToUnbooked =
    projection.state === "qualified_unbooked" &&
    stateRank(existingState) > stateRank(projection.state);
  const equallyTimedRegression =
    Number.isFinite(existingTimestamp) &&
    existingTimestamp === incomingTimestamp &&
    stateRank(existingState) > stateRank(projection.state);
  if (
    wouldRegressToUnbooked ||
    equallyTimedRegression ||
    (Number.isFinite(existingTimestamp) &&
      existingTimestamp > incomingTimestamp) ||
    (projection.state === "qualified_unbooked" &&
      existingState === "qualified_unbooked")
  ) {
    return { skipped: "stale_or_already_active" as const };
  }

  const sms = normalizeSms(event.payload.phone);
  const attributes = {
    FIRSTNAME: event.payload.firstName,
    LASTNAME: event.payload.lastName,
    ...(sms ? { SMS: sms } : {}),
    PULPSENSE_FUNNEL_ID: event.funnelId,
    PULPSENSE_LEAD_JOURNEY_ID: event.submissionId,
    PULPSENSE_LIFECYCLE_STATE: projection.state,
    PULPSENSE_LIFECYCLE_AT: event.occurredAt,
    ...ownedAttribution(event),
    ...projection.attributes,
  };
  const upsertContact = (contactAttributes: typeof attributes) =>
    fetcher("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: brevoHeaders(config.apiKey),
      body: JSON.stringify({
        email,
        attributes: contactAttributes,
        listIds: [
          config.adsListId,
          ...(event.eventType === "contact_submitted" && config.newsletterListId
            ? [config.newsletterListId]
            : []),
        ],
        updateEnabled: true,
      }),
    });
  let upsert = await upsertContact(attributes);
  if (!upsert.ok && upsert.status !== 204) {
    const detail = await responseDetail(upsert);
    if (
      upsert.status === 400 &&
      sms &&
      detail.includes("Invalid phone number")
    ) {
      const attributesWithoutSms = { ...attributes };
      delete attributesWithoutSms.SMS;
      upsert = await upsertContact(attributesWithoutSms);
    } else {
      throw new Error(
        `Brevo contact upsert failed (${upsert.status})${detail}`,
      );
    }
  }
  if (!upsert.ok && upsert.status !== 204) {
    throw new Error(
      `Brevo contact upsert failed (${upsert.status})${await responseDetail(upsert)}`,
    );
  }
  const publish = await fetcher("https://api.brevo.com/v3/events", {
    method: "POST",
    headers: brevoHeaders(config.apiKey),
    body: JSON.stringify({
      event_name: projection.eventName,
      event_date: event.occurredAt,
      identifiers: { email_id: email },
      contact_properties: attributes,
      event_properties: {
        lead_journey_id: event.submissionId,
        lifecycle_event_id: event.eventId,
        ...projection.eventProperties,
      },
    }),
  });
  if (!publish.ok) {
    throw new Error(
      `Brevo lifecycle event failed (${publish.status})${await responseDetail(publish)}`,
    );
  }
  return { published: true as const, eventName: projection.eventName };
};

export type { BrevoConfig, BrevoLifecycleEvent, SlackConfig };
