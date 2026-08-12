import { describe, expect, it, vi } from "vitest";

import {
  SOFTPHONE_HANDOFF_AUDIENCE,
  SOFTPHONE_HANDOFF_ISSUER,
  signSoftphoneHandoff,
  type SoftphoneHandoffPayload,
} from "../handoff";
import { createSoftphoneSessionHandler, type SoftphoneEnv } from "./session";

const now = new Date("2026-08-11T17:00:00.000Z").getTime();
const apiKey = "KEY_test_that_is_longer_than_thirty_two_characters";
const secret = "handoff_test_secret_that_is_longer_than_thirty_two_characters";
const env: SoftphoneEnv = {
  SOFTPHONE_HANDOFF_SECRET: secret,
  SOFTPHONE_ENVIRONMENT: "test",
  TELNYX_API_KEY: apiKey,
  TELNYX_CALLER_NUMBER: "+13072490829",
  TELNYX_TELEPHONY_CREDENTIAL_ID: "eec718ab-9e16-4042-ac54-ea2cb48143ef",
};

const payload = (
  overrides: Partial<SoftphoneHandoffPayload> = {},
): SoftphoneHandoffPayload => ({
  actorUserWorkspaceId: "b1492d16-acb8-4fd4-b997-0c5e75d2feeb",
  aud: SOFTPHONE_HANDOFF_AUDIENCE,
  destinationNumber: "+13074051342",
  exp: Math.floor(now / 1000) + 120,
  iat: Math.floor(now / 1000),
  iss: SOFTPHONE_HANDOFF_ISSUER,
  nonce: "4a9dd9da-9316-4848-a849-ecb16e83eb53",
  personId: "42e9984a-41d2-4795-90eb-a5633aa3de76",
  personName: "Santi Close CRM",
  ...overrides,
});

const request = (handoff: string, origin = "https://softphone.example.com") =>
  new Request("https://softphone.example.com/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ handoff }),
  });

describe("softphone session", () => {
  it("exchanges a valid Twenty handoff for a short-lived Telnyx JWT", async () => {
    const handoff = await signSoftphoneHandoff(payload(), secret);
    const fetchTelnyx = vi.fn(
      async () =>
        new Response("header.payload.signature", {
          headers: { "Content-Type": "text/plain" },
          status: 201,
        }),
    );
    const handler = createSoftphoneSessionHandler(fetchTelnyx, () => now);

    const response = await handler(request(handoff), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      callerNumber: "+13072490829",
      destinationNumber: "+13074051342",
      personName: "Santi Close CRM",
      telnyxJwt: "header.payload.signature",
    });
    expect(fetchTelnyx).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/telephony_credentials/eec718ab-9e16-4042-ac54-ea2cb48143ef/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
      }),
    );
  });

  it("rejects expired and tampered handoffs before calling Telnyx", async () => {
    const expired = await signSoftphoneHandoff(
      payload({ exp: Math.floor(now / 1000) - 1 }),
      secret,
    );
    const fetchTelnyx = vi.fn();
    const handler = createSoftphoneSessionHandler(fetchTelnyx, () => now);

    expect((await handler(request(expired), env)).status).toBe(401);
    expect(
      (await handler(request(`${expired.slice(0, -1)}x`), env)).status,
    ).toBe(401);
    expect(fetchTelnyx).not.toHaveBeenCalled();
  });

  it("rejects cross-origin token exchange attempts", async () => {
    const handoff = await signSoftphoneHandoff(payload(), secret);
    const handler = createSoftphoneSessionHandler(vi.fn(), () => now);

    const response = await handler(
      request(handoff, "https://attacker.example.com"),
      env,
    );

    expect(response.status).toBe(403);
  });

  it("fails closed when runtime credentials are missing", async () => {
    const handoff = await signSoftphoneHandoff(payload(), secret);
    const handler = createSoftphoneSessionHandler(vi.fn(), () => now);

    const response = await handler(request(handoff), {});

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "softphone_is_not_configured",
    });
  });
});
