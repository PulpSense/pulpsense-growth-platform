# CLAUDE.md

This is the PulpSense growth platform pnpm monorepo.

```text
apps/funnels       Transitional Next.js funnel app; not currently deployed
apps/automations   Trigger.dev durable workflows
packages/contracts Shared schemas once both apps consume them
```

Use `pnpm dev`, `pnpm build`, `pnpm lint`, and `pnpm check-types` from the repository root. Start Trigger.dev with `pnpm dev:automations`.

Keep request-time validation, qualification, redirects, and attribution in the funnel host. Keep retryable after-submit work in Trigger.dev. Never expose a Trigger.dev secret to browser code.

Funnels are paid/direct-traffic pages. Preserve `noindex` and crawler blocking unless explicitly asked to make a funnel discoverable.
