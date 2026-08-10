import type { FunnelEnv } from "./funnel-env";
import { processApplicationSubmission } from "./funnel-events/application";
import { processContactSubmission } from "./funnel-events/contact";
import { parseJson, rejectCrossOrigin } from "./http";

const isApplicationSubmission = (body: unknown) =>
  Boolean(
    body &&
    typeof body === "object" &&
    "eventType" in body &&
    body.eventType === "application_submitted",
  );

export async function handleFunnelEvent(request: Request, env: FunnelEnv) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await parseJson<unknown>(request);
  return isApplicationSubmission(body)
    ? processApplicationSubmission(body, request, env)
    : processContactSubmission(body, request, env);
}
