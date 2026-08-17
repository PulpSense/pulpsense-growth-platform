import type { FunnelEnv } from "./funnel-env";

export const resolveTurnstileSecret = (env: FunnelEnv) =>
  env.TURNSTILE_TEST_SECRET_KEY ?? env.TURNSTILE_SECRET_KEY;

export const verifyTurnstile = async ({
  request,
  token,
  clientIp,
  secret,
  expectedAction,
  acceptTestMetadata = false,
}: {
  request: Request;
  token: string;
  clientIp: string;
  secret: string;
  expectedAction: string;
  acceptTestMetadata?: boolean;
}) => {
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  body.set("remoteip", clientIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    return Boolean(
      result.success &&
      (acceptTestMetadata ||
        (result.action === expectedAction &&
          result.hostname === new URL(request.url).hostname)),
    );
  } catch {
    return undefined;
  }
};
