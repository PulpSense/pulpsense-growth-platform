import {
  aiSeoApplicationAnswersSchema,
  applicationAnswersSchema,
} from "@pulpsense/contracts";
import { z } from "zod";

const submissionIdentitySchema = z
  .object({
    submissionId: z.uuid(),
    token: z.string().min(1).max(4096),
  })
  .strict();

const applicationSubmissionRequestBase = z
  .object({
    schemaVersion: z.literal(1),
    eventType: z.literal("application_submitted"),
    identity: submissionIdentitySchema,
    sourceUrl: z.url().max(2048),
    referrer: z.url().max(2048).optional(),
    fbp: z.string().max(255).optional(),
    fbc: z.string().max(255).optional(),
    analyticsId: z.uuid().optional(),
  })
  .strict();

export const applicationSubmissionRequestSchema = z.discriminatedUnion(
  "funnelId",
  [
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("creative-multiplier-sprint"),
      payload: applicationAnswersSchema,
    }),
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("ai-seo"),
      payload: aiSeoApplicationAnswersSchema,
    }),
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("ai-seo-dentists"),
      payload: aiSeoApplicationAnswersSchema,
    }),
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("ai-seo-dental-implants"),
      payload: aiSeoApplicationAnswersSchema,
    }),
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("ai-seo-plastic-surgery"),
      payload: aiSeoApplicationAnswersSchema,
    }),
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("ai-seo-hair-restoration"),
      payload: aiSeoApplicationAnswersSchema,
    }),
    applicationSubmissionRequestBase.extend({
      funnelId: z.literal("ai-seo-med-spas"),
      payload: aiSeoApplicationAnswersSchema,
    }),
  ],
);

export type ApplicationSubmissionRequest = z.infer<
  typeof applicationSubmissionRequestSchema
>;
