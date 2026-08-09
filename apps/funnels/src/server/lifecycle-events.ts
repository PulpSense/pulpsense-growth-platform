import type { FunnelEnv } from "./funnel-env";
import { json, parseJson } from "./http";

type FormEvent = "contact_submitted" | "application_submitted";

type FormSubmitBody = {
  event?: string;
  data?: Record<string, unknown>;
  submittedAt?: string;
};

const isFormEvent = (event: string | undefined): event is FormEvent =>
  event === "contact_submitted" || event === "application_submitted";

const taskIdFor = (env: FunnelEnv, funnelId: string, event: FormEvent) => {
  if (funnelId !== "creative-multiplier-sprint") return undefined;

  return {
    contact_submitted: env.CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID,
    application_submitted: env.CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID,
  }[event];
};

export async function handleFormSubmit(request: Request, env: FunnelEnv) {
  const body = await parseJson<FormSubmitBody>(request);

  if (!body || !isFormEvent(body.event)) {
    return json({ error: "Unknown event" }, 400);
  }

  const data = body.data ?? {};
  const funnelId =
    typeof data.funnelId === "string" ? data.funnelId : "default";
  const taskId = taskIdFor(env, funnelId, body.event);

  if (!env.PULPSENSE_TRIGGER_SECRET_KEY || !taskId) {
    return json(
      { ok: false, skipped: true, reason: "Trigger not configured" },
      202,
    );
  }

  const payload = {
    event: body.event,
    funnelId,
    data,
    submittedAt: body.submittedAt ?? new Date().toISOString(),
  };

  try {
    const response = await fetch(
      `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      },
    );

    return response.ok
      ? json({ ok: true })
      : json({ error: "Trigger delivery failed" }, 502);
  } catch {
    return json({ error: "Trigger delivery failed" }, 502);
  }
}
