import { z } from "zod";

export const FUNNEL_EVENT_SCHEMA_VERSION = 1 as const;
export const CONTACT_SUBMITTED_EVENT = "contact_submitted" as const;

const attributionTouchSchema = z
  .object({
    utmSource: z.string().trim().max(200).optional(),
    utmMedium: z.string().trim().max(200).optional(),
    utmCampaign: z.string().trim().max(200).optional(),
    utmContent: z.string().trim().max(200).optional(),
    utmTerm: z.string().trim().max(200).optional(),
  })
  .strict();

export const funnelAttributionSchema = z
  .object({
    firstTouch: attributionTouchSchema,
    lastTouch: attributionTouchSchema,
  })
  .strict();

export const contactPayloadSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: z.string().trim().min(7).max(40),
  })
  .strict();

export const contactSubmittedEventSchema = z
  .object({
    schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
    eventType: z.literal(CONTACT_SUBMITTED_EVENT),
    funnelId: z.literal("creative-multiplier-sprint"),
    submissionId: z.string().uuid(),
    eventId: z.string().min(1).max(200),
    occurredAt: z.string().datetime({ offset: true }),
    payload: contactPayloadSchema.extend({
      emailVerification: z
        .object({
          status: z.enum(["verified", "unverified"]),
          result: z.enum(["business", "catch_all", "provider_error"]),
        })
        .strict(),
    }),
    attribution: funnelAttributionSchema,
    requestContext: z
      .object({
        clientIp: z.string().min(1).max(100),
        userAgent: z.string().max(1024),
        sourceUrl: z.string().url().max(2048),
        referrer: z.string().url().max(2048).optional(),
        fbp: z.string().max(255).optional(),
        fbc: z.string().max(255).optional(),
      })
      .strict(),
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

export type ContactSubmittedEvent = z.infer<typeof contactSubmittedEventSchema>;
