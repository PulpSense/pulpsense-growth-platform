import { describe, expect, it, vi } from "vitest";
import {
  BrevoTransactionalError,
  sendBrevoTransactionalEmail,
} from "./brevo-transactional.js";

const message = {
  recipientEmail: "lead@example.com",
  recipientName: "Lead",
  senderEmail: "santi@pulpsense.com",
  senderName: "Santi",
  replyToEmail: "santi@pulpsense.com",
  subject: "You're booked",
  textContent: "Hello",
  htmlContent: "<p>Hello</p>",
  moduleId: "confirmation",
  idempotencyKey: "precall-slot:sequence:confirmation",
};

const environment = {
  BREVO_API_KEY: "test-key",
  BREVO_PRECALL_SENDER_EMAIL: "santi@pulpsense.com",
  BREVO_PRECALL_SENDER_NAME: "Santi",
  BREVO_PRECALL_REPLY_TO_EMAIL: "santi@pulpsense.com",
};

describe("Brevo transactional adapter", () => {
  it("sends immediate text and HTML content with stable transport identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "<brevo-message-id>" }), {
        status: 201,
      }),
    );

    await expect(
      sendBrevoTransactionalEmail(message, environment, fetcher),
    ).resolves.toEqual({ messageId: "<brevo-message-id>" });
    const [url, request] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(request?.method).toBe("POST");
    expect(request?.headers).toEqual(
      expect.objectContaining({
        "x-idempotency-key": message.idempotencyKey,
      }),
    );
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        textContent: message.textContent,
        htmlContent: message.htmlContent,
        tags: expect.arrayContaining(["precall", "confirmation"]),
      }),
    );
    expect(body).not.toHaveProperty("scheduledAt");
  });

  it.each([429, 500, 503])("marks %s as retryable", async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status }),
    );
    const error = await sendBrevoTransactionalEmail(
      message,
      environment,
      fetcher,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BrevoTransactionalError);
    expect((error as BrevoTransactionalError).retryable).toBe(true);
  });

  it("does not expose response details in operational errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "lead@example.com leaked" }), {
        status: 400,
      }),
    );
    const error = await sendBrevoTransactionalEmail(
      message,
      environment,
      fetcher,
    ).catch((caught: unknown) => caught);
    expect(String(error)).not.toContain("lead@example.com");
    expect((error as BrevoTransactionalError).retryable).toBe(false);
  });
});
