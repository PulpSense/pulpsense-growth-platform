type RequestContextInput = {
  sourceUrl: string;
  referrer?: string;
  fbp?: string;
  fbc?: string;
  analyticsId?: string;
  sessionId?: string;
};

export const createRequestContext = (
  request: Request,
  clientIp: string,
  input: RequestContextInput,
) => ({
  clientIp,
  userAgent: request.headers.get("user-agent") ?? "",
  sourceUrl: input.sourceUrl,
  ...(input.referrer ? { referrer: input.referrer } : {}),
  ...(input.fbp ? { fbp: input.fbp } : {}),
  ...(input.fbc ? { fbc: input.fbc } : {}),
  ...(input.analyticsId ? { analyticsId: input.analyticsId } : {}),
  ...(input.sessionId ? { sessionId: input.sessionId } : {}),
});
