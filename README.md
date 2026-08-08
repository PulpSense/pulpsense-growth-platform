# PulpSense Growth Platform

The shared monorepo for PulpSense acquisition funnels and durable growth automations.

## Workspace

```text
apps/
├── funnels/       # Transitional Next.js funnel app
└── automations/   # Trigger.dev tasks
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

Run package-specific commands with `pnpm --filter @pulpsense/funnels …` or `pnpm --filter @pulpsense/automations …`.

The current funnel behavior and the value-free runtime configuration inventory are recorded in:

- [`docs/funnel-parity-checklist.md`](docs/funnel-parity-checklist.md)
- [`docs/runtime-configuration.md`](docs/runtime-configuration.md)

## Deployment

This checkpoint does not define an active funnel deployment target. A separate change will migrate the parity baseline to Astro and Cloudflare Pages before a production hostname is attached. Trigger.dev configuration lives with `apps/automations` and must never expose its secret to browser code.
