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

The starter task is `health-check`. The public funnel task is `process-funnel-event`; it validates the shared versioned contact/application/booking contract, including signed Cal create, reschedule, and cancellation events. It independently delivers Twenty, Meta, PostHog, Slack Lead Journey threads, and Brevo lifecycle events. Verified bookings and reschedules schedule durable `send-meeting-reminder` runs for the future 24-hour, 2-hour, and 15-minute thresholds.

Twenty and Meta operations retry independently inside that one public task. Successful destination work is not re-run merely because the other destination has a transient failure; manual replays remain safe because People, activities, Opportunities, bookings, and Meta conversions use their natural stable identities. Configure `SLACK_FAILURE_WEBHOOK_URL` for redacted exhausted-Twenty alerts. The operator procedure and preview proof checklist are in [`docs/funnel-event-recovery.md`](../../docs/funnel-event-recovery.md).

Set `SLACK_BOT_TOKEN` and `SLACK_LEADS_CHANNEL_ID` together to enable the PII-bearing lead channel. The bot stores only stable Lead Journey identifiers in Slack message metadata, scans that metadata before posting, and replies to the matching root only for the first verified booking. Reschedules and cancellations do not add Slack replies.

Brevo currently receives lifecycle contact upserts and `pulpsense_*` lifecycle events. The next pre-call implementation moves the basic upsert to `contact_submitted`, adds paid-ad contacts additively to Paid Ads (#7), adds marketing-eligible contacts to Newsletter (#9), and keeps unrelated memberships and suppression state intact. Trigger.dev will own the dynamic pre-call sequence and call Brevo's Transactional Email API at each due time; Brevo Automations remain responsible for newsletter, welcome, and lead-magnet programs. A booked or cancelled contact cannot be regressed by a delayed qualification event.

Gmail reminders remain fail-closed until `GMAIL_REMINDERS_ENABLED=true` and all six subject/body template variables are present. Templates may use `{{first_name}}`, `{{local_time}}`, `{{daypart}}`, `{{meeting_title}}`, `{{start_time}}`, `{{attendee_timezone}}`, and `{{meeting_url}}`. Immediately before each send the task reads the current Cal booking through `CAL_API_KEY`; cancelled, rescheduled, expired, or unverifiable reminders are skipped.

Preview deployments must set `PULPSENSE_AUTOMATION_ENVIRONMENT=preview` and use only sandbox Twenty and Meta credentials. The task rejects an event whose environment does not match its configured destinations.

Meta destinations are selected explicitly by funnel identity. `ai-seo` uses the lawyers-specific `META_PIXEL_ID_AI_SEO_L`, `META_CAPI_ACCESS_TOKEN_AI_SEO_L`, and optional `META_TEST_EVENT_CODE_AI_SEO_L` variables. `ai-seo-dentists` uses the corresponding `_AI_SEO_D` variables and never falls back to the lawyers dataset. Set test event codes only while validating against Meta Events Manager's Test Events view.

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
