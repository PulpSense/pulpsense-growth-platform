type RateLimiterEnv = {
  FUNNEL_RATE_LIMITER: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
};

const worker = {
  async fetch(request: Request, env: RateLimiterEnv) {
    const key = await request.text();
    const result = await env.FUNNEL_RATE_LIMITER.limit({ key });

    return new Response(null, { status: result.success ? 204 : 429 });
  },
};

export default worker;
