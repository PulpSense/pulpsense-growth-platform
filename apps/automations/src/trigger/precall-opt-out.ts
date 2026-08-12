import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

const payloadSchema = z
  .object({
    eventType: z.literal("precall_opted_out"),
    eventId: z.string().min(1).max(500),
    submissionId: z.string().uuid(),
    email: z.string().email().max(320),
    sequenceId: z.string().min(1).max(500),
    occurredAt: z.string().datetime({ offset: true }),
    environment: z.enum(["local", "preview", "production"]),
  })
  .strict();

const headers = (apiKey: string) => ({
  "api-key": apiKey,
  Accept: "application/json",
  "Content-Type": "application/json",
});

export const processPrecallOptOutTask = schemaTask({
  id: "process-precall-opt-out",
  schema: payloadSchema,
  retry: { maxAttempts: 3 },
  run: async (payload) => {
    if (payload.environment !== process.env.PULPSENSE_AUTOMATION_ENVIRONMENT) {
      throw new Error("Pre-call opt-out environment does not match destinations");
    }
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error("BREVO_API_KEY is not configured");
    const endpoint = `https://api.brevo.com/v3/contacts/${encodeURIComponent(payload.email)}`;
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: headers(apiKey),
      body: JSON.stringify({
        attributes: {
          PULPSENSE_PRECALL_STATUS: "opted_out",
          PULPSENSE_PRECALL_OPTED_OUT_AT: payload.occurredAt,
        },
      }),
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`Brevo opt-out update failed (${response.status})`);
    }
    return { optedOut: true as const, sequenceId: payload.sequenceId };
  },
});
