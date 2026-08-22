# Slack notification standard

PulpSense Slack messages must help an operator understand and act without
opening Trigger.dev first. New Trigger.dev notifications use the shared helpers
in `apps/automations/src/trigger/slack-notifications.ts`; each notification
family owns its business-specific copy and fields.

## Message anatomy

Every failure or degraded-state operational message answers these questions in
order:

1. Who or what is affected?
2. What failed or changed?
3. What is the business or customer-facing impact?
4. Will it retry, or must someone act?
5. Where can the operator investigate?

Formatting rules:

1. Start with one severity emoji and a subject-centered bold title. Append the
   environment only for non-production or mixed-environment destinations.
2. Leave one blank line, then put one `*Label:* value` field per line. Include
   only fields that help with this event.
3. Use Slack-localized dates for appointments; never show raw ISO timestamps.
4. Leave one blank line before actions. Use labeled Slack links such as
   `Open in Trigger`, `Open Sales Appointment`, or `Open booking`; never expose
   a raw URL.
5. Put opaque journey, booking, run, and record IDs in a compact inline-code
   footer after the useful context.
6. Disable link and media unfurls on every sent message.

Example:

```text
:rotating_light: *Couldn't create Maya Chen's Sales Appointment*

*Failed step:* Project the booking into the Sales Appointment ledger
*Impact:* The booking exists, but its Sales Appointment ledger record may be missing or stale.
*Retry:* Exhausted — manual investigation required
*Funnel:* AI SEO

<https://cloud.trigger.dev/...|Open in Trigger>

`Journey 14da9f65... · Booking kviw2RGi...`
```

Use Slack mrkdwn (`*bold*` and `<url|label>`), not CommonMark (`**bold**` or
`[label](url)`). Never add leading whitespace or HTML-space entities.

## Tones

- `failure`: `:rotating_light:` for exhausted retries or action-required
  failures.
- `warning`: `:warning:` for degraded states that do not yet represent a
  terminal failure.
- `success`: `:white_check_mark:` for recoveries and completed lifecycle
  milestones.
- `info`: `:information_source:` for new leads and neutral operational news.

The existing Meta Ads daily brief is intentionally outside this redesign and
must not be restyled as an operational alert.

## Privacy and routing

- The private reliability channel may include the affected lead's name and
  company because that context is necessary to act. It must not include email
  addresses, phone numbers, message content, tokens, raw payloads, or request
  metadata.
- Lead notifications may contain the approved contact allowlist only in the
  dedicated private leads channel.
- Put investigation context behind labeled links to Trigger.dev, Twenty, or
  Cal instead of copying sensitive records into Slack.
- Retry and deduplication behavior is part of delivery semantics and must not
  change just to restyle a message.

## Notification families

- Lead roots and booking fallback roots include the person's name, company,
  source, and a localized appointment time where relevant. Booking replies in
  an existing Lead Journey thread may retain the person's name in the title but
  do not repeat their email, phone, company, or source.
- Twenty failures name the affected person, failed CRM step, stale or missing
  state, retry exhaustion, and investigation links.
- Brevo failures describe the lifecycle event that was not published and the
  messaging consequence rather than reporting a generic integration error.
- Pre-call failures include the person, call time, failed email step, progress,
  customer impact, and retry state.
- Reminder failures include the person, reminder threshold and channel, call
  time, delivery impact, and retry state.
- Calendar reconciliation alerts translate classifications into a plain-English
  problem, impact, retry state, and action. Old and intended times appear only
  when they actually differ. Recovery replies remain in the original thread.

## Twenty workspace audit

Audited on 2026-08-22. The PulpSense Twenty workspace had three workflows:
`Quick Lead`, `Untitled`, and `Create company when adding a new person`. None
contained a Slack action. If a Twenty-native Slack action is added later, its
copy must follow this document and should preferably call a repository-owned
webhook so formatting remains centralized and testable.
