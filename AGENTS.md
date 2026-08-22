# AGENTS.md

Guidance for Codex when working in the PulpSense growth platform monorepo.

## Commands

```bash
pnpm dev                 # Start the Astro funnel app
pnpm dev:automations     # Start the Trigger.dev worker
pnpm build               # Production-build the funnel app
pnpm lint                # Lint every workspace package
pnpm check-types         # Type-check every workspace package
pnpm format              # Format the funnel app and workspace JSON/YAML
```

## Workspace architecture

```text
apps/
├── funnels/       # Request-time funnel application and public assets
├── automations/   # Durable Trigger.dev workflows
└── rate-limiter/  # Private Worker exposing Cloudflare's native limiter
packages/
└── contracts/     # Shared validated event schemas once both apps consume them
```

Keep the deployment seam explicit:

- The funnel host owns synchronous validation, qualification, redirects, request-scoped attribution, and durable-task enqueue confirmation.
- The rate-limiter Worker owns native Cloudflare request limits and is reachable only through a Pages service binding.
- Trigger.dev owns lead processing, downstream delivery, retries, enrichment, follow-ups, waits, and human-in-the-loop work.
- Never trigger private tasks directly from untrusted browser code with a secret.

Use pnpm for the whole workspace. Do not add npm lockfiles or Turborepo unless explicitly requested.

## Funnel app

The implementation in `apps/funnels` is Astro static output for Cloudflare Pages, with React 19 islands and Tailwind CSS 4. Cloudflare Pages deployments and git history are the rollback references; do not reintroduce a parallel framework runtime.

Funnels are built for paid/direct traffic and are not intended to be discovered through organic search. Treat `noindex` and crawler blocking as intentional unless explicitly asked to make a funnel public.

The app follows props-driven layering:

1. Astro pages in `apps/funnels/src/pages/[funnel-name]/` compose server-rendered page shells and explicit client islands.
2. Funnel content and React components live under `apps/funnels/src/funnels/[funnel-name]/`.
3. Funnel primitives in `apps/funnels/src/components/funnel/` provide reusable shells, sections, CTAs, checklists, marquees, video grids, and legal footers.
4. Funnel-specific sections live under each funnel's `components` directory.
5. Shared UI modules live in `apps/funnels/src/components/ui/`.

Keep funnel-specific assets under `apps/funnels/public/[funnel-name]/` and shared assets under `apps/funnels/public/assets/`.

## Automation app

Keep secrets in ignored `.env` files or Trigger.dev environment variables.

Use `santi@go.pulpsense.com` as the sender and reply-to address for all
funnel-originated email. Keep funnel email paths on the shared configured
sender instead of introducing message-specific sender variables.

### Slack notifications

All new Slack messages must follow
[`docs/slack-notification-standard.md`](docs/slack-notification-standard.md).
Use the shared formatter in
`apps/automations/src/trigger/slack-notifications.ts` instead of assembling
message text inside a task, and keep link unfurls disabled.

## Code standards

- ESLint with TypeScript configs
- Prettier with the Tailwind plugin
- Prefix intentionally unused variables with `_`
- Use consistent type imports (`import type { X }`)
- Preserve the small event-enqueue interface between the two apps; add `packages/contracts` only when both apps consume the schema

<!-- TRIGGER.DEV SKILLS START -->

## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-tasks`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.

<!-- TRIGGER.DEV SKILLS END -->
