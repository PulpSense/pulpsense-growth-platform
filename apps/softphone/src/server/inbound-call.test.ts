import { beforeAll, describe, expect, it, vi } from "vitest";

import { createInboundCallHandler } from "./inbound-call";
import type { SoftphoneEnv } from "./session";

const now = 1_786_470_120_000;
const timestamp = String(Math.floor(now / 1000));
let privateKey: CryptoKey;
let publicKey = "";
let hexadecimalPublicKey = "";

const base64 = (value: ArrayBuffer | Uint8Array) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes));
};

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  const rawPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  publicKey = base64(rawPublicKey);
  hexadecimalPublicKey = Array.from(rawPublicKey, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
});

const env = (overrides: Partial<SoftphoneEnv> = {}): SoftphoneEnv => ({
  TELNYX_API_KEY: "KEY_test",
  TELNYX_CALL_CONTROL_APPLICATION_ID: "connection-id",
  TELNYX_INBOUND_DESTINATION_NUMBER: "+15555550100",
  TELNYX_PUBLIC_KEY: publicKey,
  TELNYX_VOICEMAIL_GREETING: "Please leave a message.",
  ...overrides,
});

const signedRequest = async (event: unknown) => {
  const body = JSON.stringify(event);
  const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(`${timestamp}|${body}`),
  );
  return new Request("https://phone.example.com/api/telnyx/inbound", {
    method: "POST",
    headers: {
      "telnyx-signature-ed25519": base64(signature),
      "telnyx-timestamp": timestamp,
    },
    body,
  });
};

const event = (
  eventType: string,
  payload: Record<string, unknown>,
  id = "event-id",
) => ({ data: { event_type: eventType, id, payload } });

const commandBody = (fetchMock: ReturnType<typeof vi.fn>, index = 0) =>
  JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as Record<
    string,
    unknown
  >;

describe("Telnyx inbound call routing", () => {
  it("rejects unsigned webhooks", async () => {
    const fetchMock = vi.fn();
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = new Request(
      "https://phone.example.com/api/telnyx/inbound",
      { method: "POST", body: "{}" },
    );

    expect((await handler(request, env())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the hexadecimal public key format from the Telnyx portal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.initiated", {
        call_control_id: "inbound-control-id",
        direction: "incoming",
      }),
    );

    expect(
      (await handler(request, env({ TELNYX_PUBLIC_KEY: hexadecimalPublicKey })))
        .status,
    ).toBe(204);
  });

  it("answers an incoming call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.initiated", {
        call_control_id: "inbound-control-id",
        direction: "incoming",
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/calls/inbound-control-id/actions/answer",
    );
  });

  it("rings the mobile with the original caller ID for twenty seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.answered", {
        call_control_id: "inbound-control-id",
        direction: "incoming",
        from: "+13075550123",
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.telnyx.com/v2/calls",
    );
    expect(commandBody(fetchMock)).toMatchObject({
      bridge_intent: true,
      bridge_on_answer: true,
      connection_id: "connection-id",
      from: "+13075550123",
      link_to: "inbound-control-id",
      timeout_secs: 20,
      to: "+15555550100",
    });
  });

  it("rings the mobile when Telnyx omits direction from call.answered", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.answered", {
        call_control_id: "inbound-control-id",
        call_leg_id: "inbound-leg-id",
        call_session_id: "inbound-session-id",
        calling_party_type: "pstn",
        client_state: null,
        connection_id: "connection-id",
        flow_destination: "telnyx_number_cc_app",
        from: "+13075550123",
        to: "+13072490829",
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.telnyx.com/v2/calls",
    );
  });

  it("marks the mobile leg answered before it is bridged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.answered", {
        call_control_id: "mobile-control-id",
        client_state: btoa(
          JSON.stringify({
            stage: "mobile",
            inboundCallControlId: "inbound-control-id",
          }),
        ),
        direction: "outgoing",
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/calls/mobile-control-id/actions/client_state_update",
    );
    expect(commandBody(fetchMock)).toMatchObject({
      client_state: expect.any(String),
    });
  });

  it("does not start voicemail after an answered call ends", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.hangup", {
        call_control_id: "mobile-control-id",
        client_state: btoa(
          JSON.stringify({
            stage: "answered",
            inboundCallControlId: "inbound-control-id",
          }),
        ),
        direction: "outgoing",
        hangup_cause: "normal_clearing",
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails the webhook when a Telnyx command is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.initiated", {
        call_control_id: "inbound-control-id",
        direction: "incoming",
      }),
    );

    await expect(handler(request, env())).rejects.toThrow(
      "Telnyx command failed (500)",
    );
  });

  it("plays the business greeting when the mobile leg is unanswered", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const clientState = btoa(
      JSON.stringify({
        stage: "mobile",
        inboundCallControlId: "inbound-control-id",
      }),
    );
    const request = await signedRequest(
      event("call.hangup", {
        call_control_id: "mobile-control-id",
        client_state: clientState,
        direction: "outgoing",
        hangup_cause: "timeout",
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/calls/inbound-control-id/actions/speak",
    );
    expect(commandBody(fetchMock)).toMatchObject({
      language: "en-US",
      payload: "Please leave a message.",
      voice: "female",
    });
  });

  it("records up to two minutes after the greeting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    const handler = createInboundCallHandler(fetchMock, () => now);
    const request = await signedRequest(
      event("call.speak.ended", {
        call_control_id: "inbound-control-id",
        client_state: btoa(JSON.stringify({ stage: "voicemail" })),
      }),
    );

    expect((await handler(request, env())).status).toBe(204);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/calls/inbound-control-id/actions/record_start",
    );
    expect(commandBody(fetchMock)).toMatchObject({
      format: "mp3",
      max_length: 120,
      play_beep: true,
      recording_track: "inbound",
      timeout_secs: 5,
    });
  });
});
