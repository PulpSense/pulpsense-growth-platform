import { describe, expect, it, vi } from "vitest";

import {
  buildDashboardPlan,
  createPostHogDashboardApi,
  MANAGED_DASHBOARD,
  REQUIRED_EVENTS,
  REQUIRED_EVENT_PROPERTIES,
  REQUIRED_PERSON_PROPERTIES,
  SALES_EVENTS,
  reconcileDashboard,
} from "./posthog-lead-journey-dashboard.mjs";

const validEvidence = {
  projectId: 549551,
  validatedAt: "2026-08-17T10:00:00Z",
  events: Object.fromEntries(
    REQUIRED_EVENTS.map((event) => [
      event,
      {
        observed: true,
        properties: Object.fromEntries(
          REQUIRED_EVENT_PROPERTIES[event].map((name) => [
            name,
            { observed: true, type: name === "amount" ? "Numeric" : "String" },
          ]),
        ),
        ...(event.startsWith("sale_")
          ? {
              validation: {
                sampleMatchCount: 1,
                expected: {
                  prospectIdHash: "sha256:prospect",
                  originatingLeadJourneyId: "journey-id",
                  twentyPersonId: "person-id",
                  twentyOpportunityId: "opportunity-id",
                  amount: 12500,
                  currency: "USD",
                },
              },
            }
          : {}),
      },
    ]),
  ),
  personProperties: Object.fromEntries(
    REQUIRED_PERSON_PROPERTIES.map((name) => [
      name,
      { observed: true, type: "String" },
    ]),
  ),
  checks: {
    emailLookup: true,
    anonymousHistoryMerged: true,
    multipleJourneys: true,
    sessionReplayLinks: true,
    networkPayloadCapture: true,
    bookingIdentity: true,
    terminalOutcomeIdentity: true,
  },
};

describe("Lead Journey dashboard plan", () => {
  it("fails closed when a dashboard shape was not observed in production", () => {
    const evidence = structuredClone(validEvidence);
    evidence.events.sale_completed.observed = false;
    evidence.checks.sessionReplayLinks = false;
    expect(() => buildDashboardPlan(evidence)).toThrow(
      /event sale_completed.*check sessionReplayLinks/s,
    );
  });

  it("fails closed when a property was not observed on the event that consumes it", () => {
    const evidence = structuredClone(validEvidence);
    evidence.events.sale_completed.properties.amount.observed = false;
    expect(() => buildDashboardPlan(evidence)).toThrow(
      "event sale_completed property amount lacks a production-observed type",
    );
  });

  it("fails closed when a sales validation sample is duplicated or mislinked", () => {
    const evidence = structuredClone(validEvidence);
    evidence.events.sale_completed.validation.sampleMatchCount = 2;
    evidence.events.sale_completed.validation.expected.twentyOpportunityId = "";
    expect(() => buildDashboardPlan(evidence)).toThrow(
      /event sale_completed validation sample must appear exactly once.*twentyOpportunityId is missing/s,
    );
  });

  it("separates current Prospect lookup from immutable journey and outcome views", () => {
    const plan = buildDashboardPlan(validEvidence);
    expect(plan.insights.map(({ key }) => key)).toEqual([
      "prospect-timeline",
      "current-prospect",
      "journey-attribution",
      "sales-history",
    ]);
    for (const insight of plan.insights) {
      expect(insight.query).toContain("AS resolved_prospect_id");
      expect(insight.query).toContain("AS resolved_person_row_id");
      expect(insight.query).toContain("startsWith(distinct_id, 'prospect_v1_')");
      expect(insight.query).not.toContain(
        "WHERE person.properties.email = {variables.prospect_email}",
      );
      expect(insight.query).not.toContain("posthog_person_id");
    }
    expect(plan.insights[0]?.query).toContain(
      "person.id = resolved_person_row_id",
    );
    expect(plan.insights[0]?.query).toContain("replay_url");
    expect(plan.insights[0]?.query).toContain("event_properties");
    expect(plan.insights[0]?.query).toContain(
      "resolved_prospect_id AS prospect_id",
    );
    expect(plan.insights[0]?.query).not.toContain("LIMIT 500");
    expect(plan.insights[0]?.query).not.toContain("INTERVAL 10 YEAR");
    expect(plan.insights[1]?.name).toBe("Current mutable Prospect properties");
    expect(plan.insights[1]?.query).toContain("current_lead_journey_id");
    expect(plan.insights[2]?.query).toContain("GROUP BY lead_journey_id");
    expect(plan.insights[2]?.query).toContain("argMin");
    expect(plan.insights[2]?.query).not.toContain("INTERVAL 10 YEAR");
    expect(plan.insights[3]?.query).toContain("originating_lead_journey_id");
    expect(plan.insights[3]?.query).toContain("twenty_person_id");
    expect(plan.insights[3]?.query).toContain("prospect_id");
    expect(plan.insights[3]?.query).toContain("previous_outcome");
    expect(plan.insights[3]?.query).toContain("corrected_outcome");
    for (const event of SALES_EVENTS) {
      expect(plan.insights[3]?.query).toContain(`'${event}'`);
    }
    expect(plan.insights[3]?.query).not.toContain("INTERVAL 10 YEAR");
  });

  it("updates managed resources instead of creating duplicates", async () => {
    const api = {
      createDashboard: vi.fn(),
      updateDashboard: vi.fn(async (id, value) => ({ id, ...value })),
      createInsight: vi.fn(),
      createVariable: vi.fn(),
      updateInsight: vi.fn(async (id) => ({ id })),
    };
    const managed = await reconcileDashboard({
      evidence: validEvidence,
      api,
      existing: {
        dashboard: { id: 42 },
        variable: { id: "variable-id", code_name: "prospect_email" },
        insights: [
          { id: 1, key: "prospect-timeline" },
          { id: 2, key: "current-prospect" },
          { id: 3, key: "journey-attribution" },
          { id: 4, key: "sales-history" },
        ],
      },
    });
    expect(api.createDashboard).not.toHaveBeenCalled();
    expect(api.createInsight).not.toHaveBeenCalled();
    expect(api.updateInsight).toHaveBeenCalledTimes(4);
    expect(managed).toEqual({
      dashboard: expect.objectContaining({ id: 42 }),
      variable: { id: "variable-id", code_name: "prospect_email" },
      insights: [
        { id: 1, key: "prospect-timeline" },
        { id: 2, key: "current-prospect" },
        { id: 3, key: "journey-attribution" },
        { id: 4, key: "sales-history" },
      ],
    });
    expect(api.updateInsight).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tags: expect.arrayContaining(["managed-key:prospect-timeline"]),
        query: expect.objectContaining({
          source: expect.objectContaining({
            variables: {
              "variable-id": {
                code_name: "prospect_email",
                value: "",
                variableId: "variable-id",
              },
            },
          }),
        }),
      }),
    );
  });

  it("creates the email variable when the managed project variable is missing", async () => {
    const api = {
      createDashboard: vi.fn(async () => ({ id: 42 })),
      updateDashboard: vi.fn(),
      createInsight: vi
        .fn()
        .mockImplementation(async () => ({ id: crypto.randomUUID() })),
      updateInsight: vi.fn(),
      createVariable: vi.fn(async () => ({
        id: "new-variable",
        code_name: "prospect_email",
      })),
    };
    const managed = await reconcileDashboard({
      evidence: validEvidence,
      api,
      existing: { insights: [] },
    });
    expect(api.createVariable).toHaveBeenCalledWith({
      name: MANAGED_DASHBOARD.emailVariableName,
      type: "String",
      default_value: "",
    });
    expect(managed.dashboard.id).toBe(42);
    expect(managed.variable.id).toBe("new-variable");
    expect(managed.insights).toHaveLength(4);
    expect(api.createInsight).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          source: expect.objectContaining({
            variables: expect.objectContaining({
              "new-variable": expect.any(Object),
            }),
          }),
        }),
      }),
    );
  });

  it("discovers every managed insight by tag without relying on display names", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ results: [{ id: 42, name: MANAGED_DASHBOARD.name }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              id: 1,
              name: "Unrelated display name",
              tags: ["managed-key:prospect-timeline"],
            },
            {
              id: 2,
              name: "Another name",
              tags: ["managed-key:sales-history"],
            },
          ],
          next: null,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              id: "variable-id",
              name: MANAGED_DASHBOARD.emailVariableName,
              code_name: "prospect_email",
            },
          ],
          next: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = createPostHogDashboardApi({
      host: "https://us.posthog.test",
      projectId: 123,
      personalApiKey: "secret",
    });
    await expect(api.discover()).resolves.toMatchObject({
      dashboard: { id: 42 },
      variable: { id: "variable-id" },
      insights: [
        { id: 1, key: "prospect-timeline" },
        { id: 2, key: "sales-history" },
      ],
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://us.posthog.test/api/projects/123/insights/?limit=100",
    );
    vi.unstubAllGlobals();
  });
});
