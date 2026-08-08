import {
  handleFormSubmit,
  type FunnelEnv,
} from '../../src/server/funnel-api';

type PagesContext = {
  request: Request;
  env: FunnelEnv;
};

export const onRequestPost = ({ request, env }: PagesContext) =>
  handleFormSubmit(request, env);
