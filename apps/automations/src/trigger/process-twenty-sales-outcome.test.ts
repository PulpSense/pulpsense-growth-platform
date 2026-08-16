import { describe, expect, it, vi } from "vitest";

import {
  createTwentySalesOutcomeDependencies,
  processTwentySalesOutcome,
  type TwentySalesOutcomeDependencies,
} from "./process-twenty-sales-outcome.js";

const baseEvent = {
  schemaVersion: 2 as const,
  eventId: "twenty:webhook-1:opportunity-1:2026-08-15T10:00:00.000Z",
  occurredAt: "2026-08-15T10:00:00.000Z",
  workspaceId: "production-workspace",
  opportunityId: "opportunity-1",
  personId: "person-1",
  prospectId: `prospect_v1_${"a".repeat(64)}`,
  originatingLeadJourneyId: "8be0f734-f3c9-4c8c-b4f8-7897f6285f12",
  stageValue: "stage-won",
  amount: 12500,
  currency: "USD",
  updatedFields: ["stage"],
  environment: "production" as const,
};

const dependencies = () => {
  const capture = vi.fn<TwentySalesOutcomeDependencies["capture"]>();
  return {
    capture,
    resolveStageOptionId: vi.fn(async (stageValue: string) =>
      stageValue === "stage-won"
        ? "won-stage-id"
        : stageValue === "stage-lost"
          ? "lost-stage-id"
          : "intermediate-stage-id",
    ),
    resolveProspectId: vi.fn(async () => baseEvent.prospectId),
    recordOutcome: vi.fn(async () => undefined),
    wonStageId: "won-stage-id",
    lostStageId: "lost-stage-id",
  } satisfies TwentySalesOutcomeDependencies;
};

const stageMetadataResponse = () =>
  Response.json({
    data: {
      objects: {
        edges: [
          {
            node: { id: "opportunity-object-id", nameSingular: "opportunity" },
          },
        ],
      },
      fields: {
        edges: [
          {
            node: {
              name: "stage",
              objectMetadataId: "opportunity-object-id",
              options: [
                { id: "won-stage-id", value: "stage-won" },
                { id: "lost-stage-id", value: "stage-lost" },
              ],
            },
          },
        ],
      },
    },
  });

describe("Twenty terminal sales outcome processing", () => {
  it("emits one completed sale when an Opportunity enters the won stage", async () => {
    const deps = dependencies();
    await expect(processTwentySalesOutcome(baseEvent, deps)).resolves.toEqual({
      emitted: "sale_completed",
    });
    expect(deps.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "sale_completed",
        distinctId: baseEvent.prospectId,
        insertId: `sale_completed:${baseEvent.opportunityId}`,
        properties: expect.objectContaining({
          amount: 12500,
          currency: "USD",
          twenty_person_id: "person-1",
          twenty_opportunity_id: "opportunity-1",
        }),
      }),
    );
  });

  it("emits a lost sale when an Opportunity enters the lost stage", async () => {
    const deps = dependencies();
    const result = await processTwentySalesOutcome(
      { ...baseEvent, stageValue: "stage-lost" },
      deps,
    );
    expect(result).toEqual({ emitted: "sale_lost" });
  });

  it("ignores intermediate Opportunity updates", async () => {
    const deps = dependencies();
    const result = await processTwentySalesOutcome(
      { ...baseEvent, stageValue: "stage-negotiation" },
      deps,
    );
    expect(result).toEqual({ emitted: null, ignored: "intermediate_stage" });
    expect(deps.capture).not.toHaveBeenCalled();
  });

  it("emits a revenue adjustment without replacing the completed sale", async () => {
    const deps = dependencies();
    const event = {
      ...baseEvent,
      eventId: "twenty:webhook-1:opportunity-1:adjusted",
      updatedFields: ["amount"],
      amount: 15000,
    };
    const result = await processTwentySalesOutcome(event, deps);
    expect(result).toEqual({ emitted: "sale_revenue_adjusted" });
    expect(deps.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "sale_revenue_adjusted",
        insertId: `sale_revenue_adjusted:${event.eventId}`,
      }),
    );
  });

  it("treats a currency-only update to a won sale as a revenue adjustment", async () => {
    const deps = dependencies();
    const result = await processTwentySalesOutcome(
      {
        ...baseEvent,
        eventId: "twenty:webhook-1:opportunity-1:currency-adjusted",
        updatedFields: ["amount.currencyCode"],
        currency: "EUR",
      },
      deps,
    );
    expect(result).toEqual({ emitted: "sale_revenue_adjusted" });
  });

  it("emits a terminal correction with previous and corrected outcomes", async () => {
    const deps = dependencies();
    const event = {
      ...baseEvent,
      eventId: "twenty:webhook-1:opportunity-1:corrected",
      stageValue: "stage-lost",
      previousOutcome: "won" as const,
    };
    const result = await processTwentySalesOutcome(event, deps);
    expect(result).toEqual({ emitted: "sale_outcome_corrected" });
    expect(deps.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "sale_outcome_corrected",
        properties: expect.objectContaining({
          previous_outcome: "won",
          corrected_outcome: "lost",
        }),
      }),
    );
  });

  it("resolves Prospect identity from the Twenty Person when omitted", async () => {
    const deps = dependencies();
    await processTwentySalesOutcome(
      { ...baseEvent, prospectId: undefined },
      deps,
    );
    expect(deps.resolveProspectId).toHaveBeenCalledWith("person-1");
  });

  it("delivers through Twenty and PostHog HTTP boundaries with retry-stable identity", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(stageMetadataResponse())
      .mockResolvedValueOnce(
        Response.json({
          data: { person: { prospectId: baseEvent.prospectId } },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ id: baseEvent.opportunityId }));
    const deps = createTwentySalesOutcomeDependencies(
      {
        TWENTY_API_ORIGIN: "https://twenty.test",
        TWENTY_API_KEY: "twenty-key",
        TWENTY_WON_STAGE_ID: "won-stage-id",
        TWENTY_LOST_STAGE_ID: "lost-stage-id",
        POSTHOG_PROJECT_KEY: "posthog-key",
        POSTHOG_HOST: "https://posthog.test",
      },
      fetchMock,
    );

    await processTwentySalesOutcome(
      { ...baseEvent, prospectId: undefined },
      deps,
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://twenty.test/metadata");
    expect(
      JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body)),
    ).toMatchObject({
      event: "sale_completed",
      properties: {
        distinct_id: baseEvent.prospectId,
        $insert_id: "sale_completed:opportunity-1",
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({
      pulpsenseSalesOutcome: "WON",
    });
  });

  it("reuses the PostHog insert ID when a failed Twenty state write retries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(stageMetadataResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(stageMetadataResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ id: baseEvent.opportunityId }));
    const deps = createTwentySalesOutcomeDependencies(
      {
        TWENTY_API_ORIGIN: "https://twenty.test",
        TWENTY_API_KEY: "twenty-key",
        TWENTY_WON_STAGE_ID: "won-stage-id",
        TWENTY_LOST_STAGE_ID: "lost-stage-id",
        POSTHOG_PROJECT_KEY: "posthog-key",
        POSTHOG_HOST: "https://posthog.test",
      },
      fetchMock,
    );

    await expect(processTwentySalesOutcome(baseEvent, deps)).rejects.toThrow(
      "Twenty sales outcome state write failed (500)",
    );
    await expect(processTwentySalesOutcome(baseEvent, deps)).resolves.toEqual({
      emitted: "sale_completed",
    });

    const firstCapture = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const retryCapture = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body));
    expect(firstCapture.properties.$insert_id).toBe(
      "sale_completed:opportunity-1",
    );
    expect(retryCapture.properties.$insert_id).toBe(
      firstCapture.properties.$insert_id,
    );
  });
});
