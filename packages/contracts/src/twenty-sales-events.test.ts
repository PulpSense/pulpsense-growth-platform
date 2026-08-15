import { describe, expect, it } from "vitest";

import { twentySalesWebhookEventSchema } from "./twenty-sales-events";

describe("Twenty sales webhook contract", () => {
  it("accepts a production opportunity update with stable CRM references", () => {
    expect(
      twentySalesWebhookEventSchema.parse({
        schemaVersion: 1,
        eventId: "twenty:webhook-1:opportunity-1:2026-08-15T10:00:00.000Z",
        occurredAt: "2026-08-15T10:00:00.000Z",
        workspaceId: "workspace-production",
        opportunityId: "opportunity-1",
        personId: "person-1",
        prospectId: `prospect_v1_${"a".repeat(64)}`,
        originatingLeadJourneyId: "8be0f734-f3c9-4c8c-b4f8-7897f6285f12",
        stageId: "stage-won",
        amount: 12500,
        currency: "USD",
        updatedFields: ["stage"],
        environment: "production",
      }),
    ).toMatchObject({ stageId: "stage-won", amount: 12500 });
  });

  it("rejects records without Person and originating Journey references", () => {
    expect(
      twentySalesWebhookEventSchema.safeParse({
        schemaVersion: 1,
        eventId: "event",
        occurredAt: "2026-08-15T10:00:00.000Z",
        workspaceId: "workspace-production",
        opportunityId: "opportunity-1",
        personId: "",
        stageId: "stage-won",
        amount: 12500,
        currency: "USD",
        updatedFields: ["stage"],
        environment: "production",
      }).success,
    ).toBe(false);
  });
});
