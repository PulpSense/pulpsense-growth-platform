const POSTHOG_PROXY_PREFIX = "/e";
const POSTHOG_API_ORIGIN = "https://us.i.posthog.com";
const POSTHOG_ASSET_ORIGIN = "https://us-assets.i.posthog.com";

type ProxyCache = Pick<Cache, "match" | "put">;

type PostHogProxyRuntime = {
  fetch: typeof fetch;
  cache?: ProxyCache;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const isAssetPath = (pathname: string) =>
  pathname.startsWith("/static/") || pathname.startsWith("/array/");

const upstreamPath = (url: URL) => {
  if (url.pathname === POSTHOG_PROXY_PREFIX) return `/${url.search}`;
  if (!url.pathname.startsWith(`${POSTHOG_PROXY_PREFIX}/`)) return undefined;

  return `${url.pathname.slice(POSTHOG_PROXY_PREFIX.length)}${url.search}`;
};

const methodNotAllowed = () =>
  new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD, POST, OPTIONS" },
  });

const forwardAsset = async (
  request: Request,
  path: string,
  runtime: PostHogProxyRuntime,
) => {
  const fetcher = runtime.fetch;
  const assetUrl = `${POSTHOG_ASSET_ORIGIN}${path}`;
  if (request.method === "HEAD") {
    return fetcher(
      new Request(assetUrl, {
        method: "HEAD",
        redirect: request.redirect,
      }),
    );
  }

  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await runtime.cache?.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  const response = await fetcher(assetUrl);
  if (response.ok && runtime.cache && runtime.waitUntil) {
    runtime.waitUntil(
      runtime.cache.put(cacheKey, response.clone()).catch(() => undefined),
    );
  }

  return response;
};

const forwardIngestion = async (
  request: Request,
  path: string,
  runtime: PostHogProxyRuntime,
) => {
  const fetcher = runtime.fetch;
  const headers = new Headers(request.headers);
  const clientIp = headers.get("CF-Connecting-IP") ?? "";

  headers.delete("authorization");
  headers.delete("connection");
  headers.delete("cookie");
  headers.delete("host");
  headers.delete("proxy-authorization");
  headers.set("X-Forwarded-For", clientIp);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.arrayBuffer();
  const upstreamRequest = new Request(`${POSTHOG_API_ORIGIN}${path}`, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
  });

  return fetcher(upstreamRequest);
};

export async function handlePostHogProxy(
  request: Request,
  runtime: PostHogProxyRuntime,
) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  if (!["GET", "HEAD", "POST"].includes(request.method)) {
    return methodNotAllowed();
  }

  const url = new URL(request.url);
  const path = upstreamPath(url);
  if (!path) return new Response("Not found", { status: 404 });

  try {
    return isAssetPath(path)
      ? await forwardAsset(request, path, runtime)
      : await forwardIngestion(request, path, runtime);
  } catch (error) {
    console.warn("PostHog proxy delivery failed", error);
    return new Response("PostHog proxy unavailable", { status: 502 });
  }
}
