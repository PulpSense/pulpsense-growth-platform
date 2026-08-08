import {
  contactSubmissionRequestSchema,
  contactSubmittedEventSchema,
  type ContactSubmissionRequest,
} from "@pulpsense/contracts";
import { isBusinessEmail } from "@/utils/businessEmail";

type FormEvent =
  | "contact_submitted"
  | "application_submitted"
  | "booking_completed";

type FormSubmitBody = {
  event?: string;
  data?: Record<string, unknown>;
  submittedAt?: string;
};

type CapiRequestBody = {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_email?: string;
  user_phone?: string;
  fbc?: string;
  fbp?: string;
  custom_data?: Record<string, unknown>;
};

export type FunnelEnv = {
  FUNNEL_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
  TURNSTILE_SECRET_KEY?: string;
  SUBMISSION_SIGNING_SECRET?: string;
  PULPSENSE_ENVIRONMENT?: "local" | "preview" | "production";
  MILLION_VERIFIER_API_KEY?: string;
  PULPSENSE_TRIGGER_API_ORIGIN?: string;
  PULPSENSE_TRIGGER_SECRET_KEY?: string;
  CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID?: string;
  CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID?: string;
  CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
};

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

type EmailVerification = {
  status: "verified" | "unverified";
  result: "business" | "catch_all" | "provider_error";
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

const deriveSubmissionId = async (attemptId: string, secret: string) => {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`submission:${attemptId}`),
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
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin !== requestOrigin) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  const body = await parseJson<unknown>(request);
  const parsed = contactSubmissionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }

  if (!env.FUNNEL_RATE_LIMITER) {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }

  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
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
      };

      if (
        !turnstileResult.success ||
        turnstileResult.action !== "contact_submit"
      ) {
        return json({ error: "turnstile_rejected" }, 403);
      }
    } catch {
      return json({ error: "turnstile_unavailable" }, 503);
    }

    if (!isBusinessEmail(parsed.data.payload.email)) {
      return json({ error: "email_invalid" }, 422);
    }

    emailVerification = { status: "unverified", result: "provider_error" };

    if (env.MILLION_VERIFIER_API_KEY) {
      try {
        const verifierResponse = await fetch(
          `https://api.millionverifier.com/api/v3/?api=${env.MILLION_VERIFIER_API_KEY}&email=${encodeURIComponent(parsed.data.payload.email)}&timeout=10`,
        );

        if (!verifierResponse.ok) throw new Error("Verifier request failed");

        const verifierResult = (await verifierResponse.json()) as {
          result?: string;
        };

        if (
          verifierResult.result === "invalid" ||
          verifierResult.result === "disposable"
        ) {
          return json({ error: "email_invalid" }, 422);
        }

        if (verifierResult.result === "ok") {
          emailVerification = { status: "verified", result: "business" };
        } else if (verifierResult.result === "catch_all") {
          emailVerification = { status: "verified", result: "catch_all" };
        }
      } catch {
        emailVerification = {
          status: "unverified",
          result: "provider_error",
        };
      }
    }

    if (!env.SUBMISSION_SIGNING_SECRET || !env.PULPSENSE_TRIGGER_SECRET_KEY) {
      return json({ error: "handoff_unavailable" }, 503);
    }

    submissionId = await deriveSubmissionId(
      parsed.data.attemptId,
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
    payload: {
      ...parsed.data.payload,
      emailVerification,
    },
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

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const parseJson = async <T>(request: Request): Promise<T | undefined> => {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
};

const isFormEvent = (event: string | undefined): event is FormEvent =>
  event === "contact_submitted" ||
  event === "application_submitted" ||
  event === "booking_completed";

const taskIdFor = (env: FunnelEnv, funnelId: string, event: FormEvent) => {
  if (funnelId !== "creative-multiplier-sprint") return undefined;

  return {
    contact_submitted: env.CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID,
    application_submitted: env.CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID,
    booking_completed: env.CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID,
  }[event];
};

export async function handleVerifyEmail(request: Request, env: FunnelEnv) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  const body = await parseJson<{ email?: unknown }>(request);
  const email = body?.email;

  if (typeof email !== "string" || !email) {
    return json({ error: "Email is required" }, 400);
  }

  if (!isBusinessEmail(email)) {
    return json({
      valid: false,
      status: "invalid",
      result: "non_business_email",
    });
  }

  if (!env.MILLION_VERIFIER_API_KEY) {
    return json({
      valid: true,
      status: "unverified",
      result: "not_configured",
    });
  }

  try {
    const response = await fetch(
      `https://api.millionverifier.com/api/v3/?api=${env.MILLION_VERIFIER_API_KEY}&email=${encodeURIComponent(email)}&timeout=10`,
    );
    if (!response.ok) throw new Error("Verifier request failed");

    const result = (await response.json()) as { result?: string };
    if (result.result === "ok" || result.result === "catch_all") {
      return json({
        valid: true,
        status: "verified",
        result: result.result,
      });
    }

    if (result.result === "invalid" || result.result === "disposable") {
      return json({
        valid: false,
        status: "invalid",
        result: result.result,
      });
    }

    return json({
      valid: true,
      status: "unverified",
      result: "provider_error",
    });
  } catch {
    return json({
      valid: true,
      status: "unverified",
      result: "provider_error",
    });
  }
}

export async function handleFormSubmit(request: Request, env: FunnelEnv) {
  const body = await parseJson<FormSubmitBody>(request);

  if (!body || !isFormEvent(body.event)) {
    return json({ error: "Unknown event" }, 400);
  }

  const data = body.data ?? {};
  const funnelId =
    typeof data.funnelId === "string" ? data.funnelId : "default";
  const taskId = taskIdFor(env, funnelId, body.event);

  if (!env.PULPSENSE_TRIGGER_SECRET_KEY || !taskId) {
    return json(
      { ok: false, skipped: true, reason: "Trigger not configured" },
      202,
    );
  }

  const payload = {
    event: body.event,
    funnelId,
    data,
    submittedAt: body.submittedAt ?? new Date().toISOString(),
  };

  try {
    const response = await fetch(
      `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      },
    );

    if (!response.ok) {
      return json({ error: "Trigger delivery failed" }, 502);
    }

    return json({ ok: true });
  } catch {
    return json({ error: "Trigger delivery failed" }, 502);
  }
}

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export async function handleMetaCapi(request: Request, env: FunnelEnv) {
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) {
    return json({ error: "Meta CAPI not configured" }, 500);
  }

  const body = await parseJson<CapiRequestBody>(request);
  if (!body?.event_name || !body.event_id || !body.event_source_url) {
    return json({ error: "Invalid Meta CAPI event" }, 400);
  }

  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userData: Record<string, unknown> = {
    client_ip_address: clientIp,
    client_user_agent: request.headers.get("user-agent") ?? "",
  };

  if (body.user_email) userData.em = [await sha256(body.user_email)];
  if (body.user_phone) userData.ph = [await sha256(body.user_phone)];
  if (body.fbc) userData.fbc = body.fbc;
  if (body.fbp) userData.fbp = body.fbp;

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: body.event_source_url,
        event_id: body.event_id,
        user_data: userData,
        ...(body.custom_data ? { custom_data: body.custom_data } : {}),
      },
    ],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${env.META_PIXEL_ID}/events?access_token=${env.META_CAPI_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as {
      events_received?: number;
      error?: unknown;
    };

    if (!response.ok) {
      return json(
        { error: result.error ?? "Meta CAPI delivery failed" },
        response.status,
      );
    }

    return json({ success: true, events_received: result.events_received });
  } catch {
    return json({ error: "Meta CAPI delivery failed" }, 502);
  }
}
