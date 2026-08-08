# PulpSense Automations

The shared home for PulpSense background jobs, scheduled workflows, and durable automations, powered by [Trigger.dev](https://trigger.dev/).

## Setup

1. Create or select the PulpSense project in the Trigger.dev dashboard.
2. Confirm the existing project reference in `trigger.config.ts` is the intended project.
3. Copy `.env.example` to `.env` and add the project's **DEV** secret key.
4. From the monorepo root, start the local Trigger.dev worker:

   ```bash
   pnpm dev:automations
   ```

The starter task is `health-check`. Once the dev worker registers it, run it from the Trigger.dev dashboard with an optional payload:

```json
{
  "message": "Hello from PulpSense"
}
```

## Commands

- `pnpm --filter @pulpsense/automations dev` — run tasks locally and register them with Trigger.dev
- `pnpm --filter @pulpsense/automations deploy` — deploy the current task set
- `pnpm --filter @pulpsense/automations check-types` — validate the TypeScript project

## Adding an automation

Create a named task export in `src/trigger/` with a unique, stable `id`. Keep secrets in Trigger.dev environment variables or local `.env` files; never commit them.
