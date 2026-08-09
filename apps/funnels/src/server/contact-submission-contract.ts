import {
  CONTACT_SUBMITTED_EVENT,
  FUNNEL_EVENT_SCHEMA_VERSION,
  contactPayloadSchema,
  funnelAttributionSchema,
} from "@pulpsense/contracts";
import { z } from "zod";

const retryIdentitySchema = z
  .object({
    submissionId: z.uuid(),
    token: z.string().min(1).max(4096),
  })
  .strict();

export const contactSubmissionRequestSchema = z
  .object({
    schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
    eventType: z.literal(CONTACT_SUBMITTED_EVENT),
    funnelId: z.literal("creative-multiplier-sprint"),
    attemptId: z.uuid(),
    turnstileToken: z.string().min(1).max(4096),
    retry: retryIdentitySchema.optional(),
    payload: contactPayloadSchema,
    attribution: funnelAttributionSchema,
    sourceUrl: z.url().max(2048),
    referrer: z.url().max(2048).optional(),
    fbp: z.string().max(255).optional(),
    fbc: z.string().max(255).optional(),
    analyticsId: z.uuid().optional(),
  })
  .strict();

export type ContactSubmissionRequest = z.infer<
  typeof contactSubmissionRequestSchema
>;
