import { leadMagnetOptInEventSchema } from "@pulpsense/contracts";
import { logger, schemaTask } from "@trigger.dev/sdk";

import { sendBrevoTransactionalEmail } from "./brevo-transactional.js";

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

export const processLeadMagnetOptInTask = schemaTask({
  id: "process-lead-magnet-opt-in",
  schema: leadMagnetOptInEventSchema,
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (event) => {
    const apiKey = required(process.env.BREVO_API_KEY, "BREVO_API_KEY");
    const listId = Number(
      required(
        process.env.BREVO_LEAD_MAGNETS_LIST_ID,
        "BREVO_LEAD_MAGNETS_LIST_ID",
      ),
    );
    if (!Number.isInteger(listId) || listId <= 0) {
      throw new Error("BREVO_LEAD_MAGNETS_LIST_ID must be a positive integer");
    }

    const upsert = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: event.email,
        attributes: { FIRSTNAME: event.firstName },
        listIds: [listId],
        updateEnabled: true,
      }),
    });
    if (!upsert.ok && upsert.status !== 204) {
      throw new Error(
        `Brevo lead-magnet contact upsert failed (${upsert.status})`,
      );
    }

    const result = await sendBrevoTransactionalEmail(
      {
        recipientEmail: event.email,
        recipientName: event.firstName,
        senderEmail: "santi@pulpsense.com",
        senderName: "Santi at PulpSense",
        replyToEmail: "santi@pulpsense.com",
        subject: event.emailContent.subject,
        textContent: event.emailContent.text,
        htmlContent: event.emailContent.html,
        moduleId: event.magnetId,
        idempotencyKey: event.deliveryId,
        tags: ["pulpsense", "lead-magnet", event.magnetId],
      },
      {
        BREVO_API_KEY: apiKey,
        BREVO_PRECALL_SENDER_EMAIL: process.env.BREVO_LEAD_MAGNET_SENDER_EMAIL,
        BREVO_PRECALL_SENDER_NAME: process.env.BREVO_LEAD_MAGNET_SENDER_NAME,
        BREVO_PRECALL_REPLY_TO_EMAIL:
          process.env.BREVO_LEAD_MAGNET_REPLY_TO_EMAIL,
      },
    );

    logger.info("Lead magnet delivered", {
      magnetId: event.magnetId,
      deliveryId: event.deliveryId,
      messageId: result.messageId,
    });
    return { delivered: true, messageId: result.messageId };
  },
});
