import type { FunnelEnv } from "./funnel-env";

type PagesContext = {
  request: Request;
  env: FunnelEnv;
};

type RequestHandler = (
  request: Request,
  env: FunnelEnv,
) => Response | Promise<Response>;

export const createPagesPostHandler =
  (handler: RequestHandler) =>
  ({ request, env }: PagesContext) =>
    handler(request, env);
