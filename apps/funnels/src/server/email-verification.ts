import { isBusinessEmail } from "@/utils/businessEmail";

import type { FunnelEnv } from "./funnel-env";
import { getClientIp, json, parseJson, rejectCrossOrigin } from "./http";

export type EmailVerification = {
  status: "verified" | "unverified";
  result: "business" | "catch_all" | "provider_error";
};

type BusinessEmailVerification =
  | { result: "business"; status: "verified" }
  | { result: "catch_all" | "provider_error"; status: "unverified" }
  | { result: "invalid"; status: "invalid" };

export const verifyBusinessEmail = async (
  email: string,
  apiKey: string | undefined,
): Promise<BusinessEmailVerification> => {
  if (!apiKey) return { status: "unverified", result: "provider_error" };

  try {
    const response = await fetch(
      `https://api.millionverifier.com/api/v3/?api=${apiKey}&email=${encodeURIComponent(email)}&timeout=10`,
    );
    if (!response.ok) throw new Error("Verifier request failed");

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

    return { status: "unverified", result: "provider_error" };
  } catch {
    return { status: "unverified", result: "provider_error" };
  }
};

export async function handleVerifyEmail(request: Request, env: FunnelEnv) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  if (!env.FUNNEL_RATE_LIMITER) {
    return json({ error: "rate_limiter_unavailable" }, 503);
  }
  const rateLimit = await env.FUNNEL_RATE_LIMITER.limit({
    key: `verify-email:${getClientIp(request)}`,
  });
  if (!rateLimit.success) {
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

  return json({ valid: true, ...verification });
}
