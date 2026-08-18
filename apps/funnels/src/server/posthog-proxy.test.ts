import { describe, expect, it, vi } from "vitest";

import { handlePostHogProxy } from "./posthog-proxy";

describe("handlePostHogProxy", () => {
  it("forwards event payloads to PostHog without first-party credentials", async () => {
    let forwarded: Request | undefined;
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      forwarded = request as Request;
      return new Response("ok");
    });
    const request = new Request("https://go.pulpsense.com/e/e/?ip=1", {
      method: "POST",
      headers: {
        Authorization: "Bearer private-site-token",
        Cookie: "session=private",
        "CF-Connecting-IP": "203.0.113.9",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event: "funnel_viewed" }),
    });

    const response = await handlePostHogProxy(request, {
      fetch: fetcher as typeof fetch,
    });

    expect(response.status).toBe(200);
    expect(forwarded?.url).toBe("https://us.i.posthog.com/e/?ip=1");
    expect(forwarded?.headers.get("authorization")).toBeNull();
    expect(forwarded?.headers.get("cookie")).toBeNull();
    expect(forwarded?.headers.get("x-forwarded-for")).toBe("203.0.113.9");
    await expect(forwarded?.json()).resolves.toEqual({
      event: "funnel_viewed",
    });
  });

  it("preserves query parameters on the exact proxy route", async () => {
    let forwarded: Request | undefined;
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      forwarded = request as Request;
      return new Response("ok");
    });

    await handlePostHogProxy(new Request("https://go.pulpsense.com/e?ip=1"), {
      fetch: fetcher as typeof fetch,
    });

    expect(forwarded?.url).toBe("https://us.i.posthog.com/?ip=1");
  });

  it("routes and caches PostHog recorder assets", async () => {
    const cachedResponse = new Response("cached recorder");
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
    };
    const waitUntil = vi.fn();
    const fetcher = vi.fn(async () => cachedResponse.clone());

    const response = await handlePostHogProxy(
      new Request("https://go.pulpsense.com/e/static/recorder.js?v=1"),
      {
        fetch: fetcher as typeof fetch,
        cache,
        waitUntil,
      },
    );

    expect(await response.text()).toBe("cached recorder");
    expect(fetcher).toHaveBeenCalledWith(
      "https://us-assets.i.posthog.com/static/recorder.js?v=1",
    );
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0]![0];
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("uses cached assets without calling PostHog", async () => {
    const cache = {
      match: vi.fn(async () => new Response("cached")),
      put: vi.fn(async () => undefined),
    };
    const fetcher = vi.fn();

    const response = await handlePostHogProxy(
      new Request("https://go.pulpsense.com/e/array/config.js"),
      { fetch: fetcher as typeof fetch, cache },
    );

    expect(await response.text()).toBe("cached");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves HEAD semantics for asset requests", async () => {
    let forwarded: Request | undefined;
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      forwarded = request as Request;
      return new Response(null, { headers: { "Content-Length": "124348" } });
    });

    const response = await handlePostHogProxy(
      new Request("https://go.pulpsense.com/e/static/recorder.js", {
        method: "HEAD",
      }),
      { fetch: fetcher as typeof fetch },
    );

    expect(response.body).toBeNull();
    expect(forwarded?.method).toBe("HEAD");
    expect(forwarded?.url).toBe(
      "https://us-assets.i.posthog.com/static/recorder.js",
    );
  });

  it("keeps asset delivery independent from cache availability", async () => {
    const cache = {
      match: vi.fn(async () => {
        throw new Error("cache unavailable");
      }),
      put: vi.fn(async () => undefined),
    };
    const fetcher = vi.fn(async () => new Response("recorder"));

    const response = await handlePostHogProxy(
      new Request("https://go.pulpsense.com/e/static/recorder.js"),
      { fetch: fetcher as typeof fetch, cache },
    );

    expect(await response.text()).toBe("recorder");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects unsupported methods and contains upstream failures", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("upstream unavailable");
    });

    const rejected = await handlePostHogProxy(
      new Request("https://go.pulpsense.com/e/e/", { method: "DELETE" }),
      { fetch: fetcher as typeof fetch },
    );
    const unavailable = await handlePostHogProxy(
      new Request("https://go.pulpsense.com/e/e/", { method: "POST" }),
      { fetch: fetcher as typeof fetch },
    );

    expect(rejected.status).toBe(405);
    expect(rejected.headers.get("allow")).toBe("GET, HEAD, POST, OPTIONS");
    expect(unavailable.status).toBe(502);
  });
});
