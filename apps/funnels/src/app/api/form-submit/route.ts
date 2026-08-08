import { handleFormSubmit, type FunnelEnv } from '@/server/funnel-api';

export const POST = (request: Request) =>
  handleFormSubmit(request, process.env as FunnelEnv);
