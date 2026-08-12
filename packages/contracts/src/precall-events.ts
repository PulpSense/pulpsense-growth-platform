import { z } from "zod";

export const precallOptOutEventSchema = z
  .object({
    eventType: z.literal("precall_opted_out"),
    eventId: z.string().min(1).max(500),
    submissionId: z.string().uuid(),
    email: z.string().email().max(320),
    sequenceId: z.string().min(1).max(500),
    occurredAt: z.string().datetime({ offset: true }),
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

export type PrecallOptOutEvent = z.infer<typeof precallOptOutEventSchema>;
