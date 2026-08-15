import { z } from "zod";

export const LEAD_MAGNET_EVENT_SCHEMA_VERSION = 1 as const;

export const leadMagnetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const leadMagnetOptInEventSchema = z
  .object({
    schemaVersion: z.literal(LEAD_MAGNET_EVENT_SCHEMA_VERSION),
    eventType: z.literal("lead_magnet_opted_in"),
    magnetId: leadMagnetIdSchema,
    deliveryId: z.uuid(),
    occurredAt: z.string().datetime({ offset: true }),
    firstName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(320),
    emailContent: z
      .object({
        subject: z.string().trim().min(1).max(998),
        text: z.string().min(1).max(100_000),
        html: z.string().min(1).max(100_000),
      })
      .strict(),
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

export type LeadMagnetOptInEvent = z.infer<typeof leadMagnetOptInEventSchema>;
