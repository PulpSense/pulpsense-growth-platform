import type { FunnelEvent } from "@pulpsense/contracts";

import type { FunnelEnv } from "../funnel-env";

export const enqueueFunnelEvent = async (
  event: FunnelEvent,
  env: FunnelEnv,
) => {
  const triggerSecret = env.PULPSENSE_TRIGGER_SECRET_KEY;
  if (!triggerSecret) throw new Error("Trigger is not configured");

  const response = await fetch(
    `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? "https://api.trigger.dev"}/api/v1/tasks/process-funnel-event/trigger`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${triggerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: event,
        context: { environment: event.environment },
        options: { idempotencyKey: event.eventId },
      }),
    },
  );
  if (!response.ok) throw new Error("Trigger rejected event");

  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("Trigger response omitted run ID");
  return result.id;
};
