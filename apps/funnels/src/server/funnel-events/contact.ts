import { contactSubmittedEventSchema } from "@pulpsense/contracts";
import { isBusinessEmail } from "@/utils/businessEmail";

import {
  contactSubmissionRequestSchema,
  type ContactSubmissionRequest,
} from "../contact-submission-contract";
import {
  verifyBusinessEmail,
  type EmailVerification,
} from "../email-verification";
import type { FunnelEnv } from "../funnel-env";
import { getClientIp, json } from "../http";
import { consumeRateLimit } from "../rate-limit";
import { verifyTurnstileForEnvironment } from "../turnstile-verification";
import { enqueueFunnelEvent } from "./delivery";
import { createRequestContext } from "./request-context";
import {
  createRetryToken,
  deriveProspectId,
  deriveSubmissionId,
  digestContactSubmission,
  readRetryToken,
} from "./submission-identity";

type SubmissionIdentity = {
  submissionId: string;
  prospectId: string;
  emailVerification: EmailVerification;
  retryToken: string;
};

const restoreRetryIdentity = async (
  submission: ContactSubmissionRequest,
  requestDigest: string,
  secret: string,
): Promise<SubmissionIdentity | undefined> => {
  if (!submission.retry) return undefined;

  const retryClaims = await readRetryToken(submission.retry.token, secret);
  if (
    !retryClaims ||
    retryClaims.submissionId !== submission.retry.submissionId ||
    retryClaims.requestDigest !== requestDigest
  ) {
    return undefined;
  }

  return {
    submissionId: retryClaims.submissionId,
    prospectId: retryClaims.prospectId,
    emailVerification: retryClaims.emailVerification,
    retryToken: submission.retry.token,
  };
};

export async function processContactSubmission(
  body: unknown,
  request: Request,
  env: FunnelEnv,
) {
  const parsed = contactSubmissionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }

  const clientIp = getClientIp(request);
  const rateLimit = await consumeRateLimit(
    env.FUNNEL_RATE_LIMIT_SERVICE,
    `contact:${clientIp}`,
  );
  if (rateLimit === "unavailable") {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }
  if (rateLimit === "limited") {
    return json({ error: "rate_limited" }, 429);
  }

  const submission = parsed.data;
  const requestDigest = await digestContactSubmission(submission);
  let identity: SubmissionIdentity;

  if (submission.retry) {
    if (!env.SUBMISSION_SIGNING_SECRET || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
      return json({ error: "handoff_unavailable" }, 503);
    }

    const retryIdentity = await restoreRetryIdentity(
      submission,
      requestDigest,
      env.SUBMISSION_SIGNING_SECRET,
    );
    if (!retryIdentity) {
      return json({ error: "invalid_retry_identity" }, 400);
    }
    identity = retryIdentity;
  } else {
    const turnstile = await verifyTurnstileForEnvironment({
      request,
      env,
      token: submission.turnstileToken,
      clientIp,
      expectedAction: "contact_submit",
    });
    if (turnstile === "unavailable") {
      return json({ error: "turnstile_unavailable" }, 503);
    }
    if (turnstile === "rejected") {
      return json({ error: "turnstile_rejected" }, 403);
    }

    if (!isBusinessEmail(submission.payload.email)) {
      return json({ error: "email_invalid" }, 422);
    }
    const verification = await verifyBusinessEmail(
      submission.payload.email,
      env.MILLION_VERIFIER_API_KEY,
    );
    if (verification.status === "invalid") {
      return json({ error: "email_invalid" }, 422);
    }

    if (!env.SUBMISSION_SIGNING_SECRET || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
      return json({ error: "handoff_unavailable" }, 503);
    }
    const submissionId = await deriveSubmissionId(
      submission.attemptId,
      requestDigest,
      env.SUBMISSION_SIGNING_SECRET,
    );
    const contact = contactSubmittedEventSchema.shape.payload.parse({
      ...submission.payload,
      emailVerification: verification,
    });
    const prospectSecret =
      env.PROSPECT_ID_SECRET ??
      ((env.PULPSENSE_ENVIRONMENT ?? "local") !== "production"
        ? env.SUBMISSION_SIGNING_SECRET
        : undefined);
    if (!prospectSecret) {
      return json({ error: "prospect_identity_unavailable" }, 503);
    }
    const prospectId = await deriveProspectId(contact.email, prospectSecret);
    const retryToken = await createRetryToken(
      {
        submissionId,
        prospectId,
        requestDigest,
        emailVerification: verification,
        contact,
        attribution: submission.attribution,
      },
      env.SUBMISSION_SIGNING_SECRET,
    );
    identity = {
      submissionId,
      prospectId,
      emailVerification: verification,
      retryToken,
    };
  }

  const eventId = `contact_submitted:${identity.submissionId}`;
  const event = contactSubmittedEventSchema.parse({
    schemaVersion: 1,
    eventType: "contact_submitted",
    funnelId: submission.funnelId,
    submissionId: identity.submissionId,
    prospectId: identity.prospectId,
    eventId,
    occurredAt: new Date().toISOString(),
    payload: {
      ...submission.payload,
      emailVerification: identity.emailVerification,
    },
    attribution: submission.attribution,
    requestContext: createRequestContext(request, clientIp, submission),
    environment: env.PULPSENSE_ENVIRONMENT ?? "local",
  });

  try {
    const runId = await enqueueFunnelEvent(event, env);

    return json({
      accepted: true,
      submissionId: identity.submissionId,
      prospectId: identity.prospectId,
      eventId,
      runId,
      retry: {
        submissionId: identity.submissionId,
        token: identity.retryToken,
      },
    });
  } catch {
    return json(
      {
        accepted: false,
        error: "handoff_failed",
        submissionId: identity.submissionId,
        eventId,
        retry: {
          submissionId: identity.submissionId,
          token: identity.retryToken,
        },
      },
      502,
    );
  }
}
