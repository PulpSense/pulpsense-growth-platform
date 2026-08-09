import { z } from "zod";

export const FUNNEL_EVENT_SCHEMA_VERSION = 1 as const;
export const CONTACT_SUBMITTED_EVENT = "contact_submitted" as const;
export const APPLICATION_SUBMITTED_EVENT = "application_submitted" as const;
export const BOOKING_COMPLETED_EVENT = "booking_completed" as const;

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

const emailVerificationSchema = z
  .object({
    status: z.enum(["verified", "unverified"]),
    result: z.enum(["business", "catch_all", "provider_error"]),
  })
  .strict();

const verifiedContactPayloadSchema = contactPayloadSchema.extend({
  emailVerification: emailVerificationSchema,
});

const requestContextSchema = z
  .object({
    clientIp: z.string().min(1).max(100),
    userAgent: z.string().max(1024),
    sourceUrl: z.string().url().max(2048),
    referrer: z.string().url().max(2048).optional(),
    fbp: z.string().max(255).optional(),
    fbc: z.string().max(255).optional(),
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
    payload: verifiedContactPayloadSchema,
    attribution: funnelAttributionSchema,
    requestContext: requestContextSchema,
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

export type ContactSubmittedEvent = z.infer<typeof contactSubmittedEventSchema>;

export const applicationAnswersSchema = z
  .object({
    brandUrl: z.url().max(2048),
    paidSocialSpend: z.enum([
      "Less than $20k/month",
      "$20k - $50k/month",
      "$50k - $150k/month",
      "$150k+/month",
    ]),
    winnerStatus: z.enum([
      "Yes, one clear winner",
      "Yes, several winners",
      "Promising ad, not fully proven",
      "No proven winner yet",
    ]),
    platforms: z
      .array(
        z.enum([
          "Meta",
          "TikTok",
          "Reels",
          "Shorts",
          "TikTok Shop",
          "Other paid social",
        ]),
      )
      .min(1),
    deliveryTimeline: z.enum([
      "This week",
      "Next 2 weeks",
      "This month",
      "Just researching",
    ]),
  })
  .strict();

export const applicationSubmittedEventSchema = z
  .object({
    schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
    eventType: z.literal(APPLICATION_SUBMITTED_EVENT),
    funnelId: z.literal("creative-multiplier-sprint"),
    submissionId: z.string().uuid(),
    eventId: z.string().min(1).max(200),
    occurredAt: z.string().datetime({ offset: true }),
    payload: verifiedContactPayloadSchema.extend({
      application: applicationAnswersSchema,
    }),
    qualificationStatus: z.enum(["qualified", "unqualified"]),
    companyDomain: z.string().min(1).max(253),
    attribution: funnelAttributionSchema,
    requestContext: requestContextSchema,
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

export const bookingCompletedEventSchema = z
  .object({
    schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
    eventType: z.literal(BOOKING_COMPLETED_EVENT),
    funnelId: z.literal("creative-multiplier-sprint"),
    submissionId: z.string().uuid(),
    eventId: z.string().min(1).max(300),
    occurredAt: z.string().datetime({ offset: true }),
    payload: contactPayloadSchema.extend({
      emailVerification: z
        .object({
          status: z.literal("verified"),
          result: z.literal("business"),
        })
        .strict(),
      booking: z
        .object({
          uid: z.string().trim().min(1).max(200),
          title: z.string().trim().min(1).max(500),
          startTime: z.string().datetime({ offset: true }),
          endTime: z.string().datetime({ offset: true }),
        })
        .strict(),
    }),
    qualificationStatus: z.literal("qualified"),
    attribution: funnelAttributionSchema,
    requestContext: requestContextSchema,
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict()
  .refine(
    (event) =>
      event.eventId === `booking_completed:${event.payload.booking.uid}`,
    { path: ["eventId"], message: "Booking event ID must match the Cal UID" },
  );

export const funnelEventSchema = z.discriminatedUnion("eventType", [
  contactSubmittedEventSchema,
  applicationSubmittedEventSchema,
  bookingCompletedEventSchema,
]);

export type ApplicationAnswers = z.infer<typeof applicationAnswersSchema>;
export type ApplicationSubmittedEvent = z.infer<
  typeof applicationSubmittedEventSchema
>;
export type BookingCompletedEvent = z.infer<typeof bookingCompletedEventSchema>;
export type FunnelEvent = z.infer<typeof funnelEventSchema>;
