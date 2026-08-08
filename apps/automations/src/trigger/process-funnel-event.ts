import {
  contactSubmittedEventSchema,
  type ContactSubmittedEvent,
} from "@pulpsense/contracts";
import { logger, schemaTask } from "@trigger.dev/sdk";

type ProcessorDependencies = {
  assertEnvironment?(environment: ContactSubmittedEvent["environment"]): void;
  upsertTwentyPerson(
    event: ContactSubmittedEvent,
  ): Promise<{ personId: string }>;
  sendMetaLead(
    event: ContactSubmittedEvent,
  ): Promise<{ eventsReceived: number }>;
  log: {
    info(message: string, data?: Record<string, unknown>): void;
  };
};

export async function processFunnelEvent(
  event: ContactSubmittedEvent,
  dependencies: ProcessorDependencies,
) {
  dependencies.assertEnvironment?.(event.environment);
  dependencies.log.info("Processing funnel contact", {
    submissionId: event.submissionId,
    eventId: event.eventId,
    funnelId: event.funnelId,
    environment: event.environment,
    emailVerificationStatus: event.payload.emailVerification.status,
  });

  const { personId } = await dependencies.upsertTwentyPerson(event);
  const { eventsReceived } = await dependencies.sendMetaLead(event);

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
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_GRAPH_API_VERSION?: string;
  PULPSENSE_AUTOMATION_ENVIRONMENT?: ContactSubmittedEvent["environment"];
};

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

const personInput = (event: ContactSubmittedEvent) => ({
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

const upsertTwentyPerson = async (
  event: ContactSubmittedEvent,
  client: TwentyClient,
) => {
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

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const sendMetaLead = async (
  event: ContactSubmittedEvent,
  fetcher: typeof fetch,
  graphApiVersion: string,
  pixelId: string,
  accessToken: string,
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
            event_name: "Lead",
            event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000),
            event_id: event.eventId,
            action_source: "website",
            event_source_url: event.requestContext.sourceUrl,
            user_data: userData,
            custom_data: { funnel_id: event.funnelId },
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Meta Lead delivery failed (${response.status})`);
  }

  const result = (await response.json()) as { events_received?: number };
  if (result.events_received !== 1) {
    throw new Error("Meta Lead delivery was not acknowledged");
  }

  return { eventsReceived: result.events_received };
};

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

  return {
    assertEnvironment: (eventEnvironment) => {
      if (eventEnvironment !== automationEnvironment) {
        throw new Error("Funnel event environment does not match destinations");
      }
    },
    upsertTwentyPerson: (event) => upsertTwentyPerson(event, twentyClient),
    sendMetaLead: (event) =>
      sendMetaLead(event, runtime.fetch, graphVersion, pixelId, metaToken),
    log: runtime.log,
  };
}

export const processFunnelEventTask = schemaTask({
  id: "process-funnel-event",
  schema: contactSubmittedEventSchema,
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
          META_PIXEL_ID: process.env.META_PIXEL_ID,
          META_CAPI_ACCESS_TOKEN: process.env.META_CAPI_ACCESS_TOKEN,
          META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
          PULPSENSE_AUTOMATION_ENVIRONMENT: process.env
            .PULPSENSE_AUTOMATION_ENVIRONMENT as
            | ContactSubmittedEvent["environment"]
            | undefined,
        },
        { fetch, log: logger },
      ),
    ),
});
