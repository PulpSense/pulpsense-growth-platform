# PulpSense Growth Platform

The shared monorepo for PulpSense acquisition funnels and durable growth automations.

## Workspace

```text
apps/
├── funnels/       # Astro + Cloudflare Pages funnel app
├── automations/   # Trigger.dev tasks
└── rate-limiter/  # Private Cloudflare Worker for native request limits
packages/
└── contracts/     # Shared validated event schemas when both apps consume them
```

The deployment seam is intentional: request-time validation and attribution stay with the funnel host, while durable after-submit workflows run in Trigger.dev.

## Commands

```bash
pnpm dev                 # Start the funnel app
pnpm dev:automations     # Start the Trigger.dev worker
pnpm build               # Build the funnel app
pnpm lint                # Lint the funnel app
pnpm check-types         # Type-check every workspace package
```

Run package-specific commands with `pnpm --filter @pulpsense/funnels …`, `pnpm --filter @pulpsense/automations …`, or `pnpm --filter @pulpsense/rate-limiter …`.

The current funnel behavior and the value-free runtime configuration inventory are recorded in:

- [`docs/funnel-parity-checklist.md`](docs/funnel-parity-checklist.md)
- [`docs/runtime-configuration.md`](docs/runtime-configuration.md)

## Deployment

The funnel builds as static Astro output and is served with Cloudflare Pages Functions. A private Worker supplies the Workers-only native rate-limit binding through a Pages service binding. Preview deployment and environment-isolation details are in [`docs/astro-cloudflare-preview.md`](docs/astro-cloudflare-preview.md). Production qualification, approval, cutover, and rollback are controlled by [`docs/release-runbook.md`](docs/release-runbook.md); attaching `go.pulpsense.com` always requires SHA-specific owner approval. Trigger.dev configuration lives with `apps/automations` and must never expose its secret to browser code.
