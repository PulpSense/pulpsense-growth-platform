# Google Calendar Sales Appointment reconciliation

Issue #196 polls only Google events already mapped to canonical Twenty Sales
Appointments. It does not scan a calendar, use push channels, or create another
booking ledger.

## Runtime behavior

- `poll-google-calendar-sales-appointments` runs every five minutes.
- It selects non-terminal appointments from seven days ago through 180 days
  ahead and continues selecting unresolved technical states.
- Missing mappings are repaired from the current Cal booking's
  `google_calendar` reference.
- The direct Google event `id` is the lookup key. `iCalUID` is stored only as
  corroborating lineage.
- Only the event start instant is compared. Other event edits are ignored.
- A changed start is persisted as an observation, then reread after a 60-second
  durable debounce. Only a stable revision increments `automationGeneration`
  and invalidates old reminder and nurture work.
- The reconciler rereads Twenty, Google, and Cal before each of at most three
  Cal mutation attempts. A newer canonical Cal lifecycle always wins.
- Cal reschedules authenticate as the configured host and enable same-host,
  conflict, out-of-bounds, and booking-limit overrides.
- The signed Cal webhook remains canonical. After ten minutes without it, the
  worker emits the same `booking_rescheduled:<replacement UID>` event identity,
  so later webhook delivery deduplicates.
- Cancelled and completed appointments are terminal. A future reschedule of a
  `NO_SHOW` is returned to `SCHEDULED` by the canonical lifecycle projector.
- The worker never reverts a Google edit or deletes duplicate events. Past-time
  moves, two active Google events, exhausted retries, and provider anomalies are
  suppressed and posted to Slack channel `C09FTA0TEEN` once per revision.

## One-time Google authorization

Create an OAuth web client whose authorized redirect URI is
`http://127.0.0.1:53682/oauth2/callback`, then run from the repository root:

```bash
GOOGLE_CALENDAR_CLIENT_ID=... \
GOOGLE_CALENDAR_CLIENT_SECRET=... \
pnpm --filter @pulpsense/automations google-calendar:authorize
```

Open the printed URL as the single designated Google user. The utility requests
offline access only to
`https://www.googleapis.com/auth/calendar.events.readonly`, receives the
callback on localhost, prints the refresh token once, and never writes it to
disk. Store the client secret and refresh token directly in Trigger.dev.

## Configuration

Required whenever mode is not `off`:

- `TWENTY_API_ORIGIN`, `TWENTY_API_KEY`
- `CAL_API_KEY`
- `CAL_RECONCILIATION_HOST_EMAIL`
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` (must exactly match the Cal booking reference)
- `SLACK_BOT_TOKEN` with permission to post in `C09FTA0TEEN`

Rollout controls:

- `GOOGLE_CALENDAR_RECONCILIATION_MODE=off|observe|reconcile` (default `off`)
- `GOOGLE_CALENDAR_RECONCILIATION_UID_ALLOWLIST` is a comma-separated set of
  exact current Cal booking UIDs. There is intentionally no wildcard.
- `GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY=true|false` defaults to `true`.
  While true, mutation also requires the configured internal attendee below.
- `GOOGLE_CALENDAR_RECONCILIATION_CANARY_ATTENDEE_EMAIL` is the exact internal
  attendee email required during canarying. Set canary-only to `false` only
  after the mandatory live scenarios pass; the UID allowlist then stops gating
  general production appointments.
- `PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS` is the comma-separated exact set
  of signed Lead Journey UUIDs allowed to bypass full internal-test suppression.
  Those events create the canonical Twenty prerequisites and appointment as
  test data, but do not emit Meta or PostHog measurement or sales Slack alerts.
  The canary Opportunity is written with `isTest = true`; the Sales Appointment
  is `NON_PRODUCTION`, `isTest = true`, and `isCommercial = false`.

## Rollout

1. Deploy the additive hidden Twenty fields and initialize existing rows.
2. Deploy the worker with mode `off` and validate task registration.
3. Configure the single-user OAuth secrets and designated calendar.
4. Switch to `observe`; validate mappings and differences without suppression
   or provider mutation.
5. Switch to `reconcile` with only internal test Booking UIDs allowlisted.
6. Complete the mandatory canary scenarios from issue #196 and retain Trigger,
   Cal, Google, and Twenty read-back evidence.
7. Add production UIDs deliberately after canary approval. Ordinary successful
   runs remain in Trigger/Twenty; Slack is reserved for failures and recoveries.
8. After the complete canary passes, set canary-only to `false` to enable all
   otherwise eligible Sales Appointments. Retain the exact UID allowlist as the
   audit record of the canary set.

Provider-owned Google and Cal emails may both be delivered. This integration
does not send an additional reschedule-confirmation message.
