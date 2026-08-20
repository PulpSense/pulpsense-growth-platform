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

The starter task is `health-check`. The public funnel task is `process-funnel-event`; it validates the shared versioned contact/application/booking contract, including signed Cal create, reschedule, and cancellation events. It independently delivers Twenty, Meta, PostHog, Slack Lead Journey threads, and Brevo lifecycle events. Verified bookings and reschedules schedule durable `send-meeting-reminder` runs: Gmail at 24 hours, 2 hours, and 15 minutes before the call; Telnyx SMS at 90 minutes and 5 minutes. Staggering the channels preserves the emails' personal tone while SMS acts as a transactional last-mile reminder.

Twenty and Meta operations retry independently inside that one public task. Successful destination work is not re-run merely because the other destination has a transient failure; manual replays remain safe because People, activities, Opportunities, bookings, and Meta conversions use their natural stable identities. Configure `SLACK_FAILURE_WEBHOOK_URL` for redacted exhausted-Twenty alerts. The operator procedure and preview proof checklist are in [`docs/funnel-event-recovery.md`](../../docs/funnel-event-recovery.md).

Set `SLACK_BOT_TOKEN` and `SLACK_LEADS_CHANNEL_ID` together to enable the PII-bearing lead channel. The bot stores only stable Lead Journey identifiers in Slack message metadata, scans that metadata before posting, and replies to the matching root only for the first verified booking. Reschedules and cancellations do not add Slack replies.

## Meta Ads daily brief

`meta-ads-daily-brief` runs at 9:00 AM `America/Buenos_Aires` and posts one exception-first message to `SLACK_ADS_REPORT_CHANNEL_ID`. Configure `META_ADS_REPORTING_ACCESS_TOKEN` with a read-only Meta reporting token, `META_ADS_AD_ACCOUNT_ID` with the `act_…` ad account ID, and keep `META_GRAPH_API_VERSION=v26.0` (or update it deliberately when Meta requires a version migration). The task reuses `TWENTY_API_ORIGIN`, `TWENTY_API_KEY`, and `SLACK_BOT_TOKEN`.

The report reads Meta Ads Insights for yesterday, trailing seven days, and month to date. It performs no campaign writes and has no PostHog dependency. Twenty Notes whose titles begin with `Booking ` provide a total-level verified-booking audit; those counts are never assigned to campaigns. Campaign rows remain Meta-attributed, and the Slack copy calls out CAPI/Meta attribution lag, the 48-hour grace period, and low-spend uncertainty. Retries find the brief by report-date metadata and update it rather than posting duplicates. Operating assumptions are a $3,000 monthly budget, $100 target verified CPB, and $300 minimum decision spend.

Brevo currently receives lifecycle contact upserts and `pulpsense_*` lifecycle events. The next pre-call implementation moves the basic upsert to `contact_submitted`, adds paid-ad contacts additively to Paid Ads (#7), adds marketing-eligible contacts to Newsletter (#9), and keeps unrelated memberships and suppression state intact. Trigger.dev will own the dynamic pre-call sequence and call Brevo's Transactional Email API at each due time; Brevo Automations remain responsible for newsletter, welcome, and lead-magnet programs. A booked or cancelled contact cannot be regressed by a delayed qualification event.

Gmail reminders remain fail-closed until `GMAIL_REMINDERS_ENABLED=true` and all six subject/body template variables are present. Templates may use `{{first_name}}`, `{{local_time}}`, `{{daypart}}`, `{{meeting_title}}`, `{{start_time}}`, `{{attendee_timezone}}`, and `{{meeting_url}}`. Immediately before each send the task reads the current Cal booking through `CAL_API_KEY`; cancelled, rescheduled, expired, or unverifiable reminders are skipped.

Telnyx-backed SMS reminders remain fail-closed until `TELNYX_SMS_REMINDERS_ENABLED=true`, the shared `TWENTY_API_ORIGIN` and `TWENTY_API_KEY` can reach the authenticated Twenty communications action, and the 90-minute and 5-minute `TELNYX_SMS_REMINDER_*_BODY` templates are configured. SMS templates support the same placeholders as Gmail bodies. Trigger never sends a destination number to Telnyx: it supplies the booking's canonical Twenty Person ID, and Twenty reloads the current phone, enforces explicit CRM consent and quota controls, records the outbound intent and Interaction, then submits through the configured Telnyx source. Legacy queued SMS reminders without a Person ID fail closed rather than bypassing that path. Telnyx SMS shares the same live Cal verification and stale-reminder safeguards as Gmail.

Preview deployments must set `PULPSENSE_AUTOMATION_ENVIRONMENT=preview` and use only sandbox Twenty and Meta credentials. The task rejects an event whose environment does not match its configured destinations.

Meta destinations are selected explicitly by funnel identity. The AI SEO campaigns use their matching `META_PIXEL_ID_AI_SEO_*`, `META_CAPI_ACCESS_TOKEN_AI_SEO_*`, and optional `META_TEST_EVENT_CODE_AI_SEO_*` variables, and never fall back to another niche's dataset. Set test event codes only while validating against Meta Events Manager's Test Events view.

Test event codes may remain saved in the Development environment without affecting delivery. Set `META_TEST_EVENTS_ENABLED=true` only during a Meta Test Events session, then set it back to `false`; the codes do not need to be deleted. Production should keep this unset or set to `false`.

Set `POSTHOG_PROJECT_KEY` and the region-appropriate `POSTHOG_HOST` to emit Prospect-linked contact, application, and authoritative booking lifecycle events. The adapter uses the canonical Prospect ID, attaches browser-originated events to their PostHog session, updates searchable Lead Contact Details and Journey Attribution properties, and logs a redacted delivery failure without failing the lifecycle run.

Twenty terminal sales updates arrive through `/api/webhooks/twenty` and run in the serialized `process-twenty-sales-outcome` task. Configure the Pages Function with `TWENTY_WEBHOOK_SECRET` and `TWENTY_PRODUCTION_WORKSPACE_ID`; configure Trigger.dev with the immutable SELECT option UUIDs in `TWENTY_WON_STAGE_ID` and `TWENTY_LOST_STAGE_ID`, not option API values or display labels. The task resolves the API value delivered by the webhook through Twenty's metadata API before classification. The Opportunity schema must also expose `pulpsenseSalesOutcome` for retry-safe correction classification. See [ADR 0005](../../docs/adr/0005-model-terminal-sales-outcomes-as-immutable-events.md).

The historical reference migration requires an ignored JSON array containing exactly four `{ personId, prospectId, opportunityId, originatingLeadJourneyId }` mappings. Run `pnpm --filter @pulpsense/automations backfill:twenty-sales <path>` for the non-mutating approval report, add `--apply` only after approval, then run `--read-back` for verification.

Set `TWENTY_QUALIFIED_STAGE_VALUE` to the API value for the Twenty stage labelled **Qualified – Awaiting Booking**. Set `TWENTY_CLOSED_STAGE_VALUES` to the comma-separated API values that represent won, lost, or otherwise closed Opportunities in that workspace.

Set `TWENTY_CALL_BOOKED_STAGE_VALUE` to the API value for the Twenty stage labelled **Call Booked**. A verified `booking_completed` event records an idempotent booking activity derived from the Cal UID, advances the matching open Opportunity, and sends Meta `Schedule` with the same deterministic event ID.

The Twenty Person object must expose `prospectId`. The Twenty Opportunity object must expose `originatingLeadJourneyId`. The processor sets the originating Lead Journey only when it creates an Opportunity and keeps the immutable Person Note as the complete application record. Funnel-event runs are serialized to protect the one-open-Opportunity invariant.

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
- `pnpm --filter @pulpsense/automations backfill:twenty-sales <path>` — report the four historical CRM mappings without mutation

## Adding an automation

Create a named task export in `src/trigger/` with a unique, stable `id`. Keep secrets in Trigger.dev environment variables or local `.env` files; never commit them.
