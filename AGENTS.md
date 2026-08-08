# AGENTS.md

Guidance for Codex when working in the PulpSense growth platform monorepo.

## Commands

```bash
pnpm dev                 # Start the Astro funnel app
pnpm dev:automations     # Start the Trigger.dev worker
pnpm build               # Production-build the funnel app
pnpm lint                # Lint the funnel app
pnpm check-types         # Type-check every workspace package
pnpm format              # Format the funnel app and workspace JSON/YAML
```

## Workspace architecture

```text
apps/
├── funnels/       # Request-time funnel application and public assets
└── automations/   # Durable Trigger.dev workflows
packages/
└── contracts/     # Shared validated event schemas once both apps consume them
```

Keep the deployment seam explicit:

- The funnel host owns synchronous validation, qualification, redirects, request-scoped attribution, and durable-task enqueue confirmation.
- Trigger.dev owns lead processing, downstream delivery, retries, enrichment, follow-ups, waits, and human-in-the-loop work.
- Never trigger private tasks directly from untrusted browser code with a secret.

Use pnpm for the whole workspace. Do not add npm lockfiles or Turborepo unless explicitly requested.

## Funnel app

The active implementation in `apps/funnels` is Astro static output for Cloudflare Pages, with React 19 islands and Tailwind CSS 4. The transitional Next.js 16 route files and rollback scripts remain until visual and behavioral parity is accepted.

Funnels are built for paid/direct traffic and are not intended to be discovered through organic search. Treat `noindex` and crawler blocking as intentional unless explicitly asked to make a funnel public.

The app follows props-driven layering:

1. Astro pages in `apps/funnels/src/pages/[funnel-name]/` compose server-rendered page shells and explicit client islands.
2. Content and React components under `apps/funnels/src/app/[funnel-name]/` remain the shared parity source and Next.js rollback reference.
3. Funnel primitives in `apps/funnels/src/components/funnel/` provide reusable shells, sections, CTAs, checklists, marquees, video grids, and legal footers.
4. Funnel-specific sections live under each funnel's `_components` directory.
5. Shared UI modules live in `apps/funnels/src/components/ui/`.

Keep funnel-specific assets under `apps/funnels/public/[funnel-name]/` and shared assets under `apps/funnels/public/assets/`.

## Automation app

Keep secrets in ignored `.env` files or Trigger.dev environment variables.

## Code standards

- ESLint with Next.js compatibility and TypeScript configs
- Prettier with the Tailwind plugin
- Prefix intentionally unused variables with `_`
- Use consistent type imports (`import type { X }`)
- Preserve the small event-enqueue interface between the two apps; add `packages/contracts` only when both apps consume the schema
