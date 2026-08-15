import {
  twentySalesWebhookEventSchema,
  type TwentySalesWebhookEvent,
} from "@pulpsense/contracts";
import { z } from "zod";

import type { FunnelEnv } from "./funnel-env";
import { json } from "./http";

const MAX_WEBHOOK_AGE_MS = 5 * 60_000;
const relevantFields = new Set(["stage", "amount"]);

const currencyAmountSchema = z.object({
  amountMicros: z.number().finite().nonnegative(),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/u),
});

const twentyWebhookSchema = z
  .object({
    webhookId: z.string().min(1).max(200),
    eventName: z.string().min(1).max(200),
    workspaceId: z.string().min(1).max(200),
    eventDate: z.iso.datetime({ offset: true }),
    objectMetadata: z.object({
      id: z.string().min(1).max(200),
      nameSingular: z.string().min(1).max(200),
    }),
    record: z
      .object({
        id: z.string().min(1).max(200),
        pointOfContactId: z.string().min(1).max(200).optional(),
        prospectId: z.string().optional(),
        originatingLeadJourneyId: z.string().optional(),
        stage: z.string().min(1).max(200).optional(),
        pulpsenseSalesOutcome: z.enum(["won", "lost"]).optional(),
        amount: currencyAmountSchema.optional(),
      })
      .passthrough(),
    updatedFields: z.array(z.string().min(1).max(200)).max(100).optional(),
  })
  .passthrough();

const decodeHex = (value: string | null) => {
  if (!value || !/^[0-9a-f]{64}$/iu.test(value)) return undefined;
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
};

const verifySignature = async (
  rawBody: string,
  timestamp: string,
  signature: string | null,
  secret: string,
) => {
  const signatureBytes = decodeHex(signature);
  if (!signatureBytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(`${timestamp}:${rawBody}`),
  );
};

const enqueue = async (event: TwentySalesWebhookEvent, env: FunnelEnv) => {
  if (!env.PULPSENSE_TRIGGER_SECRET_KEY) {
    throw new Error("Trigger is not configured");
  }
  const response = await fetch(
    `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/process-twenty-sales-outcome/trigger`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: event,
        context: { environment: "production" },
        options: { idempotencyKey: event.eventId },
      }),
    },
  );
  if (!response.ok) throw new Error("Trigger rejected Twenty sales event");
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("Trigger response omitted run ID");
  return result.id;
};

export async function handleTwentySalesWebhook(
  request: Request,
  env: FunnelEnv,
) {
  if (
    !env.TWENTY_WEBHOOK_SECRET ||
    !env.TWENTY_PRODUCTION_WORKSPACE_ID ||
    env.PULPSENSE_ENVIRONMENT !== "production"
  ) {
    return json({ error: "twenty_webhook_unavailable" }, 503);
  }

  const timestamp = request.headers.get("x-twenty-webhook-timestamp");
  const timestampMs = timestamp ? Number(timestamp) : Number.NaN;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > MAX_WEBHOOK_AGE_MS
  ) {
    return json({ error: "stale_twenty_webhook" }, 401);
  }

  const rawBody = await request.text();
  if (
    !(await verifySignature(
      rawBody,
      timestamp!,
      request.headers.get("x-twenty-webhook-signature"),
      env.TWENTY_WEBHOOK_SECRET,
    ))
  ) {
    return json({ error: "invalid_twenty_signature" }, 401);
  }

  let untrusted: unknown;
  try {
    untrusted = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_twenty_payload" }, 400);
  }
  const parsed = twentyWebhookSchema.safeParse(untrusted);
  if (!parsed.success) {
    return json({ error: "invalid_twenty_payload" }, 400);
  }
  const webhook = parsed.data;
  if (webhook.workspaceId !== env.TWENTY_PRODUCTION_WORKSPACE_ID) {
    return json({ accepted: false, ignored: true, reason: "workspace" }, 202);
  }
  if (
    webhook.eventName !== "opportunity.updated" ||
    webhook.objectMetadata.nameSingular !== "opportunity" ||
    !webhook.updatedFields?.some((field) => relevantFields.has(field))
  ) {
    return json({ accepted: false, ignored: true, reason: "event" }, 202);
  }

  const { record } = webhook;
  if (
    !record.pointOfContactId ||
    !record.originatingLeadJourneyId ||
    !record.stage ||
    !record.amount
  ) {
    return json({ error: "twenty_sales_references_missing" }, 422);
  }
  const event = twentySalesWebhookEventSchema.safeParse({
    schemaVersion: 1,
    eventId: `twenty:${webhook.webhookId}:${record.id}:${webhook.eventDate}`,
    occurredAt: webhook.eventDate,
    workspaceId: webhook.workspaceId,
    opportunityId: record.id,
    personId: record.pointOfContactId,
    prospectId: record.prospectId,
    originatingLeadJourneyId: record.originatingLeadJourneyId,
    stageId: record.stage,
    previousOutcome: record.pulpsenseSalesOutcome,
    amount: record.amount.amountMicros / 1_000_000,
    currency: record.amount.currencyCode,
    updatedFields: webhook.updatedFields,
    environment: "production",
  });
  if (!event.success) {
    return json({ error: "twenty_sales_references_missing" }, 422);
  }

  try {
    const runId = await enqueue(event.data, env);
    return json({ accepted: true, eventId: event.data.eventId, runId }, 202);
  } catch {
    return json({ error: "handoff_failed" }, 502);
  }
}
