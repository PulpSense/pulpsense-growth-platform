import { applicationSubmittedEventSchema } from "@pulpsense/contracts";

import {
  applicationSubmissionRequestSchema,
  type ApplicationSubmissionRequest,
} from "../application-submission-contract";
import type { FunnelEnv } from "../funnel-env";
import { getClientIp, json } from "../http";
import { consumeRateLimit } from "../rate-limit";
import { enqueueFunnelEvent } from "./delivery";
import { createBookingToken, readRetryToken } from "./submission-identity";
import { createRequestContext } from "./request-context";

const determineQualificationStatus = (request: ApplicationSubmissionRequest) =>
  ("marketingBudget" in request.payload &&
    request.payload.marketingBudget === "Under $500/month or not set yet") ||
  ("investmentIntent" in request.payload &&
    request.payload.investmentIntent ===
      "No, I’m only looking for free information")
    ? ("unqualified" as const)
    : ("qualified" as const);

const createCalBookingLink = (
  configuredLink: string | undefined,
  bookingIdentity: { submissionId: string; token: string },
  contact: { firstName: string; lastName?: string; email: string },
) => {
  const trimmedLink = configuredLink?.trim();
  if (!trimmedLink) return undefined;
  const url = new URL(
    /^https?:\/\//u.test(trimmedLink)
      ? trimmedLink
      : `https://cal.com/${trimmedLink.replace(/^\/+|\/+$/gu, "")}`,
  );
  url.searchParams.set(
    "name",
    [contact.firstName, contact.lastName].filter(Boolean).join(" "),
  );
  url.searchParams.set("email", contact.email);
  url.searchParams.set(
    "metadata[pulpsenseSubmissionId]",
    bookingIdentity.submissionId,
  );
  url.searchParams.set(
    "metadata[pulpsenseBookingToken]",
    bookingIdentity.token,
  );
  return url.toString();
};

export async function processApplicationSubmission(
  body: unknown,
  request: Request,
  env: FunnelEnv,
) {
  const parsed = applicationSubmissionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }

  const clientIp = getClientIp(request);
  const rateLimit = await consumeRateLimit(
    env.FUNNEL_RATE_LIMIT_SERVICE,
    `application:${clientIp}`,
  );
  if (rateLimit === "unavailable") {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }
  if (rateLimit === "limited") {
    return json({ error: "rate_limited" }, 429);
  }
  if (!env.SUBMISSION_SIGNING_SECRET || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
    return json({ error: "handoff_unavailable" }, 503);
  }

  const identity = await readRetryToken(
    parsed.data.identity.token,
    env.SUBMISSION_SIGNING_SECRET,
  );
  if (
    !identity ||
    identity.submissionId !== parsed.data.identity.submissionId
  ) {
    return json({ error: "invalid_submission_identity" }, 400);
  }
  const qualificationStatus = determineQualificationStatus(parsed.data);
  const submissionId = identity.submissionId;
  const eventId = `application_submitted:${submissionId}`;
  const emailDomain = identity.contact.email.split("@").at(-1);
  if (!emailDomain) {
    return json({ error: "invalid_submission_identity" }, 400);
  }

  const environment = env.PULPSENSE_ENVIRONMENT ?? "local";
  const requestContext = createRequestContext(request, clientIp, parsed.data);
  const bookingEligible =
    qualificationStatus === "qualified" &&
    ((identity.emailVerification.status === "verified" &&
      identity.emailVerification.result === "business") ||
      identity.emailVerification.result === "catch_all" ||
      identity.emailVerification.result === "provider_error");
  const bookingIdentity = bookingEligible
    ? {
        submissionId,
        token: await createBookingToken(
          {
            submissionId,
            prospectId: identity.prospectId,
            funnelId: parsed.data.funnelId,
            qualificationStatus: "qualified",
            contact: {
              ...identity.contact,
              emailVerification: {
                status: "verified",
                result: "business",
              },
            },
            attribution: identity.attribution,
            requestContext,
            environment,
          },
          env.SUBMISSION_SIGNING_SECRET,
        ),
      }
    : undefined;
  const bookingLink = bookingIdentity
    ? createCalBookingLink(
        env.CAL_BOOKING_LINK,
        bookingIdentity,
        identity.contact,
      )
    : undefined;
  const event = applicationSubmittedEventSchema.parse({
    schemaVersion: 1,
    eventType: "application_submitted",
    funnelId: parsed.data.funnelId,
    submissionId,
    prospectId: identity.prospectId,
    eventId,
    occurredAt: new Date().toISOString(),
    payload: {
      ...identity.contact,
      application: parsed.data.payload,
    },
    qualificationStatus,
    companyDomain: emailDomain.trim().toLowerCase().replace(/\.$/u, ""),
    ...(bookingLink ? { bookingLink } : {}),
    attribution: identity.attribution,
    requestContext,
    environment,
  });

  try {
    const runId = await enqueueFunnelEvent(event, env);
    return json({
      accepted: true,
      submissionId,
      eventId,
      qualificationStatus,
      nextStep: bookingEligible ? "booking" : "unqualified",
      ...(bookingIdentity ? { bookingIdentity } : {}),
      runId,
    });
  } catch {
    return json(
      {
        accepted: false,
        error: "handoff_failed",
        submissionId,
        eventId,
        qualificationStatus,
      },
      502,
    );
  }
}
