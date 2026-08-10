export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

export const parseJson = async <T>(
  request: Request,
): Promise<T | undefined> => {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
};

export const getClientIp = (request: Request) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  request.headers.get("x-real-ip") ??
  "unknown";

export const rejectCrossOrigin = (request: Request) =>
  request.headers.get("origin") === new URL(request.url).origin
    ? undefined
    : json({ error: "origin_not_allowed" }, 403);
