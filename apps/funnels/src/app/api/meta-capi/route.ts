import type { FunnelEnv } from "@/server/funnel-env";
import { handleMetaCapi } from "@/server/meta-conversions";

export const POST = (request: Request) =>
  handleMetaCapi(request, process.env as FunnelEnv);
