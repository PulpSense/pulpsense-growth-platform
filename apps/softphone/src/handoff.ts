export const SOFTPHONE_HANDOFF_AUDIENCE = "pulpsense-softphone";
export const SOFTPHONE_HANDOFF_ISSUER = "pulpsense-twenty";

export type SoftphoneHandoffPayload = {
  actorUserWorkspaceId: string;
  aud: typeof SOFTPHONE_HANDOFF_AUDIENCE;
  destinationNumber: string;
  exp: number;
  iat: number;
  iss: typeof SOFTPHONE_HANDOFF_ISSUER;
  nonce: string;
  personId: string;
  personName: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

const base64UrlToBytes = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importHmacKey = (secret: string, usages: KeyUsage[]) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    usages,
  );

export const signSoftphoneHandoff = async (
  payload: SoftphoneHandoffPayload,
  secret: string,
) => {
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`v1.${encodedPayload}`),
  );
  return `v1.${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`;
};

const isPayload = (value: unknown): value is SoftphoneHandoffPayload => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SoftphoneHandoffPayload>;
  return (
    payload.aud === SOFTPHONE_HANDOFF_AUDIENCE &&
    payload.iss === SOFTPHONE_HANDOFF_ISSUER &&
    typeof payload.actorUserWorkspaceId === "string" &&
    typeof payload.destinationNumber === "string" &&
    typeof payload.exp === "number" &&
    typeof payload.iat === "number" &&
    typeof payload.nonce === "string" &&
    typeof payload.personId === "string" &&
    typeof payload.personName === "string"
  );
};

export const verifySoftphoneHandoff = async (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<SoftphoneHandoffPayload> => {
  if (secret.length < 32) throw new Error("handoff_secret_is_not_configured");
  const [version, encodedPayload, encodedSignature, extra] = token.split(".");
  if (version !== "v1" || !encodedPayload || !encodedSignature || extra) {
    throw new Error("handoff_is_malformed");
  }

  const key = await importHmacKey(secret, ["verify"]);
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(encodedSignature),
    encoder.encode(`v1.${encodedPayload}`),
  );
  if (!validSignature) throw new Error("handoff_signature_is_invalid");

  let payload: unknown;
  try {
    payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload)));
  } catch {
    throw new Error("handoff_payload_is_invalid");
  }

  if (!isPayload(payload)) throw new Error("handoff_payload_is_invalid");
  if (payload.exp <= nowSeconds || payload.iat > nowSeconds + 30) {
    throw new Error("handoff_has_expired");
  }
  if (!/^\+[1-9]\d{7,14}$/u.test(payload.destinationNumber)) {
    throw new Error("handoff_destination_is_invalid");
  }
  return payload;
};
