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
- A changed start is persisted as an observation, then reread after a five-minute
  durable debounce. Only a stable revision increments `automationGeneration`
  and invalidates old reminder and nurture work.
- The reconciler rereads Twenty, Google, and Cal before each of at most three
  Cal mutation attempts. A newer canonical Cal lifecycle always wins.
- Cal reschedules authenticate as the configured host and enable same-host,
  conflict, out-of-bounds, and booking-limit overrides.
- The signed Cal webhook remains canonical. After ten minutes without it, the
  worker emits the same `booking_rescheduled:<replacement UID>` event identity,
  so later webhook delivery deduplicates.
- Every canonical signed reschedule queues an idempotent description repair for
  the directly referenced Google event. It changes only a uniquely recognized
  Cal.com reschedule target—either a `rescheduleUid` query parameter or a
  `/booking/{UID}` path—from the previous booking UID to the replacement UID,
  uses the event etag as a write precondition, requests no guest updates, and
  verifies the updated description by reading it back.
- Missing, ambiguous, rejected, or unverifiable description repairs never
  change the canonical meeting time. They retry three times and then alert the
  error Slack channel with a manual repair path. Slack delivery itself retries
  three times and leaves the Trigger run failed if the alert remains
  undeliverable.
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
offline `https://www.googleapis.com/auth/calendar.events.owned` access. This is
the narrowest Google scope that can both poll events and repair the expired Cal
reschedule link on calendars the user owns. The utility receives the callback
on localhost, prints the refresh token once, and never writes it to disk. Store
the client secret and refresh token directly in Trigger.dev.

Changing from the former read-only grant requires running the utility again and
replacing `GOOGLE_CALENDAR_REFRESH_TOKEN`; an existing refresh token does not
gain the new permission automatically.

The production authorization is intentionally single-user. Before saving a new
refresh token, verify that the consent screen names the designated user, the
granted scope is exactly `calendar.events.owned`, and `GOOGLE_CALENDAR_ID`
matches the `calendarId` on a known Cal.com `google_calendar` booking reference.
Rotate the token by rerunning the utility as that same user, replacing only
`GOOGLE_CALENDAR_REFRESH_TOKEN`, and confirming a read-only poll succeeds. Do
not widen the scope or retain the superseded token outside the secret store.

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
- `GOOGLE_CALENDAR_RECONCILIATION_SIMULATED_CAL_FAILURE_UID` is an optional,
  exact booking UID used only while canary-only mode is active. It makes the Cal
  reschedule adapter return a transient 503 for that booking so the mandatory
  failure canary can exercise real Twenty and Slack handling without rotating
  the shared Cal credential. Clear it immediately after the canary.
- `PULPSENSE_INTERNAL_CANARY_SUBMISSION_IDS` is the comma-separated exact set
  of signed Lead Journey UUIDs allowed to bypass full internal-test suppression.
  Those events create the canonical Twenty prerequisites and appointment as
  test data, but do not emit Meta or PostHog measurement or sales Slack alerts.
  The canary Opportunity is written with `isTest = true`; the Sales Appointment
  is `NON_PRODUCTION`, `isTest = true`, and `isCommercial = false`.

## Historical mapping audit

The backfill utility validates an operator-reviewed mapping; it does not
discover candidates. Build its input from canonical Twenty booking Notes and
their related Person, Opportunity, Sales Appointment, and BookingVersion
records, corroborated with the exact Cal booking and its `google_calendar`
reference. Never derive a Cal UID from a Google `iCalUID`, title, attendee, or
approximate time.

Keep the mapping input ignored, for example
`apps/automations/.env.sales-appointment-mapping.json`. Retain the redacted
reports under `docs/evidence/`:

```bash
pnpm --filter @pulpsense/automations backfill:sales-appointments \
  .env.sales-appointment-mapping.json \
  > ../../docs/evidence/calendar-mapping-dry-run.json
pnpm --filter @pulpsense/automations backfill:sales-appointments \
  .env.sales-appointment-mapping.json --apply \
  > ../../docs/evidence/calendar-mapping-apply.json
pnpm --filter @pulpsense/automations backfill:sales-appointments \
  .env.sales-appointment-mapping.json --read-back \
  > ../../docs/evidence/calendar-mapping-read-back.json
```

`ready` means the local evidence is structurally complete; it is not permission
to skip provider review. Any `ambiguous` row blocks apply and rollout. Apply
also refuses a deterministic-ID, UID, relationship, classification, status, or
time conflict with live Twenty. Read-back must report `matches: true` for every
row. Record counts for eligible, already mapped, newly mapped,
intentionally ineligible, and unresolved appointments. General reconciliation
must remain disabled while any eligible candidate or live difference lacks an
evidence-backed explanation.

## Operating modes

| Mode              | Required controls                         | Behavior                                                                                                                                               |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Off               | `GOOGLE_CALENDAR_RECONCILIATION_MODE=off` | Polling and mutation are disabled; this is the immediate rollback.                                                                                     |
| Observe           | mode `observe`                            | Reads and classifies exact mapped events without suppressing automation or mutating Cal.                                                               |
| Exact-UID canary  | mode `reconcile`, canary-only `true`      | Mutation requires an exact current Cal UID in the allowlist and the configured internal attendee email. Wildcards and external attendees are rejected. |
| General reconcile | mode `reconcile`, canary-only `false`     | All otherwise eligible mapped Sales Appointments are evaluated. The retained exact-UID allowlist is audit history and no longer gates eligibility.     |

The completed canary must not be repeated simply to enter general mode. Remove
the simulated-failure UID, retain the canary allowlist, and change only the
canary-only gate after the mapping and documentation reviews pass.

## Slack outcomes and intervention

Routine no-op and successful reconciliations stay in Trigger logs and Twenty;
they do not post to Slack. Channel `C09FTA0TEEN` is reserved for past-time
rejections, ambiguous or duplicate provider events, exhausted Cal or Google
repairs, missing mappings that cannot be recovered, and recovery of a
previously alerted revision.

A needs-attention root message identifies the Sales Appointment, Person,
canonical time, intended Google time, classification, retry state, run, and
operator action. Retries and recovery remain on that revision's thread. An
operator must intervene when retries are exhausted, two active provider events
exist, the Google edit is in the past, the mapping is not exact, or read-back
does not converge. Recovery is complete only after the same lineage is
verified across Google, Cal.com, Twenty, Trigger, and Brevo and the Slack thread
records recovery when an alert was emitted.

## Manual repair

1. Set `GOOGLE_CALENDAR_RECONCILIATION_MODE=off` if any invariant is failing.
2. Preserve the Trigger run, Twenty revision, exact Cal UID lineage, Google
   event ID, and Slack thread before changing state.
3. Determine the canonical business outcome and time from operator, Cal, and
   Twenty evidence. Do not guess a mapping.
4. Repair through the canonical lifecycle or outcome path. Never delete a
   provider event automatically, revive a cancelled booking, reset lineage or
   `automationGeneration`, or rewrite BookingVersions by hand. A cancelled Cal
   booking is terminal; create a new booking when another meeting is needed.
5. Read back the active Google event and reschedule link, current Cal booking,
   Twenty Sales Appointment and BookingVersion chain, Trigger generation and
   pending work, and Brevo appointment state. Confirm stale reminder and
   pre-call work is suppressed and no nurture module replayed.
6. Restore `reconcile` only after the evidence is internally consistent and
   the abnormal Slack thread has a recovery result.

An eligible `NO_SHOW` within the seven-day lookback may be moved to a future
time and return to `SCHEDULED`. `CANCELLED` remains terminal.

## Rollout

1. Deploy the additive hidden Twenty fields and initialize existing rows.
2. Deploy the worker with mode `off` and validate task registration.
3. Configure the single-user OAuth secrets and designated calendar.
4. Switch to `observe`; validate mappings and differences without suppression
   or provider mutation.
5. Switch to `reconcile` with only internal test Booking UIDs allowlisted.
6. Complete the mandatory canary scenarios from issue #196 and retain Trigger,
   Cal, Google, and Twenty read-back evidence.
7. Freeze the UID allowlist as the exact completed-canary set. Do not add
   production UIDs: general mode ignores the allowlist, and changing it would
   destroy the canary audit record. Ordinary successful runs remain in
   Trigger/Twenty; Slack is reserved for failures and recoveries.
8. After the complete canary passes, set canary-only to `false` to enable all
   otherwise eligible Sales Appointments. Retain the exact UID allowlist as the
   audit record of the canary set.
9. Observe at least two consecutive five-minute poll cycles. Inspect every
   dispatched child run, Twenty and provider read-back, and Slack. For each
   eligible appointment, directly open the exact Cal booking UID and verify its
   status and canonical time. Search the designated Google Calendar by that
   exact UID/reschedule link and inspect every result. Verify that exactly one
   event is the canonical mapped appointment. A user may intentionally duplicate
   the original Google invite for a follow-up or onboarding meeting with the
   same booker; because Google copies the description, those distinct meetings
   can retain the original Cal link and appear in the UID search. Treat every
   additional result as unexplained until the operator confirms its distinct
   purpose, time, and attendee. For future copies, remove the original Cal
   reschedule/cancel link because it still controls the canonical booking. An
   `unchanged` child verifies the mapped Google event and Twenty state, but
   returns before the Cal read and is not a duplicate-event search. Immediately
   set mode to `off` if any duplicate event, unexplained Cal mutation, stale
   automation, missing mapping, or unexpected alert appears.

Provider-owned Google and Cal emails may both be delivered. The description
patch sets `sendUpdates=none`, but Google notes that some messages may still be
sent even when updates are disabled. This integration does not send an
additional reschedule-confirmation message.
