import { applicationAnswersSchema } from "@pulpsense/contracts";
import { z } from "zod";

const submissionIdentitySchema = z
  .object({
    submissionId: z.uuid(),
    token: z.string().min(1).max(4096),
  })
  .strict();

export const applicationSubmissionRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventType: z.literal("application_submitted"),
    funnelId: z.literal("creative-multiplier-sprint"),
    identity: submissionIdentitySchema,
    payload: applicationAnswersSchema,
    sourceUrl: z.url().max(2048),
    referrer: z.url().max(2048).optional(),
    fbp: z.string().max(255).optional(),
    fbc: z.string().max(255).optional(),
  })
  .strict();

export type ApplicationSubmissionRequest = z.infer<
  typeof applicationSubmissionRequestSchema
>;
