# AGENTS.md

Guidance for Codex when working in the PulpSense growth platform monorepo.

## Commands

```bash
pnpm dev                 # Start the Next.js funnel app
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

The transitional implementation in `apps/funnels` is Next.js 16, React 19, and Tailwind CSS 4. It has no active deployment target in this checkpoint; a separate change will migrate it to Astro and Cloudflare Pages.

Funnels are built for paid/direct traffic and are not intended to be discovered through organic search. Treat `noindex` and crawler blocking as intentional unless explicitly asked to make a funnel public.

The app follows props-driven layering:

1. Pages in `apps/funnels/src/app/[funnel-name]/` define content as props.
2. Funnel primitives in `apps/funnels/src/components/funnel/` provide reusable shells, sections, CTAs, checklists, marquees, video grids, and legal footers.
3. Funnel-specific sections live under each funnel's `_components` directory.
4. Shared UI modules live in `apps/funnels/src/components/ui/`.

Keep funnel-specific assets under `apps/funnels/public/[funnel-name]/` and shared assets under `apps/funnels/public/assets/`.

## Automation app

Keep secrets in ignored `.env` files or Trigger.dev environment variables.

## Code standards

- ESLint with Next.js and TypeScript configs
- Prettier with the Tailwind plugin
- Prefix intentionally unused variables with `_`
- Use consistent type imports (`import type { X }`)
- Preserve the small event-enqueue interface between the two apps; add `packages/contracts` only when both apps consume the schema
