import {
  handleSoftphoneSession,
  type SoftphoneEnv,
} from "../../src/server/session";

type PagesContext = {
  env: SoftphoneEnv;
  request: Request;
};

export const onRequestPost = ({ request, env }: PagesContext) =>
  handleSoftphoneSession(request, env);
