import { handleMetaCapi, type FunnelEnv } from '@/server/funnel-api';

export const POST = (request: Request) =>
  handleMetaCapi(request, process.env as FunnelEnv);
