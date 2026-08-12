import { verifySoftphoneHandoff } from "../handoff";

export type SoftphoneEnv = {
  SOFTPHONE_HANDOFF_SECRET?: string;
  SOFTPHONE_ENVIRONMENT?: string;
  TELNYX_API_KEY?: string;
  TELNYX_CALLER_NUMBER?: string;
  TELNYX_TELEPHONY_CREDENTIAL_ID?: string;
};

type SessionRequest = { handoff?: string };

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });

const parseBody = async (
  request: Request,
): Promise<SessionRequest | undefined> => {
  try {
    return (await request.json()) as SessionRequest;
  } catch {
    return undefined;
  }
};

const rejectCrossOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin
    ? undefined
    : json({ error: "origin_not_allowed" }, 403);
};

const requireEnvironment = (env: SoftphoneEnv) => {
  const required = {
    apiKey: env.TELNYX_API_KEY?.trim(),
    callerNumber: env.TELNYX_CALLER_NUMBER?.trim(),
    credentialId: env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim(),
    handoffSecret: env.SOFTPHONE_HANDOFF_SECRET?.trim(),
  };
  if (
    !required.apiKey ||
    !required.callerNumber ||
    !required.credentialId ||
    !required.handoffSecret
  ) {
    throw new Error("softphone_is_not_configured");
  }
  if (!/^\+[1-9]\d{7,14}$/u.test(required.callerNumber)) {
    throw new Error("caller_number_is_invalid");
  }
  return required as {
    apiKey: string;
    callerNumber: string;
    credentialId: string;
    handoffSecret: string;
  };
};

export const createSoftphoneSessionHandler =
  (fetchTelnyx: typeof fetch = fetch, now: () => number = Date.now) =>
  async (request: Request, env: SoftphoneEnv) => {
    const crossOriginResponse = rejectCrossOrigin(request);
    if (crossOriginResponse) return crossOriginResponse;

    let config: ReturnType<typeof requireEnvironment>;
    try {
      config = requireEnvironment(env);
    } catch (error) {
      return json({ error: (error as Error).message }, 503);
    }

    const body = await parseBody(request);
    if (!body?.handoff) return json({ error: "handoff_is_required" }, 400);

    let handoff;
    try {
      handoff = await verifySoftphoneHandoff(
        body.handoff,
        config.handoffSecret,
        Math.floor(now() / 1000),
      );
    } catch (error) {
      return json({ error: (error as Error).message }, 401);
    }

    const tokenResponse = await fetchTelnyx(
      `https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(config.credentialId)}/token`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    );

    if (!tokenResponse.ok) {
      return json({ error: "telnyx_session_unavailable" }, 502);
    }

    const telnyxJwt = (await tokenResponse.text()).trim();
    if (telnyxJwt.split(".").length !== 3) {
      return json({ error: "telnyx_session_invalid" }, 502);
    }

    return json({
      actorUserWorkspaceId: handoff.actorUserWorkspaceId,
      callerNumber: config.callerNumber,
      destinationNumber: handoff.destinationNumber,
      environment: env.SOFTPHONE_ENVIRONMENT ?? "unknown",
      personId: handoff.personId,
      personName: handoff.personName,
      telnyxJwt,
    });
  };

export const handleSoftphoneSession = createSoftphoneSessionHandler();
