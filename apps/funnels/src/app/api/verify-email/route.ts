import { handleVerifyEmail, type FunnelEnv } from '@/server/funnel-api';

export const POST = (request: Request) =>
  handleVerifyEmail(request, process.env as FunnelEnv);
