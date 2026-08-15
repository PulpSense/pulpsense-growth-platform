import { z } from "zod";

import { prospectIdSchema } from "./funnel-events.js";

export const TWENTY_SALES_EVENT_SCHEMA_VERSION = 1 as const;

export const twentySalesWebhookEventSchema = z
  .object({
    schemaVersion: z.literal(TWENTY_SALES_EVENT_SCHEMA_VERSION),
    eventId: z.string().min(1).max(500),
    occurredAt: z.iso.datetime({ offset: true }),
    workspaceId: z.string().min(1).max(200),
    opportunityId: z.string().min(1).max(200),
    personId: z.string().min(1).max(200),
    prospectId: prospectIdSchema.optional(),
    originatingLeadJourneyId: z.uuid(),
    stageId: z.string().min(1).max(200),
    previousOutcome: z.enum(["won", "lost"]).optional(),
    amount: z.number().finite().nonnegative(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/u),
    updatedFields: z.array(z.string().min(1).max(200)).max(100),
    environment: z.literal("production"),
  })
  .strict();

export type TwentySalesWebhookEvent = z.infer<
  typeof twentySalesWebhookEventSchema
>;
