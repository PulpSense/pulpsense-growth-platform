export const verifyTurnstile = async ({
  request,
  token,
  clientIp,
  secret,
  expectedAction,
}: {
  request: Request;
  token: string;
  clientIp: string;
  secret: string;
  expectedAction: string;
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
      result.action === expectedAction &&
      result.hostname === new URL(request.url).hostname,
    );
  } catch {
    return undefined;
  }
};
