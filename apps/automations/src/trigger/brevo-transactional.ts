export type BrevoTransactionalMessage = {
  recipientEmail: string;
  recipientName: string;
  senderEmail: string;
  senderName: string;
  replyToEmail: string;
  subject: string;
  textContent: string;
  htmlContent: string;
  moduleId: string;
  idempotencyKey: string;
};

export type BrevoTransactionalResult = {
  messageId: string;
};

export class BrevoTransactionalError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { retryable: boolean; status?: number }) {
    super(message);
    this.name = "BrevoTransactionalError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

type BrevoResponse = { messageId?: string; message?: string };

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const parseResponse = async (response: Response): Promise<BrevoResponse> => {
  try {
    return (await response.json()) as BrevoResponse;
  } catch {
    return {};
  }
};

export const sendBrevoTransactionalEmail = async (
  message: BrevoTransactionalMessage,
  environment: {
    BREVO_API_KEY?: string;
    BREVO_PRECALL_SENDER_EMAIL?: string;
    BREVO_PRECALL_SENDER_NAME?: string;
    BREVO_PRECALL_REPLY_TO_EMAIL?: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<BrevoTransactionalResult> => {
  const apiKey = required(environment.BREVO_API_KEY, "BREVO_API_KEY");
  const senderEmail = required(
    environment.BREVO_PRECALL_SENDER_EMAIL ?? message.senderEmail,
    "BREVO_PRECALL_SENDER_EMAIL",
  );
  const senderName =
    environment.BREVO_PRECALL_SENDER_NAME ?? message.senderName;
  const replyToEmail = required(
    environment.BREVO_PRECALL_REPLY_TO_EMAIL ?? message.replyToEmail,
    "BREVO_PRECALL_REPLY_TO_EMAIL",
  );

  let response: Response;
  try {
    response = await fetcher("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
        "x-idempotency-key": message.idempotencyKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        replyTo: { email: replyToEmail },
        to: [{ email: message.recipientEmail, name: message.recipientName }],
        subject: message.subject,
        textContent: message.textContent,
        htmlContent: message.htmlContent,
        tags: ["pulpsense", "precall", "precall-v1", message.moduleId],
      }),
    });
  } catch {
    throw new BrevoTransactionalError("Brevo transactional request failed", {
      retryable: true,
    });
  }

  const result = await parseResponse(response);
  if (!response.ok) {
    throw new BrevoTransactionalError("Brevo transactional send failed", {
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
    });
  }
  if (!result.messageId) {
    throw new BrevoTransactionalError(
      "Brevo transactional response omitted message ID",
      { retryable: true },
    );
  }
  return { messageId: result.messageId };
};
