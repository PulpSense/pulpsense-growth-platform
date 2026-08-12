# Trigger-Owned Pre-call Email Sequence Implementation Plan

> **For Codex or Hermes:** Implement this plan task-by-task using test-driven development. Do not reinterpret ownership: Trigger.dev owns the pre-call sequence; Brevo is the immediate-send transport.

**Goal:** Build a production-safe, industry-agnostic 4–18-email pre-call sequence that starts immediately after a verified booking, adapts to the call horizon, survives retries and reschedules, and stops on cancellation or suppression.

**Architecture:** `process-funnel-event` starts a versioned Trigger.dev sequence for verified bookings and replacement sequences for reschedules. The sequence uses durable Trigger waits, revalidates Cal and Brevo state before every slot, renders canonical repository-owned copy, and asks Brevo's Transactional Email API to send immediately. Existing Gmail reminders remain a separate 24-hour, 2-hour, and 15-minute lane.

**Tech stack:** TypeScript, Trigger.dev, Zod, Brevo Contacts and Transactional Email APIs, Cal.com API/webhooks, Vitest, Astro/Cloudflare Pages Functions.

---

## 1. Non-negotiable decisions

1. Trigger.dev owns message count, module selection, scheduling, waits, cancellation, rescheduling, idempotency, and send-time validation.
2. Brevo's Transactional Email API is transport only. Do not use `scheduledAt` and do not recreate the pre-call workflow in Brevo Automations.
3. Canonical subjects, preview text, text bodies, and HTML rendering stay in this repository.
4. Gmail reminders at 24 hours, 2 hours, and 15 minutes are separate logistical messages. Pre-call nurture must not duplicate or collide with them.
5. Basic Brevo contact synchronization moves from `application_submitted` to `contact_submitted`.
6. Every accepted paid-ad contact is added additively to Paid Ads list ID `7`; every marketing-eligible accepted contact is also added to Newsletter list ID `9`.
7. Never replace unrelated list memberships or silently reverse an unsubscribe, complaint, hard bounce, or block.
8. Lead Magnets list ID `10` remains the umbrella lead-magnet list. A future magnet request emits `pulpsense_lead_magnet_requested` with a stable `lead_magnet_id`; it does not create one boolean attribute per magnet.
9. A verified booking starts pre-call nurture. Capturing an email alone does not.
10. A pre-call opt-out stops optional pre-call nurture without cancelling the appointment or its essential Gmail reminders.

---

## 2. Sequence contract

### Entry

`booking_completed` after the existing signed Cal webhook has verified:

- webhook signature,
- signed PulpSense booking identity,
- matching attendee email,
- eligible environment,
- active appointment start/end,
- meeting join URL.

### Exit

Stop all unsent optional nurture when any of these is true:

- booking is cancelled;
- Cal cannot verify the booking inside the slot's validity window;
- current appointment start does not equal the sequence's `expectedStartTime`;
- a replacement reschedule generation supersedes the run;
- Brevo reports marketing suppression, block, complaint, or hard-bounce state;
- `PULPSENSE_PRECALL_OPTED_OUT_AT` is set;
- appointment has started;
- all selected modules have been processed.

### Identity

```text
sequenceVersion = "precall-v1"
sequenceId      = precall:{bookingUid}:{expectedStartTime}:{sequenceVersion}
sequenceRunKey  = precall-run:{sequenceId}
slotKey         = precall-slot:{sequenceId}:{moduleId}
journeyModuleKey= precall-module:{submissionId}:{moduleId}:{sequenceVersion}
```

Use Trigger idempotency keys with `idempotencyKeyTTL: "1y"`. Also send a stable Brevo transport idempotency header for retries. Brevo's retry protection is secondary; Trigger and recorded module state are authoritative.

### Brevo contact state

Extend the contact projection with:

```text
PULPSENSE_PRECALL_STATUS
PULPSENSE_PRECALL_SEQUENCE_ID
PULPSENSE_PRECALL_SENT_MASK
PULPSENSE_PRECALL_COPY_VERSION
PULPSENSE_PRECALL_OPTED_OUT_AT
```

`PULPSENSE_PRECALL_SENT_MASK` is an integer bitset for the 16 stable middle-module positions (`0` through `65535`). It exists so a replacement sequence can choose unsent modules after a reschedule without relying on a provider-sized text field. `PULPSENSE_PRECALL_COPY_VERSION` records the bit mapping; never reorder existing bit positions inside a published copy version. Confirmation and final-preparation messages are appointment-specific and use the appointment-start sequence identity.

Create these Brevo attributes before enabling the canary:

| Attribute | Brevo type |
|---|---|
| `PULPSENSE_PRECALL_STATUS` | text |
| `PULPSENSE_PRECALL_SEQUENCE_ID` | text |
| `PULPSENSE_PRECALL_SENT_MASK` | number |
| `PULPSENSE_PRECALL_COPY_VERSION` | text |
| `PULPSENSE_PRECALL_OPTED_OUT_AT` | date |

---

## 3. Count and module selection

```ts
const totalEmails = clamp(Math.ceil(hoursUntilCall / 4), 4, 18);
```

Examples:

| Time until call | Total emails |
|---:|---:|
| 4–12 hours | 4 |
| 18 hours | 5 |
| 24 hours | 6 |
| 36 hours | 9 |
| 48 hours | 12 |
| 60 hours | 15 |
| 72+ hours | 18 maximum |
| 96-hour weekend | 18 maximum |

Selection rules:

1. Always reserve Email 1, `confirmation`, for a new booking.
2. Always reserve Email 18, `final-preparation`, for the active appointment start.
3. Select `totalEmails - 2` middle modules in ascending `priority` order.
   - In `precall-v1`, each middle module's immutable `bitIndex` is `priority - 1` (`0` through `15`).
4. On reschedule, exclude middle modules whose bits are set in `PULPSENSE_PRECALL_SENT_MASK` for the active copy version.
5. Do not invent replacement copy when fewer unsent modules remain. Send fewer messages.
6. The unique middle-module ceiling is 16 per Lead Journey.
7. Do not repeat the initial confirmation after a reschedule. Cal and Gmail own logistical reschedule acknowledgement. The replacement final-preparation message may render with the new time and link.

The four-email minimum therefore resolves to:

```text
confirmation
what-we-will-inspect
proof-twin-oaks
final-preparation
```

---

## 4. Send-time calculation

### Normal horizons: 8 hours or more

- Email 1: immediately.
- Final preparation: 2 hours 45 minutes before the appointment.
- Distribute selected middle modules evenly between those points.
- This produces approximately four-hour spacing for the important 24–72-hour windows while keeping the final nurture message 45 minutes away from Gmail's 2-hour reminder.

```ts
const finalAt = meetingStart - (2 * HOUR + 45 * MINUTE);
const spacing = (finalAt - now) / (totalEmails - 1);
const baseSlots = range(totalEmails).map((index) => now + index * spacing);
```

### Short-notice horizons: under 8 hours

Cal normally enforces a four-hour minimum, but processing delay must still be safe.

- Email 1: immediately.
- Final preparation: 1 hour before the appointment.
- For the four-email sequence, place the two middle modules at 20% and 40% of the interval between now and the final-preparation time.

At exactly four hours this yields approximately:

```text
T+00:00 confirmation
T+00:36 what we will inspect
T+01:12 proof
T+03:00 final preparation
```

Gmail's 2-hour reminder lands at `T+02:00`, separated from nurture.

### Reminder collision rule

Protected Gmail thresholds are:

```text
meetingStart - 24 hours
meetingStart - 2 hours
meetingStart - 15 minutes
```

For every non-immediate nurture slot:

1. Require at least 45 minutes from a future Gmail reminder.
2. Require at least 30 minutes between nurture slots for horizons under 8 hours and 60 minutes for normal horizons.
3. If a base slot violates the reminder buffer, move it earlier to `reminderAt - 45 minutes` when that preserves order and minimum spacing.
4. Otherwise move it later to `reminderAt + 45 minutes` when still before final preparation.
5. If neither side has a valid position, drop that slot rather than violate the reminder buffer or bunch messages.
6. Never move final preparation later than one hour before the call.
7. Never bunch overdue slots. If a slot is in the past when the task resumes, skip it.

Unit-test the deterministic resolver. Do not rely on intuition or local-time arithmetic; schedule in UTC and render in the attendee timezone.

---

## 5. Send guard

Immediately before every send, require all of the following:

```text
feature flag enabled
AND current time is before appointment start
AND Cal booking is active
AND Cal booking UID is the expected active UID
AND Cal start time equals expectedStartTime
AND Brevo contact exists
AND Brevo contact has `emailBlacklisted !== true`
AND PULPSENSE_PRECALL_OPTED_OUT_AT is empty
AND module receipt is absent
AND this sequence generation is still current
```

If Cal or Brevo cannot be checked, fail closed for that attempt. Retry only while the slot remains useful; never deliver an old nurture message close to or after the call.

Appointment confirmation and essential Gmail reminders have separate eligibility rules. A pre-call opt-out does not cancel them.

---

## 6. Canonical rendering contract

Required variables:

```text
first_name
meeting_local_date
meeting_local_time
meeting_local_weekday
attendee_timezone
acquisition_source_label
precall_opt_out_url
business_postal_address
sender_name
```

Rendering requirements:

- Generate both `textContent` and escaped, mobile-safe `htmlContent`.
- Use one main CTA per message. The opt-out footer is operational and does not count as a marketing CTA.
- Every message identifies the sender, but appointment continuity must sound natural rather than templated. Email 1 gives the full date, time, timezone, and acquisition source. Middle emails vary between `before we talk`, `on our call`, a weekday reference, an occasional exact-time reminder, or no reminder when it adds nothing. Email 18 may give the full date, time, and timezone as final preparation. For the current paid funnels, `acquisition_source_label` renders as `one of our ads on Facebook or Instagram` and appears only in Email 1.
- Every middle message addresses one objection or question only. Follow the sequence: concern, answer/proof, application to the prospect, and a varied invitation to reply with questions. Appointment references remain selective rather than mandatory.
- Emails 1 and 18 are explicit structural exceptions: Email 1 confirms and frames the sequence; Email 18 prepares the prospect.
- No Brevo nurture email contains the meeting/join URL. The separate Gmail reminder lane owns exact logistics and the join link.
- Case-study and proof-archive links are optional structured fields. Render them only when a reviewed real URL exists; never ship placeholder text or invent a destination.
- Set Brevo `replyTo` to the monitored salesperson mailbox.
- Add tags: `pulpsense`, `precall`, `precall-v1`, and the module ID.
- Never log recipient address, rendered body, meeting URL, or opt-out token.
- Do not use a Brevo template ID for canonical copy.

Common compliance footer appended after the approved body and sign-off:

```text
PulpSense
{{business_postal_address}}

Don't want the preparation emails? Stop pre-call emails: {{precall_opt_out_url}}
Your appointment will stay booked.
```

---

# 7. Approved email library: `precall-v1`

The sole canonical copy source is:

[`docs/plans/2026-08-11-precall-email-copy-library.md`](./2026-08-11-precall-email-copy-library.md)

Santi approved that library for implementation on 2026-08-11. Do not duplicate or rewrite the bodies in application code, fixtures, Brevo templates, or this architecture plan. The typed library in `apps/automations/src/email/precall-copy.ts` must be a direct representation of the approved file.

Module identity and selection metadata:

| Email | Module ID | Priority | Bit index | Role |
|---:|---|---:|---:|---|
| 1 | `confirmation` | Required | n/a | Immediate booking confirmation |
| 2 | `what-we-will-inspect` | 1 | 0 | Middle module |
| 3 | `proof-twin-oaks` | 2 | 1 | Middle module |
| 4 | `measurement-and-attribution` | 3 | 2 | Middle module |
| 5 | `already-have-seo` | 4 | 3 | Middle module |
| 6 | `guarantee` | 5 | 4 | Middle module |
| 7 | `google-and-ai-mechanism` | 6 | 5 | Middle module |
| 8 | `no-ad-spend-or-shared-leads` | 7 | 6 | Middle module |
| 9 | `owner-time` | 8 | 7 | Middle module |
| 10 | `rebuild-risk` | 9 | 8 | Middle module |
| 11 | `proof-wesley-glen` | 10 | 9 | Middle module |
| 12 | `market-applicability` | 11 | 10 | Middle module |
| 13 | `call-quality` | 12 | 11 | Middle module |
| 14 | `economics` | 13 | 12 | Middle module |
| 15 | `multiple-locations` | 14 | 13 | Middle module |
| 16 | `market-exclusivity` | 15 | 14 | Middle module |
| 17 | `why-now` | 16 | 15 | Middle module |
| 18 | `final-preparation` | Required | n/a | Final preparation |

The renderer appends only the statutory business-address and opt-out footer. Each approved body already contains its casual `Talk soon, Santi` sign-off. Every email invites questions by reply; no email asks the prospect to reply with numbers, reports, or other homework.

---

## 8. Repository design

### New files

```text
apps/automations/src/email/precall-copy.ts
apps/automations/src/email/precall-copy.test.ts
apps/automations/src/email/render-precall-email.ts
apps/automations/src/email/render-precall-email.test.ts
apps/automations/src/trigger/precall-schedule.ts
apps/automations/src/trigger/precall-schedule.test.ts
apps/automations/src/trigger/precall-sequence.ts
apps/automations/src/trigger/precall-sequence.test.ts
apps/automations/src/trigger/brevo-transactional.ts
apps/automations/src/trigger/brevo-transactional.test.ts
packages/contracts/src/precall-events.ts
packages/contracts/src/precall-opt-out-token.ts
packages/contracts/src/precall-opt-out-token.test.ts
apps/funnels/src/server/precall-opt-out.ts
apps/funnels/functions/api/precall-opt-out.ts
```

### Modified files

```text
packages/contracts/src/funnel-events.ts
packages/contracts/src/index.ts
apps/automations/src/trigger/lifecycle-destinations.ts
apps/automations/src/trigger/lifecycle-destinations.test.ts
apps/automations/src/trigger/process-funnel-event.ts
apps/automations/src/trigger/process-funnel-event.test.ts
apps/automations/.env.example
apps/automations/README.md
apps/funnels/src/server/funnel-env.ts
apps/funnels/src/server/funnel-api.test.ts
apps/funnels/.env.example
apps/funnels/.dev.vars.example
docs/runtime-configuration.md
docs/lead-lifecycle-automation-plan.md
CONTEXT.md
```

Do not modify the existing Gmail reminder copy or merge reminder and nurture modules.

---

# 9. TDD implementation tasks

## Task 1: Add the pure copy contract

**Objective:** Represent all 18 approved messages as typed, testable modules.

**Files:**
- Create: `apps/automations/src/email/precall-copy.ts`
- Test: `apps/automations/src/email/precall-copy.test.ts`

**Steps:**

1. Write failing tests asserting exactly 18 unique IDs, required confirmation/final modules, middle priorities 1–16, immutable bit indexes 0–15, one primary CTA each, sender identity in every message, full appointment details in Email 1, same-day time context in Email 18, varied/non-boilerplate call continuity across middle emails, acquisition-source continuity in Email 1 only, no `meeting_url` or join-link copy anywhere in nurture, no vertical-specific route branching, and all required variables declared.
2. Run `pnpm test -- apps/automations/src/email/precall-copy.test.ts`; expect failure because the module does not exist.
3. Implement the typed library as a direct representation of `docs/plans/2026-08-11-precall-email-copy-library.md`; Section 7 defines the immutable module metadata.
4. Run the focused test; expect pass.
5. Commit: `feat(automations): add canonical pre-call email library`.

## Task 2: Build and test rendering

**Objective:** Render escaped text and mobile-safe HTML without Brevo template drift.

**Files:**
- Create: `apps/automations/src/email/render-precall-email.ts`
- Test: `apps/automations/src/email/render-precall-email.test.ts`

**Steps:**

1. Test variable validation, HTML escaping, text rendering, approved body sign-offs, the compliance footer, sender identity, postal address, and opt-out URL; assert that no nurture render accepts or emits a meeting URL.
2. Verify missing variables fail closed instead of producing `undefined` copy.
3. Implement a small string renderer; do not add React Email unless a concrete need appears.
4. Snapshot representative confirmation, objection, proof, and final messages.
5. Commit: `feat(automations): render pre-call email safely`.

## Task 3: Implement the deterministic scheduler

**Objective:** Produce stable 4–18-module UTC schedules with collision avoidance.

**Files:**
- Create: `apps/automations/src/trigger/precall-schedule.ts`
- Test: `apps/automations/src/trigger/precall-schedule.test.ts`

**Required tests:**

- 4h → 4 messages with the explicit short-notice pattern.
- 6h → 4 messages.
- 12h → 4 messages.
- 18h → 5 messages.
- 24h → 6 messages.
- 36h → 9 messages.
- 48h → 12 messages.
- 60h → 15 messages.
- 72h, 96h, and 120h → 18 messages.
- Immediate confirmation is first.
- Final preparation is last.
- No slot is within 45 minutes of a future Gmail threshold.
- Existing middle-module receipts are excluded after reschedule.
- Past slots are skipped, not bunched.
- DST changes preserve exact UTC appointment time.

Commit: `feat(automations): calculate pre-call schedules`.

## Task 4: Move Brevo contact/list upsert to `contact_submitted`

**Objective:** Create the contact at the earliest accepted event and add lists #7 and #9 without erasing memberships or suppressions.

**Files:**
- Modify: `apps/automations/src/trigger/lifecycle-destinations.ts`
- Modify: `apps/automations/src/trigger/lifecycle-destinations.test.ts`
- Modify: `apps/automations/src/trigger/process-funnel-event.ts`
- Modify: `apps/automations/src/trigger/process-funnel-event.test.ts`

**Design:**

1. Split basic contact upsert from later lifecycle publication.
2. On `contact_submitted`, upsert owned identity/attribution attributes.
3. Add every accepted paid-ad contact to Paid Ads (#7) through an additive list operation.
4. Add every marketing-eligible contact to Newsletter (#9) through a separate additive list operation.
5. If an existing contact has `emailBlacklisted === true`, preserve Paid Ads source membership, skip Newsletter enrollment, and never clear or rewrite the blacklist.
6. Keep `application_submitted` responsible for Booking Link and qualified-unbooked lifecycle only.

**Tests:**

- Contact event invokes Brevo independently of Twenty, Meta, Slack, and PostHog.
- Payload contains list IDs 7 and 9 from environment configuration.
- Existing unrelated list IDs are not replaced.
- Existing attributes outside `PULPSENSE_*` are not overwritten.
- Existing blacklist/suppression state is not reset.
- A blacklisted contact joins Paid Ads but not Newsletter.
- Application replay does not duplicate the basic capture operation.

Commit: `feat(automations): sync Brevo contacts on capture`.

## Task 5: Add the Brevo transactional adapter

**Objective:** Send one immediate text+HTML message with stable transport identity.

**Files:**
- Create: `apps/automations/src/trigger/brevo-transactional.ts`
- Test: `apps/automations/src/trigger/brevo-transactional.test.ts`

**Tests:**

- Calls `POST /v3/smtp/email`.
- Includes verified sender, reply-to, recipient, subject, text, HTML, tags, and stable idempotency header.
- Omits `scheduledAt`.
- Redacts all PII and bodies from thrown/logged operational context.
- Distinguishes retryable 429/5xx/network failures from non-retryable invalid requests.
- Returns and records Brevo `messageId`.

Commit: `feat(automations): add Brevo pre-call transport`.

## Task 6: Build send-time eligibility and receipts

**Objective:** Make every slot safe under cancellation, reschedule, suppression, opt-out, and retry.

**Files:**
- Create/modify: `apps/automations/src/trigger/precall-sequence.ts`
- Test: `apps/automations/src/trigger/precall-sequence.test.ts`

**Steps:**

1. Reuse the same Cal read/active-start validation concepts as `meeting-reminders.ts`; extract a shared helper only if duplication becomes material.
2. Read Brevo contact state before every optional send.
3. Treat Brevo `emailBlacklisted === true` as authoritative for unsubscribe, complaint, hard-bounce, or provider block. Skip when blacklisted, opted out, stale, cancelled, started, or already receipted; do not depend on undocumented contact fields.
4. After a successful middle-module send, set its stable bit in `PULPSENSE_PRECALL_SENT_MASK` and store the active sequence ID, copy version, and status.
5. Ensure retrying a timeout cannot create a duplicate Brevo send.

Commit: `feat(automations): guard pre-call delivery`.

## Task 7: Implement the durable Trigger sequence

**Objective:** Start one idempotent Trigger task per appointment generation and wait until each due slot.

**Files:**
- Modify: `apps/automations/src/trigger/precall-sequence.ts`
- Test: `apps/automations/src/trigger/precall-sequence.test.ts`

**Steps:**

1. Define a Zod payload containing only required contact/booking/sequence data.
2. Export pure orchestration for dependency-injected tests and a `schemaTask` with stable ID `run-precall-sequence`.
3. Store the active `sequenceId`, status, and copy version before the first send so stale generations fail closed.
4. Send Email 1 immediately for a new booking.
5. Use Trigger `wait.until()` for each future slot.
6. Re-run the complete guard after every wait.
7. Stop the old task when expected start no longer matches Cal or the active Brevo sequence ID has changed.
8. Mark completed only after the final selected slot resolves.

Commit: `feat(automations): orchestrate Trigger pre-call sequence`.

## Task 8: Connect booking, reschedule, and cancellation events

**Objective:** Start and replace sequences independently from CRM/ad side effects.

**Files:**
- Modify: `apps/automations/src/trigger/process-funnel-event.ts`
- Modify: `apps/automations/src/trigger/process-funnel-event.test.ts`

**Tests:**

- Verified booking triggers pre-call and meeting reminders independently.
- Duplicate booking events create one pre-call run.
- Reschedule creates a new sequence ID using the new start.
- Old run fails its expected-start guard.
- Delivered middle modules are excluded from replacement selection.
- Cancellation does not schedule replacement nurture.
- Brevo/Trigger failure cannot replay successful Twenty, Meta, Slack, or Gmail scheduling.

Commit: `feat(automations): start pre-call from bookings`.

## Task 9: Add the signed pre-call opt-out

**Objective:** Stop optional nurture without cancelling the appointment or global contact identity.

**Files:**
- Create: `packages/contracts/src/precall-events.ts`
- Create: `packages/contracts/src/precall-opt-out-token.ts`
- Test: `packages/contracts/src/precall-opt-out-token.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/funnels/src/server/precall-opt-out.ts`
- Create: `apps/funnels/functions/api/precall-opt-out.ts`
- Modify: `apps/funnels/src/server/funnel-env.ts`
- Modify: `apps/funnels/src/server/funnel-api.test.ts`
- Modify: `apps/automations/src/trigger/process-funnel-event.ts`

**Security:**

- Use a shared Web Crypto AES-GCM helper modeled on the existing booking identity token; both Node and Cloudflare must run the same contract tests.
- Use an encrypted, authenticated, expiring token; do not expose plaintext email in the URL.
- Token binds email, submission ID, sequence ID, and expiry.
- Funnel endpoint validates token and emits authenticated `precall_opted_out` into Trigger.dev.
- Trigger updates `PULPSENSE_PRECALL_OPTED_OUT_AT` and status.
- Endpoint returns a simple confirmation page and never cancels Cal.

**Tests:** valid token, expired token, tampering, wrong environment, replay, no email leakage, Gmail reminders unaffected.

Commit: `feat(funnels): add signed pre-call opt-out`.

## Task 10: Add configuration and fail-closed gates

**Objective:** Make production enablement explicit and environment-isolated.

**Files:**
- Modify: `apps/automations/.env.example`
- Modify: `apps/funnels/.env.example`
- Modify: `apps/funnels/.dev.vars.example`
- Modify: `docs/runtime-configuration.md`

**Variables:**

```text
BREVO_API_KEY
BREVO_ADS_LIST_ID=7
BREVO_NEWSLETTER_LIST_ID=9
BREVO_LEAD_MAGNETS_LIST_ID=10
BREVO_PRECALL_SENDER_EMAIL
BREVO_PRECALL_SENDER_NAME
BREVO_PRECALL_REPLY_TO_EMAIL
PRECALL_EMAILS_ENABLED=false
PRECALL_SEQUENCE_VERSION=precall-v1
PRECALL_PUBLIC_ORIGIN
PRECALL_OPT_OUT_TOKEN_SECRET
PULPSENSE_BUSINESS_POSTAL_ADDRESS
```

Require all pre-call variables together when enabled. Local and preview must never fall back to production list IDs, sender, or credentials.

Commit: `chore(automations): configure pre-call delivery`.

## Task 11: Update architecture and operations documentation

**Objective:** Remove the obsolete Brevo-owned pre-call model everywhere.

**Files:**
- Modify: `CONTEXT.md`
- Modify: `docs/adr/0001-separate-lifecycle-orchestration-from-communication-flows.md`
- Modify: `docs/adr/0003-separate-pre-call-nurture-from-meeting-reminders.md`
- Modify: `docs/lead-lifecycle-automation-plan.md`
- Modify: `apps/automations/README.md`

Document Trigger ownership, Brevo transport, Gmail separation, contact-capture list assignment, replay behavior, canary procedure, and rollback flag.

Commit: `docs: record Trigger-owned pre-call architecture`.

## Task 12: Run the full quality gate

Run:

```bash
pnpm test
pnpm check-types
pnpm lint
pnpm build
```

Expected:

- all tests pass;
- zero TypeScript/Astro diagnostics;
- no new lint errors;
- production build succeeds;
- no tracked secret values;
- no template contains unresolved variables.

Commit any test-only correction separately from feature logic.

---

## 10. Canary and release gate

1. Keep `PRECALL_EMAILS_ENABLED=false` in production.
2. Configure sandbox Brevo sender, lists, and test recipient.
3. Book a controlled appointment about 60 hours ahead.
4. Confirm the scheduler selects 15 emails and sends Email 1 immediately.
5. Verify Brevo receives immediate-send requests without `scheduledAt`.
6. Reschedule after one middle module; verify the old task stops and the new task excludes that module.
7. Use the pre-call opt-out; verify later nurture stops while Gmail reminders and the appointment remain active.
8. Force a Brevo failure and verify stable retry/idempotency behavior.
9. Cancel another canary and verify no later nurture or Gmail reminders send.
10. Inspect logs for PII/body/token leakage.
11. Enable one production campaign only after all checks pass.
12. Roll back instantly with `PRECALL_EMAILS_ENABLED=false` without disabling existing Gmail reminders.

---

## 11. Success metrics

Primary:

- booked-to-show rate;
- call-to-qualified-opportunity rate;
- pre-call opt-out rate;
- complaint and hard-bounce rate;
- cancellation and reschedule rate.

Secondary:

- reply rate;
- delivery rate;
- module-level click rate where a real CTA exists.

Do not optimize primarily for opens. Compare density cohorts only after the control has enough bookings to avoid reading noise as signal.

---

## 12. Codex completion checklist

- [ ] Contact upsert occurs on `contact_submitted`.
- [ ] Paid-ad contacts are added to lists 7 and 9 additively.
- [ ] Existing lists, attributes, and suppressions are preserved.
- [ ] Trigger.dev owns every pre-call timing and selection decision.
- [ ] Brevo requests never use `scheduledAt`.
- [ ] Count formula and all horizon examples pass tests.
- [ ] Short-notice scheduling avoids Gmail's 2-hour reminder.
- [ ] All 18 canonical emails are versioned and rendered in text+HTML.
- [ ] Confirmation is immediate and final preparation is appointment-relative.
- [ ] Cancellation, reschedule, replay, and retries do not duplicate sends.
- [ ] Middle objection/proof modules do not repeat after reschedule.
- [ ] Pre-call opt-out leaves the appointment and Gmail reminders intact.
- [ ] Full tests, types, lint, and build pass.
- [ ] Live canary evidence exists before production enablement.
