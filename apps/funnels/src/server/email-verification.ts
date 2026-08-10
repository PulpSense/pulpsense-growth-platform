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
  | { result: "catch_all" | "provider_error"; status: "unverified" }
  | { result: "invalid"; status: "invalid" };

const INTERNAL_EMAIL_BYPASS = "santi@pulpsense.com";

const isNonexistentEmailDomain = async (email: string): Promise<boolean> => {
  const domain = email.trim().toLowerCase().split("@").at(-1);
  if (!domain) return false;

  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!response.ok) return false;

    const dnsResponse = (await response.json()) as { Status?: number };
    return dnsResponse.Status === 3;
  } catch {
    return false;
  }
};

const providerErrorVerification = async (
  email: string,
): Promise<BusinessEmailVerification> =>
  (await isNonexistentEmailDomain(email))
    ? { status: "invalid", result: "invalid" }
    : { status: "unverified", result: "provider_error" };

export const verifyBusinessEmail = async (
  email: string,
  apiKey: string | undefined,
): Promise<BusinessEmailVerification> => {
  if (email.trim().toLowerCase() === INTERNAL_EMAIL_BYPASS) {
    return { status: "verified", result: "business" };
  }
  if (!apiKey) return providerErrorVerification(email);

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

    return providerErrorVerification(email);
  } catch {
    return providerErrorVerification(email);
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

  return json({
    valid: verification.status === "verified",
    ...verification,
  });
}
