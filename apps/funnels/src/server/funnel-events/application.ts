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
  request.funnelId === "ai-seo"
    ? ("qualified" as const)
    : request.payload.paidSocialSpend === "Less than $20k/month" ||
        request.payload.winnerStatus === "No proven winner yet"
      ? ("unqualified" as const)
      : ("qualified" as const);

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
  const event = applicationSubmittedEventSchema.parse({
    schemaVersion: 1,
    eventType: "application_submitted",
    funnelId: parsed.data.funnelId,
    submissionId,
    eventId,
    occurredAt: new Date().toISOString(),
    payload: {
      ...identity.contact,
      application: parsed.data.payload,
    },
    qualificationStatus,
    companyDomain: emailDomain.trim().toLowerCase().replace(/\.$/u, ""),
    attribution: identity.attribution,
    requestContext,
    environment,
  });

  try {
    const runId = await enqueueFunnelEvent(event, env);
    const bookingEligible =
      qualificationStatus === "qualified" &&
      identity.emailVerification.status === "verified" &&
      identity.emailVerification.result === "business";
    const bookingIdentity = bookingEligible
      ? {
          submissionId,
          token: await createBookingToken(
            {
              submissionId,
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
