import {
  contactSubmittedEventSchema,
  funnelIdSchema,
  prospectIdSchema,
  type ContactSubmittedEvent,
  type FunnelId,
} from "@pulpsense/contracts";

import type { ContactSubmissionRequest } from "../contact-submission-contract";
import type { EmailVerification } from "../email-verification";

const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

const decodeBase64Url = (value: string) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importHmacKey = (secret: string, usages: KeyUsage[]) =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );

export const deriveProspectId = async (email: string, secret: string) => {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `pulpsense-prospect:v1:${email.trim().toLowerCase()}`,
    ),
  );
  const digest = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `prospect_v1_${digest}`;
};

export const digestContactSubmission = async (
  request: ContactSubmissionRequest,
) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({
        funnelId: request.funnelId,
        attemptId: request.attemptId,
        payload: request.payload,
        attribution: request.attribution,
        sourceUrl: request.sourceUrl,
        referrer: request.referrer ?? null,
        fbp: request.fbp ?? null,
        fbc: request.fbc ?? null,
        analyticsId: request.analyticsId ?? null,
      }),
    ),
  );

  return encodeBase64Url(new Uint8Array(digest));
};

export type RetryClaims = {
  submissionId: string;
  prospectId: string;
  requestDigest: string;
  emailVerification: EmailVerification;
  contact: ContactSubmittedEvent["payload"];
  attribution: ContactSubmittedEvent["attribution"];
};

type BookingClaims = {
  submissionId: string;
  prospectId: string;
  funnelId: FunnelId;
  qualificationStatus: "qualified";
  contact: ContactSubmittedEvent["payload"] & {
    emailVerification: { status: "verified"; result: "business" };
  };
  attribution: ContactSubmittedEvent["attribution"];
  requestContext: ContactSubmittedEvent["requestContext"];
  environment: ContactSubmittedEvent["environment"];
};

export const createRetryToken = async (claims: RetryClaims, secret: string) => {
  const encoder = new TextEncoder();
  const encodedClaims = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedClaims),
  );

  return `${encodedClaims}.${encodeBase64Url(new Uint8Array(signature))}`;
};

const bookingTokenContext = new TextEncoder().encode(
  "pulpsense-booking-identity:v1",
);

const importBookingKey = async (secret: string, usages: KeyUsage[]) => {
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`booking-token:${secret}`),
  );
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    usages,
  );
};

export const createBookingToken = async (
  claims: BookingClaims,
  secret: string,
) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importBookingKey(secret, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: bookingTokenContext },
    key,
    new TextEncoder().encode(JSON.stringify(claims)),
  );

  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
};

export const deriveSubmissionId = async (
  attemptId: string,
  requestDigest: string,
  secret: string,
) => {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`submission:${attemptId}:${requestDigest}`),
    ),
  ).slice(0, 16);
  signature[6] = (signature[6]! & 0x0f) | 0x40;
  signature[8] = (signature[8]! & 0x3f) | 0x80;
  const hex = Array.from(signature, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const readRetryToken = async (
  token: string,
  secret: string,
): Promise<RetryClaims | undefined> => {
  try {
    const [encodedClaims, encodedSignature, extra] = token.split(".");
    if (!encodedClaims || !encodedSignature || extra) return undefined;

    const key = await importHmacKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedClaims),
    );
    if (!valid) return undefined;

    const claims = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedClaims)),
    ) as RetryClaims;
    if (
      typeof claims.submissionId !== "string" ||
      !prospectIdSchema.safeParse(claims.prospectId).success ||
      typeof claims.requestDigest !== "string" ||
      (claims.emailVerification?.status !== "verified" &&
        claims.emailVerification?.status !== "unverified") ||
      !["business", "catch_all", "provider_error"].includes(
        claims.emailVerification.result,
      ) ||
      !contactSubmittedEventSchema.shape.payload.safeParse(claims.contact)
        .success ||
      !contactSubmittedEventSchema.shape.attribution.safeParse(
        claims.attribution,
      ).success
    ) {
      return undefined;
    }

    return claims;
  } catch {
    return undefined;
  }
};

export const readBookingToken = async (
  token: string,
  secret: string,
): Promise<BookingClaims | undefined> => {
  try {
    const [version, encodedIv, encodedCiphertext, extra] = token.split(".");
    if (version !== "v1" || !encodedIv || !encodedCiphertext || extra) {
      return undefined;
    }

    const key = await importBookingKey(secret, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(encodedIv),
        additionalData: bookingTokenContext,
      },
      key,
      decodeBase64Url(encodedCiphertext),
    );
    const claims = JSON.parse(
      new TextDecoder().decode(plaintext),
    ) as BookingClaims;
    const contact = contactSubmittedEventSchema.shape.payload.safeParse(
      claims.contact,
    );
    if (
      !contactSubmittedEventSchema.shape.submissionId.safeParse(
        claims.submissionId,
      ).success ||
      !prospectIdSchema.safeParse(claims.prospectId).success ||
      !funnelIdSchema.safeParse(claims.funnelId).success ||
      claims.qualificationStatus !== "qualified" ||
      !contact.success ||
      contact.data.emailVerification.status !== "verified" ||
      contact.data.emailVerification.result !== "business" ||
      !contactSubmittedEventSchema.shape.attribution.safeParse(
        claims.attribution,
      ).success ||
      !contactSubmittedEventSchema.shape.requestContext.safeParse(
        claims.requestContext,
      ).success ||
      !contactSubmittedEventSchema.shape.environment.safeParse(
        claims.environment,
      ).success
    ) {
      return undefined;
    }

    return claims;
  } catch {
    return undefined;
  }
};
