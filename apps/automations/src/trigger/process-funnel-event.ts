import {
  funnelEventSchema,
  type ApplicationSubmittedEvent,
  type BookingCompletedEvent,
  type ContactSubmittedEvent,
  type FunnelEvent,
} from "@pulpsense/contracts";
import { logger, schemaTask } from "@trigger.dev/sdk";

import { createPostHogLifecycleCapture } from "./posthog-lifecycle.js";

type ProcessorDependencies = {
  assertEnvironment?(environment: FunnelEvent["environment"]): void;
  upsertTwentyPerson(event: FunnelEvent): Promise<{ personId: string }>;
  sendMetaLead(
    event: ContactSubmittedEvent,
  ): Promise<{ eventsReceived: number }>;
  recordTwentyApplication?(
    event: ApplicationSubmittedEvent,
    personId: string,
  ): Promise<{ activityId: string; opportunityId?: string }>;
  sendMetaApplication?(
    event: ApplicationSubmittedEvent,
  ): Promise<{ eventsReceived: number }>;
  recordTwentyBooking?(
    event: BookingCompletedEvent,
    personId: string,
  ): Promise<{ activityId: string; opportunityId: string }>;
  sendMetaSchedule?(
    event: BookingCompletedEvent,
  ): Promise<{ eventsReceived: number }>;
  capturePostHogLifecycle?(event: FunnelEvent): Promise<void>;
  log: {
    info(message: string, data?: Record<string, unknown>): void;
  };
};

const capturePostHogSafely = async (
  event: FunnelEvent,
  dependencies: ProcessorDependencies,
) => {
  if (!dependencies.capturePostHogLifecycle) return;

  try {
    await dependencies.capturePostHogLifecycle(event);
  } catch {
    dependencies.log.info("PostHog lifecycle delivery failed", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      eventType: event.eventType,
    });
  }
};

export async function processFunnelEvent(
  event: FunnelEvent,
  dependencies: ProcessorDependencies,
) {
  dependencies.assertEnvironment?.(event.environment);
  if (event.eventType === "booking_completed") {
    if (!dependencies.recordTwentyBooking || !dependencies.sendMetaSchedule) {
      throw new Error("Booking processing is not configured");
    }
    dependencies.log.info("Processing verified funnel booking", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      bookingUid: event.payload.booking.uid,
      funnelId: event.funnelId,
      environment: event.environment,
    });

    const { personId } = await dependencies.upsertTwentyPerson(event);
    const booking = await dependencies.recordTwentyBooking(event, personId);
    const { eventsReceived } = await dependencies.sendMetaSchedule(event);
    await capturePostHogSafely(event, dependencies);

    dependencies.log.info("Processed verified funnel booking", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      bookingUid: event.payload.booking.uid,
      personId,
      activityId: booking.activityId,
      opportunityId: booking.opportunityId,
      metaEventsReceived: eventsReceived,
    });

    return {
      ok: true as const,
      personId,
      activityId: booking.activityId,
      opportunityId: booking.opportunityId,
      metaEventId: event.eventId,
    };
  }

  if (event.eventType === "application_submitted") {
    if (
      !dependencies.recordTwentyApplication ||
      !dependencies.sendMetaApplication
    ) {
      throw new Error("Application processing is not configured");
    }
    dependencies.log.info("Processing funnel application", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      funnelId: event.funnelId,
      environment: event.environment,
      qualificationStatus: event.qualificationStatus,
    });

    const { personId } = await dependencies.upsertTwentyPerson(event);
    const application = await dependencies.recordTwentyApplication(
      event,
      personId,
    );
    const { eventsReceived } = await dependencies.sendMetaApplication(event);
    await capturePostHogSafely(event, dependencies);

    dependencies.log.info("Processed funnel application", {
      submissionId: event.submissionId,
      eventId: event.eventId,
      personId,
      activityId: application.activityId,
      ...(application.opportunityId
        ? { opportunityId: application.opportunityId }
        : {}),
      metaEventsReceived: eventsReceived,
    });

    return {
      ok: true as const,
      personId,
      activityId: application.activityId,
      ...(application.opportunityId
        ? { opportunityId: application.opportunityId }
        : {}),
      metaEventId: event.eventId,
    };
  }

  dependencies.log.info("Processing funnel contact", {
    submissionId: event.submissionId,
    eventId: event.eventId,
    funnelId: event.funnelId,
    environment: event.environment,
    emailVerificationStatus: event.payload.emailVerification.status,
  });

  const { personId } = await dependencies.upsertTwentyPerson(event);
  const { eventsReceived } = await dependencies.sendMetaLead(event);
  await capturePostHogSafely(event, dependencies);

  dependencies.log.info("Processed funnel contact", {
    submissionId: event.submissionId,
    eventId: event.eventId,
    personId,
    metaEventsReceived: eventsReceived,
  });

  return {
    ok: true as const,
    personId,
    metaEventId: event.eventId,
  };
}

type ProcessorEnvironment = {
  TWENTY_API_KEY?: string;
  TWENTY_API_ORIGIN?: string;
  TWENTY_QUALIFIED_STAGE_VALUE?: string;
  TWENTY_CALL_BOOKED_STAGE_VALUE?: string;
  TWENTY_CLOSED_STAGE_VALUES?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
  META_GRAPH_API_VERSION?: string;
  POSTHOG_PROJECT_KEY?: string;
  POSTHOG_HOST?: string;
  PULPSENSE_AUTOMATION_ENVIRONMENT?: FunnelEvent["environment"];
};

export const resolveMetaEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): {
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
} => ({
  META_PIXEL_ID:
    environment.META_PIXEL_ID_AI_SEO_L || environment.META_PIXEL_ID,
  META_CAPI_ACCESS_TOKEN:
    environment.META_CAPI_ACCESS_TOKEN_AI_SEO_L ||
    environment.META_CAPI_ACCESS_TOKEN,
  META_TEST_EVENT_CODE:
    environment.META_TEST_EVENT_CODE_AI_SEO_L ||
    environment.META_TEST_EVENT_CODE,
});

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/u, "");

const twentyHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

type TwentyClient = {
  fetch: typeof fetch;
  origin: string;
  apiKey: string;
};

const findTwentyPersonId = async (client: TwentyClient, email: string) => {
  const response = await client.fetch(`${client.origin}/graphql`, {
    method: "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify({
      query: `
        query FindPersonByEmail($email: String!) {
          people(
            filter: { emails: { primaryEmail: { eq: $email } } }
            first: 1
          ) {
            edges { node { id } }
          }
        }
      `,
      variables: { email },
    }),
  });
  if (!response.ok) {
    throw new Error(`Twenty person lookup failed (${response.status})`);
  }

  const result = (await response.json()) as {
    data?: { people?: { edges?: Array<{ node?: { id?: string } }> } };
    errors?: unknown[];
  };
  if (result.errors?.length) throw new Error("Twenty person lookup failed");
  return result.data?.people?.edges?.[0]?.node?.id;
};

const personInput = (event: FunnelEvent) => ({
  name: {
    firstName: event.payload.firstName,
    lastName: event.payload.lastName,
  },
  emails: {
    primaryEmail: event.payload.email.trim().toLowerCase(),
    additionalEmails: [],
  },
  phones: {
    primaryPhoneNumber: event.payload.phone,
  },
});

const upsertTwentyPerson = async (event: FunnelEvent, client: TwentyClient) => {
  const normalizedEmail = event.payload.email.trim().toLowerCase();
  const existingId = await findTwentyPersonId(client, normalizedEmail);
  const endpoint = existingId
    ? `${client.origin}/rest/people/${encodeURIComponent(existingId)}`
    : `${client.origin}/rest/people`;
  const response = await client.fetch(endpoint, {
    method: existingId ? "PATCH" : "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify(personInput(event)),
  });

  if (!response.ok) {
    if (response.status === 409 && !existingId) {
      const concurrentId = await findTwentyPersonId(client, normalizedEmail);
      if (!concurrentId) {
        throw new Error("Twenty person conflict could not be reconciled");
      }

      const updateResponse = await client.fetch(
        `${client.origin}/rest/people/${encodeURIComponent(concurrentId)}`,
        {
          method: "PATCH",
          headers: twentyHeaders(client.apiKey),
          body: JSON.stringify(personInput(event)),
        },
      );
      if (!updateResponse.ok) {
        throw new Error(
          `Twenty person upsert failed (${updateResponse.status})`,
        );
      }

      return { personId: concurrentId };
    }

    throw new Error(`Twenty person upsert failed (${response.status})`);
  }

  const result = (await response.json()) as {
    data?: {
      createPerson?: { id?: string };
      updatePerson?: { id?: string };
      person?: { id?: string };
    };
  };
  const personId =
    existingId ??
    result.data?.createPerson?.id ??
    result.data?.updatePerson?.id ??
    result.data?.person?.id;
  if (!personId) throw new Error("Twenty person upsert omitted person ID");

  return { personId };
};

const findTwentyCompanyId = async (
  client: TwentyClient,
  companyDomain: string,
) => {
  const domainUrl = `https://${companyDomain}`;
  const response = await client.fetch(`${client.origin}/graphql`, {
    method: "POST",
    headers: twentyHeaders(client.apiKey),
    body: JSON.stringify({
      query: `
        query FindCompanyByDomain($domainUrl: String!) {
          companies(
            filter: { domainName: { primaryLinkUrl: { eq: $domainUrl } } }
            first: 1
          ) {
            edges { node { id } }
          }
        }
      `,
      variables: { domainUrl },
    }),
  });
  if (!response.ok) {
    throw new Error(`Twenty company lookup failed (${response.status})`);
  }
  const result = (await response.json()) as {
    data?: { companies?: { edges?: Array<{ node?: { id?: string } }> } };
    errors?: unknown[];
  };
  if (result.errors?.length) throw new Error("Twenty company lookup failed");
  return result.data?.companies?.edges?.[0]?.node?.id;
};

const createTwentyRecordOnce = async (
  client: TwentyClient,
  objectNamePlural: string,
  input: Record<string, unknown>,
) => {
  const response = await client.fetch(
    `${client.origin}/rest/${objectNamePlural}`,
    {
      method: "POST",
      headers: twentyHeaders(client.apiKey),
      body: JSON.stringify(input),
    },
  );
  if (response.status === 409) return;
  if (!response.ok) {
    const body = await response.text();
    if (
      response.status === 400 &&
      body.toLowerCase().includes("duplicate entry")
    ) {
      return;
    }
    throw new Error(
      `Twenty ${objectNamePlural} create failed (${response.status})`,
    );
  }
};

const applicationMarkdown = (event: ApplicationSubmittedEvent) =>
  [
    `# Application ${event.submissionId}`,
    "",
    `Qualification: ${event.qualificationStatus}`,
    `Submitted: ${event.occurredAt}`,
    "",
    "```json",
    JSON.stringify(event.payload.application, null, 2),
    "```",
  ].join("\n");

const bookingMarkdown = (event: BookingCompletedEvent) =>
  [
    `# Booking ${event.payload.booking.uid}`,
    "",
    `Title: ${event.payload.booking.title}`,
    `Starts: ${event.payload.booking.startTime}`,
    `Ends: ${event.payload.booking.endTime}`,
    `Confirmed: ${event.occurredAt}`,
  ].join("\n");

const deterministicUuid = async (identity: string) => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

type ApplicationAnswers = ApplicationSubmittedEvent["payload"]["application"];

const paidSocialSpendValues = {
  "Less than $20k/month": "LESS_THAN_20K_MONTH",
  "$20k - $50k/month": "FROM_20K_TO_50K_MONTH",
  "$50k - $150k/month": "FROM_50K_TO_150K_MONTH",
  "$150k+/month": "FROM_150K_MONTH",
} satisfies Record<ApplicationAnswers["paidSocialSpend"], string>;

const winnerStatusValues = {
  "Yes, one clear winner": "ONE_CLEAR_WINNER",
  "Yes, several winners": "SEVERAL_WINNERS",
  "Promising ad, not fully proven": "PROMISING_NOT_PROVEN",
  "No proven winner yet": "NO_PROVEN_WINNER",
} satisfies Record<ApplicationAnswers["winnerStatus"], string>;

const platformValues = {
  Meta: "META",
  TikTok: "TIKTOK",
  Reels: "REELS",
  Shorts: "SHORTS",
  "TikTok Shop": "TIKTOK_SHOP",
  "Other paid social": "OTHER_PAID_SOCIAL",
} satisfies Record<ApplicationAnswers["platforms"][number], string>;

const deliveryTimelineValues = {
  "This week": "THIS_WEEK",
  "Next 2 weeks": "NEXT_2_WEEKS",
  "This month": "THIS_MONTH",
  "Just researching": "JUST_RESEARCHING",
} satisfies Record<ApplicationAnswers["deliveryTimeline"], string>;

const twentyOpportunityProjection = (application: ApplicationAnswers) => ({
  brandUrl: {
    primaryLinkUrl: application.brandUrl,
    primaryLinkLabel: new URL(application.brandUrl).hostname,
    secondaryLinks: null,
  },
  paidSocialSpend: paidSocialSpendValues[application.paidSocialSpend],
  winnerStatus: winnerStatusValues[application.winnerStatus],
  platforms: application.platforms.map((platform) => platformValues[platform]),
  deliveryTimeline: deliveryTimelineValues[application.deliveryTimeline],
});

const findOpenTwentyOpportunity = async (
  client: TwentyClient,
  personId: string,
  closedStageValues: ReadonlySet<string>,
) => {
  let after: string | undefined;
  do {
    const response = await client.fetch(`${client.origin}/graphql`, {
      method: "POST",
      headers: twentyHeaders(client.apiKey),
      body: JSON.stringify({
        query: `
        query FindOpportunitiesByPerson($personId: UUID!, $after: String) {
          opportunities(
            filter: { pointOfContactId: { eq: $personId } }
            first: 50
            after: $after
          ) {
            edges { node { id stage } }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
        variables: { personId, ...(after ? { after } : {}) },
      }),
    });
    if (!response.ok) {
      throw new Error(`Twenty opportunity lookup failed (${response.status})`);
    }
    const result = (await response.json()) as {
      data?: {
        opportunities?: {
          edges?: Array<{ node?: { id?: string; stage?: string } }>;
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
        };
      };
      errors?: unknown[];
    };
    if (result.errors?.length) {
      throw new Error("Twenty opportunity lookup failed");
    }
    const opportunity = result.data?.opportunities?.edges
      ?.map(({ node }) => node)
      .find(
        (opportunity) =>
          opportunity?.id &&
          opportunity.stage &&
          !closedStageValues.has(opportunity.stage),
      );
    if (opportunity?.id && opportunity.stage) {
      return { id: opportunity.id, stage: opportunity.stage };
    }
    const pageInfo = result.data?.opportunities?.pageInfo;
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
  } while (after);

  return undefined;
};

const writeTwentyOpportunity = async (
  client: TwentyClient,
  input: Record<string, unknown>,
  opportunityId?: string,
) => {
  const response = await client.fetch(
    opportunityId
      ? `${client.origin}/rest/opportunities/${encodeURIComponent(opportunityId)}`
      : `${client.origin}/rest/opportunities`,
    {
      method: opportunityId ? "PATCH" : "POST",
      headers: twentyHeaders(client.apiKey),
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(`Twenty opportunity write failed (${response.status})`);
  }
  if (opportunityId) return opportunityId;
  const result = (await response.json()) as {
    data?: {
      createOpportunity?: { id?: string };
      opportunity?: { id?: string };
    };
  };
  const createdId =
    result.data?.createOpportunity?.id ?? result.data?.opportunity?.id;
  if (!createdId) throw new Error("Twenty opportunity create omitted ID");
  return createdId;
};

const recordTwentyApplication = async (
  event: ApplicationSubmittedEvent,
  personId: string,
  client: TwentyClient,
  qualifiedStageValue: string | undefined,
  closedStageValues: ReadonlySet<string>,
) => {
  // Twenty's workspace automation is the sole Company creator. Trigger.dev
  // only matches the normalized email domain so both systems cannot race.
  const companyId = await findTwentyCompanyId(client, event.companyDomain);
  await createTwentyRecordOnce(client, "notes", {
    id: event.submissionId,
    title: `Application ${event.submissionId}`,
    bodyV2: { markdown: applicationMarkdown(event) },
  });
  await createTwentyRecordOnce(client, "noteTargets", {
    id: event.submissionId,
    noteId: event.submissionId,
    targetPersonId: personId,
  });

  if (event.qualificationStatus === "unqualified") {
    return { activityId: event.submissionId };
  }

  const stage = required(qualifiedStageValue, "TWENTY_QUALIFIED_STAGE_VALUE");
  const openOpportunity = await findOpenTwentyOpportunity(
    client,
    personId,
    closedStageValues,
  );
  const opportunityId = await writeTwentyOpportunity(
    client,
    {
      name: `Creative Multiplier Sprint – ${event.companyDomain}`,
      ...(openOpportunity ? {} : { stage }),
      pointOfContactId: personId,
      ...(companyId ? { companyId } : {}),
      ...twentyOpportunityProjection(event.payload.application),
    },
    openOpportunity?.id,
  );

  return { activityId: event.submissionId, opportunityId };
};

const recordTwentyBooking = async (
  event: BookingCompletedEvent,
  personId: string,
  client: TwentyClient,
  callBookedStageValue: string | undefined,
  closedStageValues: ReadonlySet<string>,
) => {
  const activityId = await deterministicUuid(
    `cal-booking:${event.payload.booking.uid}`,
  );
  await createTwentyRecordOnce(client, "notes", {
    id: activityId,
    title: `Booking ${event.payload.booking.uid}`,
    bodyV2: { markdown: bookingMarkdown(event) },
  });
  await createTwentyRecordOnce(client, "noteTargets", {
    id: activityId,
    noteId: activityId,
    targetPersonId: personId,
  });

  const opportunity = await findOpenTwentyOpportunity(
    client,
    personId,
    closedStageValues,
  );
  if (!opportunity) {
    throw new Error("Qualified Opportunity is not available for booking");
  }
  const stage = required(
    callBookedStageValue,
    "TWENTY_CALL_BOOKED_STAGE_VALUE",
  );
  await writeTwentyOpportunity(client, { stage }, opportunity.id);

  return { activityId, opportunityId: opportunity.id };
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const sendMetaEvent = async (
  event: FunnelEvent,
  eventName: "Lead" | "SubmitApplication" | "Schedule",
  customData: Record<string, unknown>,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) => {
  const userData: Record<string, unknown> = {
    em: [await sha256(event.payload.email.trim().toLowerCase())],
    ph: [await sha256(event.payload.phone.replace(/\D/gu, ""))],
    client_ip_address: event.requestContext.clientIp,
    client_user_agent: event.requestContext.userAgent,
    ...(event.requestContext.fbp ? { fbp: event.requestContext.fbp } : {}),
    ...(event.requestContext.fbc ? { fbc: event.requestContext.fbc } : {}),
  };
  const response = await fetcher(
    `https://graph.facebook.com/${encodeURIComponent(graphApiVersion)}/${encodeURIComponent(pixelId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000),
            event_id: event.eventId,
            action_source: "website",
            event_source_url: event.requestContext.sourceUrl,
            user_data: userData,
            custom_data: customData,
          },
        ],
        ...(testEventCode ? { test_event_code: testEventCode } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Meta ${eventName} delivery failed (${response.status})`);
  }

  const result = (await response.json()) as { events_received?: number };
  if (result.events_received !== 1) {
    throw new Error(`Meta ${eventName} delivery was not acknowledged`);
  }

  return { eventsReceived: result.events_received };
};

const sendMetaLead = async (
  event: ContactSubmittedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) =>
  sendMetaEvent(
    event,
    "Lead",
    { funnel_id: event.funnelId },
    fetcher,
    graphApiVersion,
    pixelId,
    accessToken,
    testEventCode,
  );

const sendMetaApplication = async (
  event: ApplicationSubmittedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) =>
  sendMetaEvent(
    event,
    "SubmitApplication",
    { qualification_status: event.qualificationStatus },
    fetcher,
    graphApiVersion,
    pixelId,
    accessToken,
    testEventCode,
  );

const sendMetaSchedule = async (
  event: BookingCompletedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string,
) =>
  sendMetaEvent(
    event,
    "Schedule",
    { funnel_id: event.funnelId },
    fetcher,
    graphApiVersion,
    pixelId,
    accessToken,
    testEventCode,
  );

export function createProcessorDependencies(
  environment: ProcessorEnvironment,
  runtime: { fetch: typeof fetch; log: ProcessorDependencies["log"] },
): ProcessorDependencies {
  const twentyApiKey = required(environment.TWENTY_API_KEY, "TWENTY_API_KEY");
  const twentyOrigin = normalizeOrigin(
    required(environment.TWENTY_API_ORIGIN, "TWENTY_API_ORIGIN"),
  );
  const pixelId = required(environment.META_PIXEL_ID, "META_PIXEL_ID");
  const metaToken = required(
    environment.META_CAPI_ACCESS_TOKEN,
    "META_CAPI_ACCESS_TOKEN",
  );
  const metaTestEventCode = environment.META_TEST_EVENT_CODE;
  const graphVersion = required(
    environment.META_GRAPH_API_VERSION,
    "META_GRAPH_API_VERSION",
  );
  const automationEnvironment = required(
    environment.PULPSENSE_AUTOMATION_ENVIRONMENT,
    "PULPSENSE_AUTOMATION_ENVIRONMENT",
  ) as ContactSubmittedEvent["environment"];
  const twentyClient: TwentyClient = {
    fetch: runtime.fetch,
    origin: twentyOrigin,
    apiKey: twentyApiKey,
  };
  const closedStageValues = new Set(
    (environment.TWENTY_CLOSED_STAGE_VALUES ?? "WON,LOST,CLOSED")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const capturePostHogLifecycle = environment.POSTHOG_PROJECT_KEY
    ? createPostHogLifecycleCapture(
        {
          apiKey: environment.POSTHOG_PROJECT_KEY,
          host: environment.POSTHOG_HOST ?? "https://us.i.posthog.com",
        },
        { fetch: runtime.fetch },
      )
    : undefined;

  return {
    assertEnvironment: (eventEnvironment) => {
      if (eventEnvironment !== automationEnvironment) {
        throw new Error("Funnel event environment does not match destinations");
      }
    },
    upsertTwentyPerson: (event) => upsertTwentyPerson(event, twentyClient),
    recordTwentyApplication: (event, personId) =>
      recordTwentyApplication(
        event,
        personId,
        twentyClient,
        environment.TWENTY_QUALIFIED_STAGE_VALUE,
        closedStageValues,
      ),
    recordTwentyBooking: (event, personId) =>
      recordTwentyBooking(
        event,
        personId,
        twentyClient,
        environment.TWENTY_CALL_BOOKED_STAGE_VALUE,
        closedStageValues,
      ),
    sendMetaLead: (event) =>
      sendMetaLead(
        event,
        runtime.fetch,
        graphVersion,
        pixelId,
        metaToken,
        metaTestEventCode,
      ),
    sendMetaApplication: (event) =>
      sendMetaApplication(
        event,
        runtime.fetch,
        graphVersion,
        pixelId,
        metaToken,
        metaTestEventCode,
      ),
    sendMetaSchedule: (event) =>
      sendMetaSchedule(
        event,
        runtime.fetch,
        graphVersion,
        pixelId,
        metaToken,
        metaTestEventCode,
      ),
    ...(capturePostHogLifecycle ? { capturePostHogLifecycle } : {}),
    log: runtime.log,
  };
}

export const processFunnelEventTask = schemaTask({
  id: "process-funnel-event",
  schema: funnelEventSchema,
  // Serial execution closes the read-then-create race for the single open
  // Opportunity invariant. Revisit with a per-Person queue if volume requires.
  queue: { concurrencyLimit: 1 },
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (event) =>
    processFunnelEvent(
      event,
      createProcessorDependencies(
        {
          TWENTY_API_KEY: process.env.TWENTY_API_KEY,
          TWENTY_API_ORIGIN: process.env.TWENTY_API_ORIGIN,
          TWENTY_QUALIFIED_STAGE_VALUE:
            process.env.TWENTY_QUALIFIED_STAGE_VALUE,
          TWENTY_CALL_BOOKED_STAGE_VALUE:
            process.env.TWENTY_CALL_BOOKED_STAGE_VALUE,
          TWENTY_CLOSED_STAGE_VALUES: process.env.TWENTY_CLOSED_STAGE_VALUES,
          ...resolveMetaEnvironment(process.env),
          META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
          POSTHOG_PROJECT_KEY: process.env.POSTHOG_PROJECT_KEY,
          POSTHOG_HOST: process.env.POSTHOG_HOST,
          PULPSENSE_AUTOMATION_ENVIRONMENT: process.env
            .PULPSENSE_AUTOMATION_ENVIRONMENT as
            | FunnelEvent["environment"]
            | undefined,
        },
        { fetch, log: logger },
      ),
    ),
});
