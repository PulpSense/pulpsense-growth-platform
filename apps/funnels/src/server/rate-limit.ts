import type { FunnelRateLimitService } from "./funnel-env";

const digestKey = async (key: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export const consumeRateLimit = async (
  service: FunnelRateLimitService | undefined,
  key: string,
): Promise<"allowed" | "limited" | "unavailable"> => {
  if (!service) return "unavailable";

  try {
    const digest = await digestKey(key);
    const response = await service.fetch("https://rate-limit.internal/limit", {
      method: "POST",
      body: digest,
    });
    if (response.status === 204) return "allowed";
    if (response.status === 429) return "limited";
    return "unavailable";
  } catch {
    return "unavailable";
  }
};
