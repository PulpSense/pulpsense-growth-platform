# Funnel rate limiter

This private Cloudflare Worker exposes the Workers-only native Rate Limiting binding to the funnel's Pages Functions through a service binding. It has no route or `workers.dev` hostname.

Pages sends only a SHA-256 digest of the endpoint and client IP. The Worker returns `204` when Cloudflare accepts the key and `429` when the key has exhausted its quota. The Pages Function fails closed if this service is absent or unavailable.

Cloudflare's native limiter is intentionally permissive and eventually consistent within each Cloudflare location. It protects upstream services from sustained abuse, but it is not an exact accounting mechanism and may allow a short burst beyond the configured threshold.

## Preview deployment

Authenticate Wrangler for the preview Cloudflare account, then deploy the service before deploying Pages:

```bash
pnpm --filter @pulpsense/rate-limiter deploy:preview
```

The Pages preview configuration binds `FUNNEL_RATE_LIMIT_SERVICE` to `pulpsense-funnel-rate-limiter-preview`.

## Production deployment

After the production Cloudflare account and destination are validated, deploy the isolated production Worker:

```bash
pnpm --filter @pulpsense/rate-limiter deploy:production
```

`wrangler.production.toml` deploys `pulpsense-funnel-rate-limiter` with a separate rate-limit namespace. The production Pages config binds only that service. Keep both Workers private and never point a preview Pages deployment at the production service, or a production deployment at the preview service.
