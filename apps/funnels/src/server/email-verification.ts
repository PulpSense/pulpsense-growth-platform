import { isBusinessEmail } from "@/utils/businessEmail";

import type { FunnelEnv } from "./funnel-env";
import { getClientIp, json, parseJson, rejectCrossOrigin } from "./http";
import { consumeRateLimit } from "./rate-limit";

export type EmailVerification = {
  status: "verified" | "unverified";
  result: "business" | "catch_all" | "provider_error";
};

type BusinessEmailVerification =
  | { result: "business"; status: "verified" }
  | { result: "catch_all"; status: "unverified" }
  | {
      diagnostic:
        | "api_key_missing"
        | "provider_http_error"
        | "provider_unknown"
        | "provider_request_failed"
        | "provider_unexpected_result";
      providerResult?: string;
      result: "provider_error";
      status: "unverified";
    }
  | { result: "invalid"; status: "invalid" };

export const verifyBusinessEmail = async (
  email: string,
  apiKey: string | undefined,
): Promise<BusinessEmailVerification> => {
  if (!apiKey) {
    console.warn("PulpSense email verification failed", {
      reason: "api_key_missing",
    });
    return {
      status: "unverified",
      result: "provider_error",
      diagnostic: "api_key_missing",
    };
  }

  try {
    const response = await fetch(
      `https://api.millionverifier.com/api/v3/?api=${apiKey}&email=${encodeURIComponent(email)}&timeout=10`,
    );
    if (!response.ok) {
      console.warn("PulpSense email verification failed", {
        reason: "provider_http_error",
        status: response.status,
      });
      return {
        status: "unverified",
        result: "provider_error",
        diagnostic: "provider_http_error",
      };
    }

    const verification = (await response.json()) as {
      result?: string;
      free?: boolean;
    };
    if (
      verification.free === true ||
      verification.result === "invalid" ||
      verification.result === "disposable"
    ) {
      return { status: "invalid", result: "invalid" };
    }
    if (verification.result === "ok") {
      return { status: "verified", result: "business" };
    }
    if (verification.result === "catch_all") {
      return { status: "unverified", result: "catch_all" };
    }
    if (verification.result === "unknown") {
      console.warn("PulpSense email verification failed", {
        reason: "provider_unknown",
      });
      return {
        status: "unverified",
        result: "provider_error",
        diagnostic: "provider_unknown",
      };
    }

    console.warn("PulpSense email verification failed", {
      reason: "provider_unexpected_result",
      result: verification.result ?? "missing",
    });
    return {
      status: "unverified",
      result: "provider_error",
      diagnostic: "provider_unexpected_result",
      providerResult:
        typeof verification.result === "string" && verification.result
          ? verification.result.replaceAll(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)
          : "missing",
    };
  } catch (error) {
    console.warn("PulpSense email verification failed", {
      reason: "provider_request_failed",
      error: error instanceof Error ? error.name : "unknown",
    });
    return {
      status: "unverified",
      result: "provider_error",
      diagnostic: "provider_request_failed",
    };
  }
};

export async function handleVerifyEmail(request: Request, env: FunnelEnv) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const rateLimit = await consumeRateLimit(
    env.FUNNEL_RATE_LIMIT_SERVICE,
    `verify-email:${getClientIp(request)}`,
  );
  if (rateLimit === "unavailable") {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }
  if (rateLimit === "limited") {
    return json({ error: "rate_limited" }, 429);
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

  const verification = await verifyBusinessEmail(
    email,
    env.MILLION_VERIFIER_API_KEY,
  );
  if (verification.status === "invalid") {
    return json({ valid: false, ...verification });
  }

  const diagnostic =
    "diagnostic" in verification ? verification.diagnostic : undefined;
  const providerResult =
    "providerResult" in verification ? verification.providerResult : undefined;
  return json(
    {
      valid: true,
      status: verification.status,
      result: verification.result,
    },
    200,
    {
      ...(diagnostic ? { "x-pulpsense-email-verification": diagnostic } : {}),
      ...(providerResult
        ? { "x-pulpsense-email-verification-result": providerResult }
        : {}),
    },
  );
}
