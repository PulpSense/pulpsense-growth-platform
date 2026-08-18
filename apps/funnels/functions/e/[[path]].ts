import { handlePostHogProxy } from "../../src/server/posthog-proxy";

type PagesContext = {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
};

type WorkerCacheStorage = CacheStorage & { default: Cache };

export const onRequest = ({ request, waitUntil }: PagesContext) =>
  handlePostHogProxy(request, {
    fetch,
    cache: (caches as WorkerCacheStorage).default,
    waitUntil,
  });
