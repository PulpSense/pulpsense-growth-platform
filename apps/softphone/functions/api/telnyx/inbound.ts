import { handleInboundCall } from "../../../src/server/inbound-call";
import type { SoftphoneEnv } from "../../../src/server/session";

type PagesContext = {
  env: SoftphoneEnv;
  request: Request;
};

export const onRequestPost = ({ request, env }: PagesContext) =>
  handleInboundCall(request, env);
