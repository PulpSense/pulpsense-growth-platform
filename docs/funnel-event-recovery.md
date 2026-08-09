# Funnel event recovery

The public `process-funnel-event` task is safe to replay with its original payload. Twenty and Meta retry independently inside a run. A later replay reuses these natural identities:

- Person: normalized business email
- application activity: submission ID
- qualified Opportunity attempt: deterministic UUID derived from the submission ID
- booking activity: deterministic UUID derived from the Cal booking UID
- Meta conversion: event name plus event ID

Company creation remains owned by the audited Twenty workspace automation, whose normalized domain field is unique.

## Locate and diagnose a failed event

1. Open the Trigger.dev run link in the `Twenty delivery exhausted retries` Slack alert. The alert contains only environment, funnel ID, event type, submission ID, event ID, failed operation, run ID, and run link.
2. Confirm that the run environment matches the event environment. Never replay a preview payload into production.
3. Review the structured logs for the failed operation and retry attempts. Routine logs intentionally omit email, phone, names, and application answers.
4. If the redacted context is insufficient, an authorized operator may inspect that run's original payload in Trigger.dev. Do not copy the payload into Slack, tickets, or ordinary logs.
5. Correct the destination problem first: credentials, API availability, Twenty schema/stage configuration, missing qualified Opportunity, or malformed sandbox setup.

An application can arrive before its contact event because it carries enough verified contact data to upsert the Person. A booking with no open qualified Opportunity retries its Twenty booking operation; if the prerequisite still does not exist after exhaustion, process or replay the qualified application before replaying the booking.

## Replay and verify

1. In the failed Trigger.dev run, select **Replay**. Keep the original payload and the original environment. Trigger.dev creates a new run against the current deployment.
2. Wait for the replay to succeed. Do not edit submission ID, event ID, booking UID, or normalized contact identity to force a retry.
3. Verify the destination outcomes:
   - Twenty has one Person for the normalized email.
   - The submission has one application Note and NoteTarget.
   - A qualified submission has one matching open Opportunity, or a later attempt has one deterministic Opportunity after the prior one closed.
   - The Cal UID has one booking Note and NoteTarget and the Opportunity is at `Call Booked`.
   - Meta Events Manager shows the expected event ID once after deduplication.
4. Record the original run ID, replay run ID, event ID, failure cause, correction, and verification result in the incident record. Do not include raw contact data or application answers.

## Controlled non-production recovery exercise

Run this before production promotion using an isolated Trigger.dev Development, staging, or preview environment, a sandbox Twenty workspace, Meta Test Events dataset, and a non-production Slack channel. Development is acceptable when the local worker loads only sandbox destination credentials and the evidence records the Trigger.dev environment and worker version. Never run the exercise against production destinations.

### Twenty failure

1. Submit a complete non-production event and retain its submission ID and event ID.
2. Temporarily replace the isolated environment's Twenty API key with a deliberately invalid sandbox value, replay the event, and confirm that the Twenty operation exhausts its retries and emits one redacted Slack alert with a working run link.
3. Restore the sandbox key and replay the failed run without changing its payload.
4. Verify one Person, one activity for the natural event identity, the expected Opportunity/booking outcome, and one Meta conversion identity.

### Meta failure after Twenty success

1. Temporarily replace the isolated environment's Meta access token with a deliberately invalid sandbox value.
2. Submit or replay a non-production event. Confirm from the run that Twenty succeeds once while only the Meta operation retries and then fails.
3. Restore the sandbox Meta token and replay the failed run with the identical payload.
4. Verify that Twenty still has no duplicate Person, activity, Company, Opportunity, or booking, and that Meta Test Events receives the original event ID.

Restore every sandbox secret immediately after its exercise. Save only run IDs, stable event/submission identifiers, counts, and redacted screenshots as evidence. The automated processor tests are the local preflight for duplicate delivery, delayed prerequisites, partial adapter failure, exhausted retry alerting, and replay after recovery; they do not replace this sandbox exercise.
