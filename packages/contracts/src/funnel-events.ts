import { z } from "zod";

export const FUNNEL_EVENT_SCHEMA_VERSION = 1 as const;
export const CONTACT_SUBMITTED_EVENT = "contact_submitted" as const;
export const APPLICATION_SUBMITTED_EVENT = "application_submitted" as const;
export const BOOKING_COMPLETED_EVENT = "booking_completed" as const;
export const BOOKING_RESCHEDULED_EVENT = "booking_rescheduled" as const;
export const BOOKING_CANCELLED_EVENT = "booking_cancelled" as const;

export const funnelIdSchema = z.enum([
  "ai-seo",
  "ai-seo-dentists",
  "ai-seo-dental-implants",
  "ai-seo-plastic-surgery",
  "ai-seo-hair-restoration",
  "ai-seo-med-spas",
  "creative-multiplier-sprint",
]);

export type FunnelId = z.infer<typeof funnelIdSchema>;

const attributionTouchSchema = z
  .object({
    utmSource: z.string().trim().max(200).optional(),
    utmMedium: z.string().trim().max(200).optional(),
    utmCampaign: z.string().trim().max(200).optional(),
    utmContent: z.string().trim().max(200).optional(),
    utmTerm: z.string().trim().max(200).optional(),
    gclid: z.string().trim().max(500).optional(),
    fbclid: z.string().trim().max(500).optional(),
    msclkid: z.string().trim().max(500).optional(),
    ttclid: z.string().trim().max(500).optional(),
    liFatId: z.string().trim().max(500).optional(),
    landingPage: z.url().max(2048).optional(),
    referrer: z.url().max(2048).optional(),
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
    lastName: z.string().trim().max(100).optional().default(""),
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
    analyticsId: z.uuid().optional(),
  })
  .strict();

export const contactSubmittedEventSchema = z
  .object({
    schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
    eventType: z.literal(CONTACT_SUBMITTED_EVENT),
    funnelId: funnelIdSchema,
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

export const aiSeoApplicationAnswersSchema = z
  .object({
    businessOwner: z.literal("yes"),
    marketingBudget: z.enum([
      "$500–$1,500/month",
      "$1,500+/month",
      "Under $500/month or not set yet",
    ]),
    investmentIntent: z.enum([
      "Yes, if the numbers make sense",
      "Maybe—I’m exploring options",
      "No, I’m only looking for free information",
    ]),
  })
  .strict();

const applicationSubmittedEventBase = z
  .object({
    schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
    eventType: z.literal(APPLICATION_SUBMITTED_EVENT),
    submissionId: z.string().uuid(),
    eventId: z.string().min(1).max(200),
    occurredAt: z.string().datetime({ offset: true }),
    qualificationStatus: z.enum(["qualified", "unqualified"]),
    companyDomain: z.string().min(1).max(253),
    bookingLink: z.url().max(8192).optional(),
    attribution: funnelAttributionSchema,
    requestContext: requestContextSchema,
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

const bookingDetailsSchema = z
  .object({
    uid: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
    attendeeTimeZone: z.string().trim().min(1).max(100),
    meetingUrl: z.url().max(2048),
    internalBookingUrl: z.url().max(2048).optional(),
  })
  .strict();

const verifiedBookingPayloadSchema = contactPayloadSchema.extend({
  emailVerification: z
    .object({
      status: z.literal("verified"),
      result: z.literal("business"),
    })
    .strict(),
  booking: bookingDetailsSchema,
});

const bookingLifecycleEventBase = z.object({
  schemaVersion: z.literal(FUNNEL_EVENT_SCHEMA_VERSION),
  funnelId: funnelIdSchema,
  submissionId: z.string().uuid(),
  eventId: z.string().min(1).max(500),
  occurredAt: z.string().datetime({ offset: true }),
  qualificationStatus: z.literal("qualified"),
  attribution: funnelAttributionSchema,
  requestContext: requestContextSchema,
  environment: z.enum(["local", "preview", "production"]),
});

export const applicationSubmittedEventSchema = z.discriminatedUnion(
  "funnelId",
  [
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("creative-multiplier-sprint"),
      payload: verifiedContactPayloadSchema.extend({
        application: applicationAnswersSchema,
      }),
    }),
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("ai-seo"),
      payload: verifiedContactPayloadSchema.extend({
        application: aiSeoApplicationAnswersSchema,
      }),
      qualificationStatus: z.enum(["qualified", "unqualified"]),
    }),
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("ai-seo-dentists"),
      payload: verifiedContactPayloadSchema.extend({
        application: aiSeoApplicationAnswersSchema,
      }),
      qualificationStatus: z.enum(["qualified", "unqualified"]),
    }),
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("ai-seo-dental-implants"),
      payload: verifiedContactPayloadSchema.extend({
        application: aiSeoApplicationAnswersSchema,
      }),
      qualificationStatus: z.enum(["qualified", "unqualified"]),
    }),
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("ai-seo-plastic-surgery"),
      payload: verifiedContactPayloadSchema.extend({
        application: aiSeoApplicationAnswersSchema,
      }),
      qualificationStatus: z.enum(["qualified", "unqualified"]),
    }),
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("ai-seo-hair-restoration"),
      payload: verifiedContactPayloadSchema.extend({
        application: aiSeoApplicationAnswersSchema,
      }),
      qualificationStatus: z.enum(["qualified", "unqualified"]),
    }),
    applicationSubmittedEventBase.extend({
      funnelId: z.literal("ai-seo-med-spas"),
      payload: verifiedContactPayloadSchema.extend({
        application: aiSeoApplicationAnswersSchema,
      }),
      qualificationStatus: z.enum(["qualified", "unqualified"]),
    }),
  ],
);

export const bookingCompletedEventSchema = z
  .object({
    ...bookingLifecycleEventBase.shape,
    eventType: z.literal(BOOKING_COMPLETED_EVENT),
    payload: verifiedBookingPayloadSchema,
  })
  .strict()
  .refine(
    (event) =>
      event.eventId === `booking_completed:${event.payload.booking.uid}`,
    { path: ["eventId"], message: "Booking event ID must match the Cal UID" },
  );

export const bookingRescheduledEventSchema = z
  .object({
    ...bookingLifecycleEventBase.shape,
    eventType: z.literal(BOOKING_RESCHEDULED_EVENT),
    payload: verifiedBookingPayloadSchema.extend({
      booking: bookingDetailsSchema.extend({
        previousUid: z.string().trim().min(1).max(200),
        previousStartTime: z.string().datetime({ offset: true }),
        previousEndTime: z.string().datetime({ offset: true }),
      }),
    }),
  })
  .strict()
  .refine(
    (event) =>
      event.eventId === `booking_rescheduled:${event.payload.booking.uid}`,
    {
      path: ["eventId"],
      message: "Reschedule event ID must match the replacement Cal UID",
    },
  );

export const bookingCancelledEventSchema = z
  .object({
    ...bookingLifecycleEventBase.shape,
    eventType: z.literal(BOOKING_CANCELLED_EVENT),
    payload: verifiedBookingPayloadSchema.extend({
      booking: bookingDetailsSchema.extend({
        cancellationReason: z.string().trim().max(2000).optional(),
      }),
    }),
  })
  .strict()
  .refine(
    (event) =>
      event.eventId === `booking_cancelled:${event.payload.booking.uid}`,
    {
      path: ["eventId"],
      message: "Cancellation event ID must match the Cal UID",
    },
  );

export const funnelEventSchema = z.discriminatedUnion("eventType", [
  contactSubmittedEventSchema,
  applicationSubmittedEventSchema,
  bookingCompletedEventSchema,
  bookingRescheduledEventSchema,
  bookingCancelledEventSchema,
]);

export type ApplicationAnswers = z.infer<typeof applicationAnswersSchema>;
export type AiSeoApplicationAnswers = z.infer<
  typeof aiSeoApplicationAnswersSchema
>;
export type ApplicationSubmittedEvent = z.infer<
  typeof applicationSubmittedEventSchema
>;
export type BookingCompletedEvent = z.infer<typeof bookingCompletedEventSchema>;
export type BookingRescheduledEvent = z.infer<
  typeof bookingRescheduledEventSchema
>;
export type BookingCancelledEvent = z.infer<typeof bookingCancelledEventSchema>;
export type FunnelEvent = z.infer<typeof funnelEventSchema>;
