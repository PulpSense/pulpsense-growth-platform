import type { SoftphoneEnv } from "./session";

type TelnyxPayload = {
  call_control_id?: string;
  call_leg_id?: string;
  calling_party_type?: string;
  client_state?: string;
  direction?: string;
  flow_destination?: string;
  from?: string;
  hangup_cause?: string;
};

type TelnyxEvent = {
  data?: {
    event_type?: string;
    id?: string;
    payload?: TelnyxPayload;
  };
};

type CallState =
  | { stage: "mobile"; inboundCallControlId: string }
  | { stage: "answered"; inboundCallControlId: string }
  | { stage: "voicemail" };

const DEFAULT_GREETING =
  "You have reached PulpSense. We cannot take your call right now. Please leave your name, number, and a brief message after the tone, and we will call you back as soon as possible.";
const MOBILE_RING_SECONDS = 20;
const WEBHOOK_TOLERANCE_SECONDS = 300;
const TELNYX_COMMAND_TIMEOUT_MS = 1_000;
const UNANSWERED_HANGUP_CAUSES = new Set([
  "call_rejected",
  "timeout",
  "user_busy",
]);

const response = (status = 204) =>
  new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const decodeBase64 = (value: string) => {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const decodePublicKey = (value: string) => {
  if (/^[0-9a-f]{64}$/iu.test(value)) {
    return Uint8Array.from(value.match(/.{2}/gu) ?? [], (byte) =>
      Number.parseInt(byte, 16),
    );
  }
  return decodeBase64(value);
};

const encodeState = (state: CallState) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(state))));

const decodeState = (value: string | undefined): CallState | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(
      new TextDecoder().decode(decodeBase64(value)),
    ) as CallState;
  } catch {
    return undefined;
  }
};

const verifyWebhook = async (
  rawBody: string,
  request: Request,
  publicKey: string,
  now: () => number,
) => {
  const signature = request.headers.get("telnyx-signature-ed25519");
  const timestamp = request.headers.get("telnyx-timestamp");
  const timestampSeconds = Number(timestamp);
  if (
    !signature ||
    !timestamp ||
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Math.floor(now() / 1000) - timestampSeconds) >
      WEBHOOK_TOLERANCE_SECONDS
  ) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      decodePublicKey(publicKey.trim()),
      "Ed25519",
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signature),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch {
    return false;
  }
};

const telnyxCommand = async (
  fetchTelnyx: typeof fetch,
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "PUT" = "POST",
) => {
  const commandResponse = await fetchTelnyx(
    `https://api.telnyx.com/v2${path}`,
    {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELNYX_COMMAND_TIMEOUT_MS),
    },
  );
  if (!commandResponse.ok) {
    throw new Error(`Telnyx command failed (${commandResponse.status})`);
  }
  return commandResponse;
};

const requiredConfig = (env: SoftphoneEnv) => {
  const config = {
    apiKey: env.TELNYX_API_KEY?.trim(),
    connectionId: env.TELNYX_CALL_CONTROL_APPLICATION_ID?.trim(),
    destination: env.TELNYX_INBOUND_DESTINATION_NUMBER?.trim(),
    publicKey: env.TELNYX_PUBLIC_KEY?.trim(),
  };
  if (
    !config.apiKey ||
    !config.connectionId ||
    !config.destination ||
    !config.publicKey ||
    !/^\+[1-9]\d{7,14}$/u.test(config.destination)
  ) {
    return undefined;
  }
  return config as Record<keyof typeof config, string>;
};

export const createInboundCallHandler =
  (fetchTelnyx: typeof fetch = fetch, now: () => number = Date.now) =>
  async (request: Request, env: SoftphoneEnv) => {
    const config = requiredConfig(env);
    if (!config) return response(503);

    const rawBody = await request.text();
    if (!(await verifyWebhook(rawBody, request, config.publicKey, now))) {
      return response(403);
    }

    let event: TelnyxEvent;
    try {
      event = JSON.parse(rawBody) as TelnyxEvent;
    } catch {
      return response(400);
    }

    const eventType = event.data?.event_type;
    const eventId = event.data?.id;
    const payload = event.data?.payload;
    const callControlId = payload?.call_control_id;
    if (!eventType || !eventId || !payload || !callControlId) {
      return response(400);
    }

    const command = (
      path: string,
      body: Record<string, unknown>,
      suffix: string,
    ) =>
      telnyxCommand(fetchTelnyx, config.apiKey, path, {
        ...body,
        command_id: `${eventId}:${suffix}`,
      });

    if (eventType === "call.initiated" && payload.direction === "incoming") {
      await command(
        `/calls/${encodeURIComponent(callControlId)}/actions/answer`,
        {},
        "answer",
      );
      return response();
    }

    const state = decodeState(payload.client_state);
    const isInboundAnswered =
      payload.direction === "incoming" ||
      (payload.calling_party_type === "pstn" &&
        payload.flow_destination === "telnyx_number_cc_app" &&
        !state);
    if (eventType === "call.answered" && isInboundAnswered) {
      await command(
        "/calls",
        {
          bridge_intent: true,
          bridge_on_answer: true,
          client_state: encodeState({
            stage: "mobile",
            inboundCallControlId: callControlId,
          }),
          connection_id: config.connectionId,
          from: payload.from,
          link_to: callControlId,
          timeout_secs: MOBILE_RING_SECONDS,
          to: config.destination,
        },
        "dial-mobile",
      );
      return response();
    }

    if (eventType === "call.answered" && state?.stage === "mobile") {
      await telnyxCommand(
        fetchTelnyx,
        config.apiKey,
        `/calls/${encodeURIComponent(callControlId)}/actions/client_state_update`,
        {
          client_state: encodeState({
            stage: "answered",
            inboundCallControlId: state.inboundCallControlId,
          }),
        },
        "PUT",
      );
      return response();
    }

    if (
      eventType === "call.hangup" &&
      state?.stage === "mobile" &&
      payload.hangup_cause &&
      UNANSWERED_HANGUP_CAUSES.has(payload.hangup_cause)
    ) {
      await telnyxCommand(
        fetchTelnyx,
        config.apiKey,
        `/calls/${encodeURIComponent(state.inboundCallControlId)}/actions/speak`,
        {
          client_state: encodeState({ stage: "voicemail" }),
          command_id: `${eventId}:voicemail-greeting`,
          language: "en-US",
          payload: env.TELNYX_VOICEMAIL_GREETING?.trim() || DEFAULT_GREETING,
          voice: "female",
        },
      );
      return response();
    }

    if (eventType === "call.speak.ended" && state?.stage === "voicemail") {
      await command(
        `/calls/${encodeURIComponent(callControlId)}/actions/record_start`,
        {
          channels: "single",
          client_state: encodeState({ stage: "voicemail" }),
          format: "mp3",
          max_length: 120,
          play_beep: true,
          recording_track: "inbound",
          timeout_secs: 5,
          trim: "trim-silence",
        },
        "record-voicemail",
      );
    }

    return response();
  };

export const handleInboundCall = createInboundCallHandler();
