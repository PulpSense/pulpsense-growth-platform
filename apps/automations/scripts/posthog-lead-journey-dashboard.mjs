import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_PERSON_PROPERTIES = [
  "email",
  "name",
  "phone",
  "company_domain",
  "twenty_person_id",
  "funnel_id",
  "lead_journey_id",
  "last_utm_source",
  "last_utm_medium",
  "last_utm_campaign",
];

const journeyProperties = [
  "submission_id",
  "funnel_id",
  "first_utm_source",
  "last_utm_source",
  "$session_id",
];
const outcomeProperties = [
  "originating_lead_journey_id",
  "twenty_person_id",
  "twenty_opportunity_id",
  "amount",
  "currency",
];

const lifecycleEventProperties = {
  funnel_contact_submitted: journeyProperties,
  funnel_application_submitted: [...journeyProperties, "qualification_status"],
  funnel_booking_completed: journeyProperties,
  funnel_booking_rescheduled: journeyProperties,
  funnel_booking_cancelled: journeyProperties,
};

export const SALES_EVENT_PROPERTIES = Object.freeze({
  sale_completed: ["outcome"],
  sale_lost: ["outcome"],
  sale_revenue_adjusted: ["outcome"],
  sale_outcome_corrected: ["previous_outcome", "corrected_outcome"],
});

export const SALES_EVENTS = Object.freeze(Object.keys(SALES_EVENT_PROPERTIES));
const salesEventSet = new Set(SALES_EVENTS);

export const REQUIRED_EVENT_PROPERTIES = Object.freeze({
  ...lifecycleEventProperties,
  ...Object.fromEntries(
    SALES_EVENTS.map((event) => [
      event,
      [...outcomeProperties, ...SALES_EVENT_PROPERTIES[event]],
    ]),
  ),
});

export const REQUIRED_EVENTS = Object.freeze(
  Object.keys(REQUIRED_EVENT_PROPERTIES),
);

const REQUIRED_SALES_RELATIONSHIPS = [
  "prospectIdHash",
  "originatingLeadJourneyId",
  "twentyPersonId",
  "twentyOpportunityId",
  "amount",
  "currency",
];

export const MANAGED_DASHBOARD = Object.freeze({
  name: "Lead Journey Investigation",
  tags: ["managed", "lead-journey"],
  insightKeyPrefix: "managed-key:",
  emailVariableName: "Prospect email",
  emailVariablePlaceholder: "prospect_email",
});

export function validateProductionEvidence(evidence) {
  const errors = [];
  if (evidence.projectId === undefined) errors.push("projectId is required");
  if (!evidence.validatedAt) errors.push("validatedAt is required");
  for (const event of REQUIRED_EVENTS) {
    const observedEvent = evidence.events?.[event];
    if (!observedEvent?.observed) {
      errors.push(`event ${event} has not been observed in production`);
    }
    for (const name of REQUIRED_EVENT_PROPERTIES[event]) {
      const property = observedEvent?.properties?.[name];
      if (!property?.observed || !property.type) {
        errors.push(
          `event ${event} property ${name} lacks a production-observed type`,
        );
      }
    }
    if (observedEvent?.observed && salesEventSet.has(event)) {
      if (observedEvent.validation?.sampleMatchCount !== 1) {
        errors.push(
          `event ${event} validation sample must appear exactly once`,
        );
      }
      for (const name of REQUIRED_SALES_RELATIONSHIPS) {
        const value = observedEvent.validation?.expected?.[name];
        if (
          (name === "amount" && typeof value !== "number") ||
          (name !== "amount" && (typeof value !== "string" || !value))
        ) {
          errors.push(
            `event ${event} validation relationship ${name} is missing`,
          );
        }
      }
    }
  }
  for (const name of REQUIRED_PERSON_PROPERTIES) {
    const property = evidence.personProperties?.[name];
    if (!property?.observed || !property.type) {
      errors.push(`person property ${name} lacks a production-observed type`);
    }
  }
  for (const check of [
    "emailLookup",
    "anonymousHistoryMerged",
    "multipleJourneys",
    "sessionReplayLinks",
    "networkPayloadCapture",
    "bookingIdentity",
    "terminalOutcomeIdentity",
  ]) {
    if (evidence.checks?.[check] !== true)
      errors.push(`check ${check} is not validated`);
  }
  return errors;
}

export function buildDashboardPlan(evidence) {
  const errors = validateProductionEvidence(evidence);
  if (errors.length) {
    throw new Error(
      `Production evidence is incomplete:\n- ${errors.join("\n- ")}`,
    );
  }
  const emailVariable = `{variables.${MANAGED_DASHBOARD.emailVariablePlaceholder}}`;
  const resolveProspect = `(SELECT argMax(distinct_id, timestamp) FROM events WHERE lower(person.properties.email) = lower(${emailVariable}) AND startsWith(distinct_id, 'prospect_v1_'))`;
  const resolvePersonRow = `(SELECT person.id FROM events WHERE distinct_id = resolved_prospect_id LIMIT 1)`;
  const resolvedIdentity = `WITH ${resolveProspect} AS resolved_prospect_id, ${resolvePersonRow} AS resolved_person_row_id`;
  const salesEventList = SALES_EVENTS.map((event) => `'${event}'`).join(", ");
  return {
    dashboard: {
      name: MANAGED_DASHBOARD.name,
      description:
        "Managed from apps/automations/scripts/posthog-lead-journey-dashboard.mjs. Search a Prospect by current email, then inspect immutable journey and outcome facts.",
      tags: MANAGED_DASHBOARD.tags,
    },
    insights: [
      {
        key: "prospect-timeline",
        name: "Prospect timeline and replay sessions",
        query: `${resolvedIdentity} SELECT timestamp, event, resolved_prospect_id AS prospect_id, distinct_id, properties.submission_id AS lead_journey_id, properties.$session_id AS session_id, concat('https://us.posthog.com/project/${evidence.projectId}/replay/', properties.$session_id) AS replay_url, properties AS event_properties FROM events WHERE person.id = resolved_person_row_id ORDER BY timestamp DESC`,
      },
      {
        key: "current-prospect",
        name: "Current mutable Prospect properties",
        query: `${resolvedIdentity} SELECT resolved_prospect_id AS prospect_id, properties.email AS email, properties.name AS name, properties.phone AS phone, properties.company_domain AS company_domain, properties.twenty_person_id AS twenty_person_id, properties.funnel_id AS current_funnel_id, properties.lead_journey_id AS current_lead_journey_id, properties.last_utm_source AS current_utm_source, properties.last_utm_medium AS current_utm_medium, properties.last_utm_campaign AS current_utm_campaign FROM persons WHERE id = resolved_person_row_id`,
      },
      {
        key: "journey-attribution",
        name: "Immutable Journey Attribution",
        query: `${resolvedIdentity} SELECT properties.submission_id AS lead_journey_id, min(timestamp) AS started_at, argMin(properties.funnel_id, timestamp) AS funnel_id, argMin(properties.first_utm_source, timestamp) AS first_utm_source, argMin(properties.last_utm_source, timestamp) AS accepted_last_utm_source FROM events WHERE person.id = resolved_person_row_id AND event IN ('funnel_contact_submitted', 'funnel_application_submitted') AND properties.submission_id IS NOT NULL GROUP BY lead_journey_id ORDER BY started_at DESC`,
      },
      {
        key: "sales-history",
        name: "Immutable sales and revenue history",
        query: `${resolvedIdentity} SELECT timestamp, event, resolved_prospect_id AS prospect_id, distinct_id, properties.originating_lead_journey_id AS lead_journey_id, properties.twenty_person_id AS twenty_person_id, properties.twenty_opportunity_id AS opportunity_id, properties.amount AS amount, properties.currency AS currency, properties.outcome AS outcome, properties.previous_outcome AS previous_outcome, properties.corrected_outcome AS corrected_outcome FROM events WHERE person.id = resolved_person_row_id AND event IN (${salesEventList}) ORDER BY timestamp DESC`,
      },
    ],
  };
}

export async function reconcileDashboard({ evidence, api, existing }) {
  const plan = buildDashboardPlan(evidence);
  const variable =
    existing.variable ??
    (await api.createVariable({
      name: MANAGED_DASHBOARD.emailVariableName,
      type: "String",
      default_value: "",
    }));
  const dashboard = existing.dashboard
    ? await api.updateDashboard(existing.dashboard.id, plan.dashboard)
    : await api.createDashboard(plan.dashboard);
  const managedInsights = [];
  for (const insight of plan.insights) {
    const found = existing.insights?.find(
      (candidate) => candidate.key === insight.key,
    );
    const payload = {
      name: insight.name,
      tags: [
        ...MANAGED_DASHBOARD.tags,
        `${MANAGED_DASHBOARD.insightKeyPrefix}${insight.key}`,
      ],
      dashboards: [dashboard.id],
      query: {
        kind: "HogQLVisualizationNode",
        source: {
          kind: "HogQLQuery",
          query: insight.query.replaceAll(
            `{variables.${MANAGED_DASHBOARD.emailVariablePlaceholder}}`,
            `{variables.${variable.code_name}}`,
          ),
          variables: {
            [variable.id]: {
              code_name: variable.code_name,
              variableId: variable.id,
              value: "",
            },
          },
        },
        chartSettings: { type: "table" },
      },
    };
    const managed = found
      ? await api.updateInsight(found.id, payload)
      : await api.createInsight(payload);
    managedInsights.push({ key: insight.key, id: managed.id });
  }
  return { dashboard, variable, insights: managedInsights };
}

const requestJson = async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`PostHog API failed (${response.status})`);
  return response.json();
};

export function createPostHogDashboardApi({ host, projectId, personalApiKey }) {
  const base = `${host.replace(/\/+$/u, "")}/api/projects/${projectId}`;
  const headers = {
    Authorization: `Bearer ${personalApiKey}`,
    "Content-Type": "application/json",
  };
  const write = (path, method, body) =>
    requestJson(`${base}${path}`, {
      method,
      headers,
      body: JSON.stringify(body),
    });
  const readAll = async (path) => {
    const results = [];
    let next = `${base}${path}`;
    while (next) {
      const page = await requestJson(next, { headers });
      results.push(...(page.results ?? []));
      next = page.next;
    }
    return results;
  };
  return {
    async discover() {
      const [dashboards, insights, variables] = await Promise.all([
        readAll(
          `/dashboards/?search=${encodeURIComponent(MANAGED_DASHBOARD.name)}`,
        ),
        readAll("/insights/?limit=100"),
        readAll("/insight_variables/?limit=100"),
      ]);
      return {
        dashboard: dashboards.find(
          (item) => item.name === MANAGED_DASHBOARD.name,
        ),
        variable: variables.find(
          (item) => item.name === MANAGED_DASHBOARD.emailVariableName,
        ),
        insights: insights.flatMap((item) => {
          const tag = item.tags?.find((value) =>
            value.startsWith(MANAGED_DASHBOARD.insightKeyPrefix),
          );
          return tag
            ? [
                {
                  id: item.id,
                  key: tag.slice(MANAGED_DASHBOARD.insightKeyPrefix.length),
                },
              ]
            : [];
        }),
      };
    },
    createDashboard: (body) => write("/dashboards/", "POST", body),
    updateDashboard: (id, body) => write(`/dashboards/${id}/`, "PATCH", body),
    createInsight: (body) => write("/insights/", "POST", body),
    updateInsight: (id, body) => write(`/insights/${id}/`, "PATCH", body),
    createVariable: (body) => write("/insight_variables/", "POST", body),
  };
}

async function main() {
  const evidencePath = process.argv[2];
  if (!evidencePath)
    throw new Error(
      "usage: node posthog-lead-journey-dashboard.mjs <evidence.json>",
    );
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  buildDashboardPlan(evidence);
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!personalApiKey) throw new Error("POSTHOG_PERSONAL_API_KEY is required");
  const api = createPostHogDashboardApi({
    host: process.env.POSTHOG_APP_HOST ?? "https://us.posthog.com",
    projectId: evidence.projectId,
    personalApiKey,
  });
  const managed = await reconcileDashboard({
    evidence,
    api,
    existing: await api.discover(),
  });
  console.log(
    JSON.stringify(
      {
        dashboardId: managed.dashboard.id,
        variableId: managed.variable.id,
        insightIds: Object.fromEntries(
          managed.insights.map(({ key, id }) => [key, id]),
        ),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
