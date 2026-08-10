# Lead lifecycle automation plan

This document records the shared lifecycle decisions and ordered implementation backlog for the funnel's follow-up automations. Shared understanding was confirmed on 2026-08-10.

## Confirmed decisions

- Each accepted funnel submission is a distinct **Lead Journey**.
- Slack uses one thread per Lead Journey. A repeat submission by the same person creates a new thread, while Twenty may continue to deduplicate the underlying Person.
- The initial Slack message is delivered independently of Twenty. A Twenty failure must not prevent or delay Slack from notifying the team about an accepted contact.
- The initial Slack message contains the lead's full name, business email, phone number, company domain, funnel name, and available source, medium, and campaign attribution.
- The initial Slack message excludes IP addresses, user agents, ad-click identifiers, analytics identifiers, signed tokens, and raw request data.
- Lead Journey threads must be posted only to the dedicated private Slack channel `C0AR39DFA4S`, with limited membership.
- When the Lead Journey books, its Slack thread receives one reply containing a Booked status, meeting title, start date and time with timezone, duration, Cal booking UID, and a link to the internal Cal.com booking record. The reply does not repeat the Lead Contact Details.
- If the initial Slack message exhausts its retries and the Lead Journey later books, the booking event creates a fallback root message containing the original Lead Contact Details and booking status. That message becomes the journey's Slack thread.
- A lead enters the **Qualified but Unbooked** flow when the server accepts the qualified application and issues booking eligibility.
- A verified booking ends the **Qualified but Unbooked** state and creates a one-way Sales Handoff.
- A later cancellation remains owned by the sales process. It does not return the Communication Recipient to Qualified but Unbooked; cancellation follow-up is manual.
- Cancellation does not add a Slack reply. The owner relies on the existing cancellation email for manual follow-up.
- A reschedule updates the existing Sales Appointment. It does not create a new Lead Journey, add another Slack booking reply, or re-enter acquisition nurturing.
- Pre-call Nurture is a Brevo-owned Communication Flow that begins after a verified booking and remains active only while the Sales Appointment remains scheduled.
- The first Pre-call Nurture message is the Booking Confirmation and is sent through Brevo seconds after the verified booking. This is the one fixed timing requirement within the otherwise TBD flow.
- Rescheduling keeps Pre-call Nurture active and updates appointment-relative timing and references to use the new meeting time. Cancellation stops Pre-call Nurture.
- Meeting Reminders are separate from Pre-call Nurture. Trigger.dev schedules them directly for 24 hours, 2 hours, and 15 minutes before the active Sales Appointment; Gmail is the initially intended delivery adapter.
- Meeting Reminders are sent automatically from the authenticated personal Gmail account without draft approval.
- Rescheduling cancels the old pending Meeting Reminders and schedules replacements from the new start time. Cancellation stops all pending Meeting Reminders.
- A Meeting Reminder may be delivered only if the Sales Appointment is still active and its current start time matches the schedule used to create that reminder.
- Immediately before Gmail delivery, Trigger.dev confirms the booking is still active and its start time is unchanged through the Cal.com booking API. This final check protects against delayed cancellation or reschedule webhooks.
- If Cal.com cannot confirm the appointment, the reminder is not sent. The status check retries only within that reminder's expiry window and emits a redacted reliability alert if confirmation never succeeds.
- Meeting Reminder thresholds that are already in the past when a booking or reschedule is processed are skipped rather than sent immediately. The immediate Brevo Booking Confirmation provides acknowledgement; only future 24-hour, 2-hour, and 15-minute thresholds are scheduled.
- A failed 24-hour reminder may retry only until the 2-hour threshold; a failed 2-hour reminder may retry only until the 15-minute threshold; a failed 15-minute reminder may retry only until the Sales Appointment starts. Expired reminders are skipped rather than delivered late.
- Meeting Reminder subject lines and plain-text bodies are approved below. Delivery personalizes the first name, attendee-local meeting time and daypart, and current meeting join link.
- Replies to Meeting Reminders go directly to the authenticated personal Gmail inbox and are handled manually as sales correspondence. Trigger.dev does not ingest, classify, or respond to replies.
- Exhausted Brevo and Gmail delivery failures use the existing reliability Slack webhook rather than the PII-bearing lead channel. Alerts include environment, operation, Lead Journey ID, relevant Cal UID, and Trigger.dev run link, but exclude contact PII and message content.
- Trigger.dev owns detection and durable publication of lifecycle entry and exit.
- Brevo owns the internal definition and delivery of Communication Flows, including message count, channels, timing, cadence, and copy.
- Brevo owns unsubscribe and suppression behavior for Brevo-delivered flows. Trigger.dev does not duplicate or synchronize that provider-managed logic.
- Brevo contact upsert, Booking Link variables, and Qualified but Unbooked entry occur as one durable qualified-lifecycle operation after the application is accepted. There is no separate earlier Brevo-contact creation stage.
- Every contact upsert performed by the funnel lifecycle also adds that contact to Brevo's `Ads` list in the same API request. List membership is available for organization and segmentation, while lifecycle custom events remain the authoritative automation triggers.
- An existing Brevo contact remains eligible for both funnel flows. Qualification updates only funnel-owned attributes and enters Qualified but Unbooked; a later verified booking exits that state and enters Pre-call Nurture.
- Funnel processing must not overwrite unrelated Brevo attributes, list memberships, or provider-managed suppression state.
- Booked lifecycle state has precedence over Qualified but Unbooked. Delayed, retried, or replayed qualification delivery must never move a booked Communication Recipient out of Pre-call Nurture or back into acquisition nurture.
- Lifecycle delivery carries sufficient ordering information for Brevo to reject stale state transitions.
- Brevo receives only the following funnel-owned contact and lifecycle data: full name, verified email, normalized phone, company domain, funnel ID, Lead Journey ID, current lifecycle state, personalized Booking Link, and available source, medium, and campaign attribution.
- After booking, Brevo additionally receives the Cal UID, meeting title, start time, end time, attendee timezone, and meeting join URL.
- Brevo does not receive IP addresses, user agents, ad-click identifiers, analytics identifiers, raw event payloads, or the encrypted booking identity as a standalone variable. The encrypted identity remains opaque inside the Booking Link.
- Communication Flows identify recipients by verified normalized email. Multiple submissions using the same email share one Communication Recipient and may have at most one active Qualified but Unbooked flow.
- Different email addresses are separate Communication Recipients even when their names match. Names are never used to merge or suppress flows.
- An accepted qualified application generates a personalized Cal.com Booking Link with prefilled contact fields and signed funnel context. The link is stored as a Brevo variable for use by the Qualified but Unbooked flow.
- The first version uses the Cal.com Booking Link directly and does not add a separate resume-booking page.
- The first version reuses the existing encrypted booking identity in the Cal.com link. Preview qualification must exercise the complete Brevo email to Cal.com to signed-webhook round trip.
- If preview proves that Cal.com truncates or rejects the current identity, replace it with a compact signed identifier. Do not introduce CRM-backed lifecycle state solely to shorten the URL.
- The underlying Cal.com event type is an Ads Booking Calendar used exclusively for paid-ad funnel appointments, not for other scheduling purposes.

## Explicitly TBD

The Qualified but Unbooked and Pre-call Nurture flows will be designed through a separate process. Except for the immediate Brevo Booking Confirmation, do not infer or implement any of the following yet:

- Number of messages
- Delivery channels
- Timing or delays
- Frequency or cadence
- Message copy
- Repeat-entry behavior when the same Communication Recipient submits a new Lead Journey while already in the Qualified but Unbooked flow
- The Cal.com webhook field or derivation used to obtain the internal booking-record URL
- Whether the existing encrypted booking identity must be compacted to fit reliably in the Cal.com URL and metadata; decide from preview round-trip testing

## Out of scope

- Slack message-retention policy or custom deletion automation
- Automated acquisition-nurture re-entry after a booked call is cancelled
- Custom unsubscribe or suppression handling outside Brevo for Brevo-delivered flows
- Choosing or configuring email, SMS, or other delivery steps inside Brevo Communication Flows
- Moving Lead Journey automation state into Twenty solely to support Booking Link correlation
- Ingesting Brevo delivery, open, click, or unsubscribe events into PostHog; first-version engagement reporting remains in Brevo
- Gmail reply ingestion, classification, or automated responses
- No-show detection, no-show follow-up, and post-call communication

## Approved Meeting Reminder templates

### 24 hours before

Subject: `Talk tomorrow`

```text
Hey {{first_name}},

Was looking at tomorrow’s calendar and saw we’re scheduled to meet at {{local_time}}.

Looking forward to hearing more about your business and what you’re working on.

See you tomorrow {{daypart}}.

Santi
```

### 2 hours before

Subject: `Quick reminder`

```text
Hey {{first_name}} - gentle bump, we’re meeting in a couple of hours.

If anything changed just reply here. Otherwise see you in a bit.

Cheers,
Santi

Sent from my iPhone
```

### 15 minutes before

Subject: `See you in a few`

```text
Hey {{first_name}},

See you in a few minutes. Here’s the zoom link for convenience:

{{meeting_url}}

Santi
```

## Ordered implementation backlog

### 1. Extend the funnel lifecycle contract

- Add authenticated lifecycle events for Cal.com cancellation and rescheduling while preserving `booking_completed` for a newly verified booking.
- Carry the Cal UID lineage required to recognize one Sales Appointment across a reschedule.
- Add the appointment fields required downstream: current start and end time, attendee timezone, meeting join URL, and the data needed to construct or retrieve the internal Cal.com booking link.
- Define stable, replay-safe event identities for created, cancelled, and rescheduled appointment events.
- Preserve the existing environment isolation and verified attendee-email checks.

Acceptance criteria:

- Created, cancelled, and rescheduled payloads validate through the shared contract.
- Duplicate and out-of-order events cannot regress a booked lifecycle to Qualified but Unbooked.
- No new event exposes secrets or raw authentication tokens in logs.

### 2. Expand the Cal.com webhook boundary

- Subscribe the dedicated Ads Booking Calendar webhook to `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, and `BOOKING_CANCELLED`.
- Verify the Cal.com signature before parsing every event.
- Translate each supported payload into the shared lifecycle contract and durably enqueue it through Trigger.dev.
- Capture attendee timezone, meeting join URL, reschedule lineage, and internal booking-record link data.
- Add read-only Cal.com API credentials for final appointment-status checks used by Meeting Reminders.

Acceptance criteria:

- Invalid signatures and ineligible bookings fail closed.
- A reschedule updates the existing Sales Appointment rather than creating a new Lead Journey.
- A cancellation is accepted as a sales-owned lifecycle change but does not re-enter acquisition nurture.
- Replayed Cal.com webhooks produce one durable lifecycle outcome.

### 3. Add durable Slack Lead Journey threads

- Add a Slack adapter with destination channel `C0AR39DFA4S` supplied through environment configuration.
- On accepted contact, independently post one root message containing the approved Lead Contact Details allowlist.
- Persist the root message timestamp against the Lead Journey ID in a durable mapping that supports multiple journeys for the same Person.
- On verified booking, add the approved Booked reply to the matching thread.
- If no root mapping exists after exhausted initial-delivery retries, create the approved fallback root message on booking.
- Make contact and booking delivery replay-safe.
- Keep cancellation and reschedule updates out of Slack.

Acceptance criteria:

- Twenty failure cannot prevent or delay the initial Slack attempt.
- Replaying contact or booking events does not duplicate a root message or booking reply.
- Two submissions from the same email create two distinct Slack threads.
- Messages contain approved PII but exclude technical request data and tokens.

### 4. Build the Brevo lifecycle adapter

- Add environment-isolated Brevo credentials and configuration.
- Publish a single durable qualified-lifecycle operation that creates or updates the Brevo contact, updates only funnel-owned attributes, writes the Booking Link, and enters Qualified but Unbooked.
- Identify Communication Recipients by verified normalized email without merging by name.
- Send the approved contact and lifecycle attribute allowlist, including normalized phone and attribution.
- On verified booking, publish the transition that ends Qualified but Unbooked, writes appointment variables, and starts Pre-call Nurture.
- On reschedule, update the existing appointment variables and publish the Brevo transition required to re-anchor future Pre-call Nurture content.
- On cancellation, publish the transition that stops Pre-call Nurture without returning the recipient to Qualified but Unbooked.
- Include lifecycle ordering data so stale qualification delivery cannot override a later booking.
- Preserve unrelated Brevo attributes, list memberships, and provider-managed suppression state.

Acceptance criteria:

- Existing and new Brevo contacts follow the same lifecycle behavior.
- Booked state wins over delayed or replayed qualification delivery.
- Different verified emails remain distinct Communication Recipients.
- No Brevo engagement webhooks are added to PostHog in this version.

### 5. Generate and qualify the Brevo Booking Link

- Generate a Cal.com URL prefilled with the eligible contact's name and email.
- Carry the existing encrypted booking identity as opaque Cal.com metadata inside the URL.
- Store the complete personalized URL as the Brevo Booking Link variable.
- Add preview coverage for the full Brevo link to Cal.com booking to signed webhook round trip.
- Measure URL and metadata length and prove that Cal.com returns the identity unchanged.
- If and only if preview proves truncation or rejection, replace the existing identity with a compact signed identifier and repeat qualification.

Acceptance criteria:

- The recipient does not repeat the qualification form.
- The resulting booking resolves to the correct Lead Journey and Communication Recipient.
- The Booking Link contains no readable raw token or plaintext embedded contact payload beyond Cal.com's normal prefilled fields.
- No CRM-backed lifecycle store or resume-booking page is introduced for this requirement.

### 6. Configure the two Brevo Communication Flow seams

- Expose lifecycle events and variables needed by the separately designed Qualified but Unbooked flow.
- Expose lifecycle events and variables needed by the separately designed Pre-call Nurture flow.
- Ensure the first Pre-call Nurture action can send the Booking Confirmation seconds after a verified booking.
- Ensure rescheduling updates future appointment-relative content and cancellation exits Pre-call Nurture.
- Leave message count, channels, cadence, timing, and copy to the separate Brevo flow-design process.

Acceptance criteria:

- Platform code does not encode the internal Brevo sequence steps.
- Brevo can change flow content and cadence without an application deployment.
- Provider-managed unsubscribe and suppression behavior remains authoritative.

### 7. Implement the Trigger.dev Meeting Reminder workflow

- Start appointment-relative reminder scheduling after a verified booking.
- Schedule only future thresholds at 24 hours, 2 hours, and 15 minutes before the current start time.
- On reschedule, invalidate the old schedule and create future reminders from the replacement start time.
- On cancellation, invalidate every pending reminder.
- Immediately before delivery, query Cal.com and confirm the booking is active and still has the expected start time.
- Fail closed when Cal.com cannot confirm the appointment, retrying only inside the reminder's valid window.
- Expire the 24-hour reminder at the 2-hour threshold, the 2-hour reminder at the 15-minute threshold, and the 15-minute reminder at appointment start.
- Make reminder creation and delivery replay-safe by appointment identity and threshold.

Acceptance criteria:

- Cancelled, stale, past-due, or superseded reminders are never delivered.
- A booking made inside a threshold schedules only the remaining future reminders.
- A delayed retry cannot bunch multiple stale reminders near the meeting.

### 8. Add the personal Gmail delivery adapter

- Authenticate the selected personal Gmail account using a production-safe OAuth flow and securely store its refresh credentials.
- Send Meeting Reminders automatically without draft approval.
- Ensure replies land in the authenticated personal Gmail inbox.
- Supply only the current appointment time, attendee timezone, meeting join URL, and later-approved template content.
- Keep Gmail behind a replaceable delivery interface so the reminder provider can change later without changing reminder scheduling.
- Exclude email bodies and recipient PII from routine logs and failure alerts.

Acceptance criteria:

- Sends originate from the selected personal Gmail identity and replies return to its inbox.
- Duplicate task delivery does not send duplicate reminders.
- Gmail failure follows reminder expiry rules and produces a redacted exhausted-retry alert.

### 9. Extend independent retries and reliability alerts

- Add independently retryable Slack, Brevo, Cal-status, and Gmail adapter operations without replaying already successful destinations.
- Send exhausted Brevo and Gmail failures through the existing reliability Slack webhook.
- Include environment, operation, Lead Journey ID, relevant Cal UID, and Trigger.dev run link.
- Exclude names, email addresses, phone numbers, message bodies, and raw vendor responses from routine alerts.

Acceptance criteria:

- A failure at one destination does not duplicate successful work at another.
- Manual replay is safe for every new lifecycle event and destination.
- Reliability alerts contain enough redacted context to locate the original Trigger.dev run.

### 10. Add automated lifecycle coverage

- Test Slack root creation, booking reply, fallback root, duplicate replay, same-person multiple journeys, and Twenty independence.
- Test new and existing Brevo contacts, owned-attribute updates, stale-event rejection, booking transition, reschedule, and cancellation.
- Test Booking Link generation, encoding, round-trip metadata integrity, attendee mismatch, and length failure behavior.
- Test reminder scheduling for normal, near-term, rescheduled, cancelled, past-due, Cal-unavailable, and duplicate-event scenarios.
- Test Gmail idempotency, reply routing configuration, retry expiry, and redacted alerts with a fake adapter.
- Extend measurement-contract tests to confirm raw PII is absent from PostHog and operational logs.

Acceptance criteria:

- Workspace tests, type checks, lint, and production build pass.
- Tests prove the one-way Sales Handoff and prevent acquisition-nurture re-entry after cancellation.
- Tests prove out-of-order events cannot regress lifecycle state.

### 11. Complete sandbox and preview qualification

- Configure non-production Slack, Brevo, Cal.com, Gmail, Twenty, Meta, and PostHog destinations without using production lead data.
- Exercise contact, qualification, Qualified but Unbooked entry, Booking Link click, booking, Slack reply, immediate Brevo Booking Confirmation, and all three future reminder thresholds using controlled appointment times.
- Exercise reschedule and cancellation before every reminder threshold.
- Force one failure per new destination and verify isolated retries, expiry behavior, redacted alerting, and replay recovery.
- Record only redacted run IDs, stable synthetic identifiers, counts, and screenshots suitable for repository evidence.

Acceptance criteria:

- The complete lifecycle passes against sandbox destinations.
- The Booking Link round trip is proven before choosing whether token compaction is required.
- No reminder is sent for a cancelled or stale appointment.
- Duplicate and recovery exercises produce no duplicate Slack messages, Brevo transitions, or Gmail sends.

### 12. Promote and monitor production

- Add production secrets and configuration through the existing protected deployment process.
- Confirm the production Ads Booking Calendar webhook subscriptions and Cal.com read access.
- Confirm the Brevo flows are active only after their separate content-design approval.
- Confirm the selected personal Gmail account and sender identity before enabling reminder delivery.
- Deploy the exact qualified revision and run the non-mutating release checks.
- Monitor initial production lifecycle runs and redacted reliability alerts without copying lead payloads into tickets or logs.

Acceptance criteria:

- Production processes one controlled contact-to-booking journey successfully.
- Slack, Twenty, Meta, PostHog, Brevo, and Gmail each show exactly one expected lifecycle outcome.
- Rollback references remain available through Cloudflare Pages and Trigger.dev deployment history.

## External content and configuration dependencies

These inputs are required before their associated production sends can be enabled, but they do not block adapter and lifecycle implementation:

- Approved Qualified but Unbooked Brevo flow definition
- Approved Pre-call Nurture Brevo flow definition and Booking Confirmation
- Brevo API key, attribute names, and flow/event identifiers for each environment
- Slack app credentials with access to private channel `C0AR39DFA4S`
- Selected personal Gmail account and OAuth authorization
- Cal.com API read credentials and confirmed internal booking-link derivation
