import { contactSubmittedEventSchema } from "@pulpsense/contracts";
import { isBusinessEmail } from "@/utils/businessEmail";

import {
  contactSubmissionRequestSchema,
  type ContactSubmissionRequest,
} from "./contact-submission-contract";
import {
  verifyBusinessEmail,
  type EmailVerification,
} from "./email-verification";
import type { FunnelEnv } from "./funnel-env";
import { getClientIp, json, parseJson, rejectCrossOrigin } from "./http";

const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

const decodeBase64Url = (value: string) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importHmacKey = (secret: string, usages: KeyUsage[]) =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );

const digestRetryRequest = async (request: ContactSubmissionRequest) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({
        funnelId: request.funnelId,
        attemptId: request.attemptId,
        payload: request.payload,
        attribution: request.attribution,
        sourceUrl: request.sourceUrl,
        referrer: request.referrer ?? null,
        fbp: request.fbp ?? null,
        fbc: request.fbc ?? null,
      }),
    ),
  );

  return encodeBase64Url(new Uint8Array(digest));
};

type RetryClaims = {
  submissionId: string;
  requestDigest: string;
  emailVerification: EmailVerification;
};

const createRetryToken = async (claims: RetryClaims, secret: string) => {
  const encoder = new TextEncoder();
  const encodedClaims = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedClaims),
  );

  return `${encodedClaims}.${encodeBase64Url(new Uint8Array(signature))}`;
};

const deriveSubmissionId = async (
  attemptId: string,
  requestDigest: string,
  secret: string,
) => {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`submission:${attemptId}:${requestDigest}`),
    ),
  ).slice(0, 16);
  signature[6] = (signature[6]! & 0x0f) | 0x40;
  signature[8] = (signature[8]! & 0x3f) | 0x80;
  const hex = Array.from(signature, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const readRetryToken = async (
  token: string,
  secret: string,
): Promise<RetryClaims | undefined> => {
  try {
    const [encodedClaims, encodedSignature, extra] = token.split(".");
    if (!encodedClaims || !encodedSignature || extra) return undefined;

    const key = await importHmacKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedClaims),
    );
    if (!valid) return undefined;

    const claims = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedClaims)),
    ) as RetryClaims;
    if (
      typeof claims.submissionId !== "string" ||
      typeof claims.requestDigest !== "string" ||
      (claims.emailVerification?.status !== "verified" &&
        claims.emailVerification?.status !== "unverified") ||
      !["business", "catch_all", "provider_error"].includes(
        claims.emailVerification.result,
      )
    ) {
      return undefined;
    }

    return claims;
  } catch {
    return undefined;
  }
};

export async function handleFunnelEvent(request: Request, env: FunnelEnv) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await parseJson<unknown>(request);
  const parsed = contactSubmissionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }

  if (!env.FUNNEL_RATE_LIMITER) {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }

  const clientIp = getClientIp(request);
  const rateLimit = await env.FUNNEL_RATE_LIMITER.limit({
    key: `contact:${clientIp}`,
  });
  if (!rateLimit.success) {
    return json({ error: "rate_limited" }, 429);
  }

  const requestDigest = await digestRetryRequest(parsed.data);
  let submissionId: string;
  let emailVerification: EmailVerification;
  let retryToken: string;

  if (parsed.data.retry) {
    if (!env.SUBMISSION_SIGNING_SECRET || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
      return json({ error: "handoff_unavailable" }, 503);
    }

    const retryClaims = await readRetryToken(
      parsed.data.retry.token,
      env.SUBMISSION_SIGNING_SECRET,
    );
    if (
      !retryClaims ||
      retryClaims.submissionId !== parsed.data.retry.submissionId ||
      retryClaims.requestDigest !== requestDigest
    ) {
      return json({ error: "invalid_retry_identity" }, 400);
    }

    submissionId = retryClaims.submissionId;
    emailVerification = retryClaims.emailVerification;
    retryToken = parsed.data.retry.token;
  } else {
    if (!env.TURNSTILE_SECRET_KEY) {
      return json({ error: "turnstile_unavailable" }, 503);
    }

    const turnstileBody = new FormData();
    turnstileBody.set("secret", env.TURNSTILE_SECRET_KEY);
    turnstileBody.set("response", parsed.data.turnstileToken);
    turnstileBody.set("remoteip", clientIp);

    try {
      const turnstileResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: turnstileBody },
      );
      const turnstileResult = (await turnstileResponse.json()) as {
        success?: boolean;
        action?: string;
        hostname?: string;
      };
      if (
        !turnstileResult.success ||
        turnstileResult.action !== "contact_submit" ||
        turnstileResult.hostname !== new URL(request.url).hostname
      ) {
        return json({ error: "turnstile_rejected" }, 403);
      }
    } catch {
      return json({ error: "turnstile_unavailable" }, 503);
    }

    if (!isBusinessEmail(parsed.data.payload.email)) {
      return json({ error: "email_invalid" }, 422);
    }
    const verification = await verifyBusinessEmail(
      parsed.data.payload.email,
      env.MILLION_VERIFIER_API_KEY,
    );
    if (verification.status === "invalid") {
      return json({ error: "email_invalid" }, 422);
    }
    emailVerification = verification;

    if (!env.SUBMISSION_SIGNING_SECRET || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
      return json({ error: "handoff_unavailable" }, 503);
    }
    submissionId = await deriveSubmissionId(
      parsed.data.attemptId,
      requestDigest,
      env.SUBMISSION_SIGNING_SECRET,
    );
    retryToken = await createRetryToken(
      { submissionId, requestDigest, emailVerification },
      env.SUBMISSION_SIGNING_SECRET,
    );
  }

  const eventId = `contact_submitted:${submissionId}`;
  const event = contactSubmittedEventSchema.parse({
    schemaVersion: 1,
    eventType: "contact_submitted",
    funnelId: parsed.data.funnelId,
    submissionId,
    eventId,
    occurredAt: new Date().toISOString(),
    payload: { ...parsed.data.payload, emailVerification },
    attribution: parsed.data.attribution,
    requestContext: {
      clientIp,
      userAgent: request.headers.get("user-agent") ?? "",
      sourceUrl: parsed.data.sourceUrl,
      ...(parsed.data.referrer ? { referrer: parsed.data.referrer } : {}),
      ...(parsed.data.fbp ? { fbp: parsed.data.fbp } : {}),
      ...(parsed.data.fbc ? { fbc: parsed.data.fbc } : {}),
    },
    environment: env.PULPSENSE_ENVIRONMENT ?? "local",
  });

  try {
    const triggerResponse = await fetch(
      `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/process-funnel-event/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: event,
          context: { environment: event.environment },
          options: { idempotencyKey: eventId },
        }),
      },
    );
    if (!triggerResponse.ok) throw new Error("Trigger rejected event");

    const triggerResult = (await triggerResponse.json()) as { id?: string };
    if (!triggerResult.id) throw new Error("Trigger response omitted run ID");

    return json({
      accepted: true,
      submissionId,
      eventId,
      runId: triggerResult.id,
      retry: { submissionId, token: retryToken },
    });
  } catch {
    return json(
      {
        accepted: false,
        error: "handoff_failed",
        submissionId,
        eventId,
        retry: { submissionId, token: retryToken },
      },
      502,
    );
  }
}
