# Issue 86 development recovery evidence

Date: 2026-08-09

Environment: Trigger.dev Development, local worker version `20260809.16`, sandbox Twenty workspace, Meta Test Events configuration, and a local non-production Slack capture endpoint. The worker ran code revision `ca9e8e5` with a synthetic contact event. Production destinations and credentials were not modified.

Stable identifiers:

- submission ID: `86000000-0000-4000-8000-000000000001`
- event ID: `contact_submitted:86000000-0000-4000-8000-000000000001`
- Twenty Person ID: `61930376-8c11-4f6d-8ae5-b2353222d98d`

## Twenty exhaustion and recovery

- Baseline run `run_06fugp770fe08o5oas6a3pd701` completed and returned the stable Person and Meta event IDs.
- Failure run `run_06fugpek7bspi9tkukk9kjms01` used a deliberately invalid sandbox Twenty key. The run made five `upsert_person` attempts, did not call Meta, and failed with `Twenty person lookup failed`.
- The failure emitted one redacted alert containing environment, funnel, event type, submission ID, event ID, operation, and Trigger.dev run link. It contained no name, email, phone, or application answers.
- Recovery run `run_06fugpqrej68phev6obedr3c01` restored the sandbox key, replayed the identical payload, completed, and returned the original Person and Meta event IDs.
- A direct sandbox query after all replays returned exactly one Person for the synthetic normalized email, with ID `61930376-8c11-4f6d-8ae5-b2353222d98d`.

## Meta exhaustion and recovery

- Failure run `run_06fugqmg2klvts9qnglbd82801` used a deliberately invalid scoped Meta sandbox token. Twenty completed on its first adapter attempt; Meta then retried independently five times and failed with `Meta Lead delivery failed (401)`.
- No exhausted-Twenty alert was emitted for the Meta-only failure.
- Recovery run `run_06fugr0c5ckno7jd0n3bf73301` restored the scoped sandbox token, replayed the identical payload, completed, and returned the original Person and Meta event IDs.
- Meta accepted the recovery through the configured Test Events path with the unchanged event ID. Reusing that event ID is the CAPI deduplication identity.

## Result

The controlled Development exercise proves one Twenty failure/recovery and one Meta-after-Twenty failure/recovery without changing the natural Person or Meta conversion identities. Twenty contained one matching Person after the full sequence. All temporary failure overrides were removed and the local worker was stopped.
