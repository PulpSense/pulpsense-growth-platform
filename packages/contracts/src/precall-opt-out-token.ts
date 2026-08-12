export type PrecallOptOutClaims = {
  email: string;
  submissionId: string;
  sequenceId: string;
  expiresAt: number;
};

const context = new TextEncoder().encode("pulpsense-precall-opt-out:v1");

const encode = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const decode = (value: string) => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const keyFor = async (secret: string, usages: ("encrypt" | "decrypt")[]) => {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`precall-opt-out:${secret}`));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, usages);
};

export const createPrecallOptOutToken = async (
  claims: PrecallOptOutClaims,
  secret: string,
) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(secret, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: context },
    key,
    new TextEncoder().encode(JSON.stringify(claims)),
  );
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
};

export const readPrecallOptOutToken = async (
  token: string,
  secret: string,
  now = Date.now(),
): Promise<PrecallOptOutClaims> => {
  const [ivPart, ciphertextPart] = token.split(".");
  if (!ivPart || !ciphertextPart) throw new Error("Invalid pre-call opt-out token");
  const key = await keyFor(secret, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(ivPart), additionalData: context },
    key,
    decode(ciphertextPart),
  );
  const claims = JSON.parse(new TextDecoder().decode(plaintext)) as PrecallOptOutClaims;
  if (!claims.email || !claims.submissionId || !claims.sequenceId || claims.expiresAt <= now) {
    throw new Error("Expired or invalid pre-call opt-out token");
  }
  return claims;
};
