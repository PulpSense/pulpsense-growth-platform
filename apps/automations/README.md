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

The starter task is `health-check`. The public funnel task is `process-funnel-event`; it validates the shared versioned contact/application/booking contract, upserts the Person in Twenty, records each completed application and verified Cal booking as an immutable Person Note, maintains the qualified Opportunity lifecycle, and delivers the matching Meta event.

Twenty and Meta operations retry independently inside that one public task. Successful destination work is not re-run merely because the other destination has a transient failure; manual replays remain safe because People, activities, Opportunities, bookings, and Meta conversions use their natural stable identities. Configure `SLACK_FAILURE_WEBHOOK_URL` for redacted exhausted-Twenty alerts. The operator procedure and preview proof checklist are in [`docs/funnel-event-recovery.md`](../../docs/funnel-event-recovery.md).

Preview deployments must set `PULPSENSE_AUTOMATION_ENVIRONMENT=preview` and use only sandbox Twenty and Meta credentials. The task rejects an event whose environment does not match its configured destinations.

The current lawyer dataset uses `META_PIXEL_ID_AI_SEO_L`, `META_CAPI_ACCESS_TOKEN_AI_SEO_L`, and `META_TEST_EVENT_CODE_AI_SEO_L`. These scoped values take precedence over the legacy unsuffixed names, which remain supported as compatibility fallbacks. Set the scoped test event code only while validating against Meta Events Manager's Test Events view; leave it unset for ordinary dataset delivery.

Set `POSTHOG_PROJECT_KEY` and the region-appropriate `POSTHOG_HOST` to emit the redacted `funnel_contact_submitted`, `funnel_application_submitted`, and authoritative `funnel_booking_completed` lifecycle. The adapter uses the anonymous browser analytics ID when available, excludes contact and application-answer payloads, and logs a redacted delivery failure without failing the lifecycle run.

Set `TWENTY_QUALIFIED_STAGE_VALUE` to the API value for the Twenty stage labelled **Qualified – Awaiting Booking**. Set `TWENTY_CLOSED_STAGE_VALUES` to the comma-separated API values that represent won, lost, or otherwise closed Opportunities in that workspace.

Set `TWENTY_CALL_BOOKED_STAGE_VALUE` to the API value for the Twenty stage labelled **Call Booked**. A verified `booking_completed` event records an idempotent booking activity derived from the Cal UID, advances the matching open Opportunity, and sends Meta `Schedule` with the same deterministic event ID.

The Twenty Opportunity object must expose the custom API fields `brandUrl`, `paidSocialSpend`, `winnerStatus`, `platforms`, and `deliveryTimeline`. The processor projects those sales fields on both create and repeat-update operations while the immutable Person Note remains the complete application record. Funnel-event runs are serialized to protect the one-open-Opportunity invariant.

Twenty owns Company creation and Person-to-Company linking. Trigger.dev never creates a Company; it only matches an existing Company by the normalized business-email domain before linking a qualified Opportunity. The audit and operational constraint are documented in [`docs/twenty-company-ownership.md`](../../docs/twenty-company-ownership.md).

Once the dev worker registers the health check, run it from the Trigger.dev dashboard with an optional payload:

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
