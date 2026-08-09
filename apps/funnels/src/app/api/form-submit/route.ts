import type { FunnelEnv } from "@/server/funnel-env";
import { handleFormSubmit } from "@/server/lifecycle-events";

export const POST = (request: Request) =>
  handleFormSubmit(request, process.env as FunnelEnv);
