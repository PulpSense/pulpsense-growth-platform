import {
  isTwentyRevenueUpdatedField,
  prospectIdSchema,
  twentySalesWebhookEventSchema,
  type TwentySalesWebhookEvent,
} from "@pulpsense/contracts";
import { logger, schemaTask } from "@trigger.dev/sdk";

type SalesEventName =
  | "sale_completed"
  | "sale_lost"
  | "sale_revenue_adjusted"
  | "sale_outcome_corrected";

type SalesCapture = {
  event: SalesEventName;
  distinctId: string;
  insertId: string;
  occurredAt: string;
  properties: Record<string, unknown>;
};

export type TwentySalesOutcomeDependencies = {
  wonStageId: string;
  lostStageId: string;
  resolveStageOptionId(stageValue: string): Promise<string>;
  resolveProspectId(personId: string): Promise<string>;
  capture(event: SalesCapture): Promise<void>;
  recordOutcome(opportunityId: string, outcome: "won" | "lost"): Promise<void>;
};

const outcomeForStageId = (
  stageId: string,
  dependencies: Pick<
    TwentySalesOutcomeDependencies,
    "wonStageId" | "lostStageId"
  >,
) =>
  stageId === dependencies.wonStageId
    ? "won"
    : stageId === dependencies.lostStageId
      ? "lost"
      : undefined;

export async function processTwentySalesOutcome(
  event: TwentySalesWebhookEvent,
  dependencies: TwentySalesOutcomeDependencies,
) {
  const stageId = await dependencies.resolveStageOptionId(event.stageValue);
  const outcome = outcomeForStageId(stageId, dependencies);
  if (!outcome) {
    return { emitted: null, ignored: "intermediate_stage" } as const;
  }
  const prospectId =
    event.prospectId ?? (await dependencies.resolveProspectId(event.personId));
  const previousOutcome = event.previousOutcome;

  let emitted: SalesEventName;
  let insertId: string;
  let outcomeProperties: Record<string, unknown>;
  if (previousOutcome && previousOutcome !== outcome) {
    emitted = "sale_outcome_corrected";
    insertId = `${emitted}:${event.eventId}`;
    outcomeProperties = {
      previous_outcome: previousOutcome,
      corrected_outcome: outcome,
    };
  } else if (
    outcome === "won" &&
    !event.updatedFields.includes("stage") &&
    event.updatedFields.some(isTwentyRevenueUpdatedField)
  ) {
    emitted = "sale_revenue_adjusted";
    insertId = `${emitted}:${event.eventId}`;
    outcomeProperties = { outcome };
  } else {
    emitted = outcome === "won" ? "sale_completed" : "sale_lost";
    insertId = `${emitted}:${event.opportunityId}`;
    outcomeProperties = { outcome };
  }

  await dependencies.capture({
    event: emitted,
    distinctId: prospectId,
    insertId,
    occurredAt: event.occurredAt,
    properties: {
      prospect_id: prospectId,
      originating_lead_journey_id: event.originatingLeadJourneyId,
      twenty_person_id: event.personId,
      twenty_opportunity_id: event.opportunityId,
      amount: event.amount,
      currency: event.currency,
      ...outcomeProperties,
    },
  });
  await dependencies.recordOutcome(event.opportunityId, outcome);
  return { emitted } as const;
}

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const postHogCaptureUrl = (host: string) => {
  const url = new URL(host);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PostHog host must use HTTP(S)");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/i/v0/e/`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const createTwentySalesOutcomeDependencies = (
  environment: NodeJS.ProcessEnv,
  fetcher: typeof fetch = fetch,
): TwentySalesOutcomeDependencies => {
  const twentyOrigin = required(
    environment.TWENTY_API_ORIGIN,
    "TWENTY_API_ORIGIN",
  ).replace(/\/+$/u, "");
  const twentyApiKey = required(environment.TWENTY_API_KEY, "TWENTY_API_KEY");
  const postHogKey = required(
    environment.POSTHOG_PROJECT_KEY,
    "POSTHOG_PROJECT_KEY",
  );
  const postHogEndpoint = postHogCaptureUrl(
    required(environment.POSTHOG_HOST, "POSTHOG_HOST"),
  );
  return {
    wonStageId: required(
      environment.TWENTY_WON_STAGE_ID,
      "TWENTY_WON_STAGE_ID",
    ),
    lostStageId: required(
      environment.TWENTY_LOST_STAGE_ID,
      "TWENTY_LOST_STAGE_ID",
    ),
    resolveStageOptionId: async (stageValue) => {
      const response = await fetcher(`${twentyOrigin}/metadata`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${twentyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `query OpportunityStageOptions {
            objects(paging: { first: 1000 }) {
              edges {
                node {
                  id
                  nameSingular
                }
              }
            }
            fields(paging: { first: 1000 }) {
              edges {
                node {
                  name
                  objectMetadataId
                  options
                }
              }
            }
          }`,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Twenty stage metadata lookup failed (${response.status})`,
        );
      }
      const result = (await response.json()) as {
        errors?: unknown[];
        data?: {
          objects?: {
            edges?: Array<{
              node?: { id?: unknown; nameSingular?: unknown };
            }>;
          };
          fields?: {
            edges?: Array<{
              node?: {
                name?: unknown;
                objectMetadataId?: unknown;
                options?: Array<{ id?: unknown; value?: unknown }>;
              };
            }>;
          };
        };
      };
      if (result.errors?.length) {
        throw new Error("Twenty stage metadata query failed");
      }
      const opportunityObjectId = result.data?.objects?.edges?.find(
        (edge) => edge.node?.nameSingular === "opportunity",
      )?.node?.id;
      const option = result.data?.fields?.edges
        ?.filter(
          (edge) =>
            edge.node?.name === "stage" &&
            edge.node.objectMetadataId === opportunityObjectId,
        )
        .flatMap((edge) => edge.node?.options ?? [])
        .find((candidate) => candidate.value === stageValue);
      if (typeof option?.id !== "string" || !option.id) {
        throw new Error(`Twenty stage value ${stageValue} has no option ID`);
      }
      return option.id;
    },
    resolveProspectId: async (personId) => {
      const response = await fetcher(
        `${twentyOrigin}/rest/people/${encodeURIComponent(personId)}`,
        { headers: { Authorization: `Bearer ${twentyApiKey}` } },
      );
      if (!response.ok) {
        throw new Error(`Twenty Person lookup failed (${response.status})`);
      }
      const result = (await response.json()) as {
        data?: { person?: { prospectId?: unknown } };
        prospectId?: unknown;
      };
      const parsed = prospectIdSchema.safeParse(
        result.data?.person?.prospectId ?? result.prospectId,
      );
      if (!parsed.success) {
        throw new Error("Twenty Person omitted required Prospect reference");
      }
      return parsed.data;
    },
    capture: async (event) => {
      const response = await fetcher(postHogEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: postHogKey,
          event: event.event,
          timestamp: event.occurredAt,
          properties: {
            distinct_id: event.distinctId,
            $insert_id: event.insertId,
            environment: "production",
            ...event.properties,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`PostHog sales delivery failed (${response.status})`);
      }
    },
    recordOutcome: async (opportunityId, outcome) => {
      const response = await fetcher(
        `${twentyOrigin}/rest/opportunities/${encodeURIComponent(opportunityId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${twentyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pulpsenseSalesOutcome: outcome.toUpperCase(),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Twenty sales outcome state write failed (${response.status})`,
        );
      }
    },
  };
};

export const processTwentySalesOutcomeTask = schemaTask({
  id: "process-twenty-sales-outcome",
  schema: twentySalesWebhookEventSchema,
  queue: { concurrencyLimit: 1 },
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (payload) => {
    if (process.env.PULPSENSE_AUTOMATION_ENVIRONMENT !== "production") {
      throw new Error("Twenty sales outcomes require production destinations");
    }
    const result = await processTwentySalesOutcome(
      payload,
      createTwentySalesOutcomeDependencies(process.env),
    );
    logger.info("Twenty sales outcome processed", {
      eventId: payload.eventId,
      opportunityId: payload.opportunityId,
      ...result,
    });
    return result;
  },
});
