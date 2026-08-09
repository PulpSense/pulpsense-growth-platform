import { handleVerifyEmail } from "@/server/email-verification";
import type { FunnelEnv } from "@/server/funnel-env";

export const POST = (request: Request) =>
  handleVerifyEmail(request, process.env as FunnelEnv);
