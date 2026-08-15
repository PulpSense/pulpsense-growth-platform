# ADR 0005: Model terminal sales outcomes as immutable events

## Decision

Twenty remains the commercial source of truth. Only Opportunity changes involving the stable won stage ID, stable lost stage ID, or revenue amount are eligible for sales lifecycle processing. Editable stage labels and intermediate pipeline changes are never analytics lifecycle events.

The Cloudflare Pages Function verifies Twenty's HMAC-SHA256 signature over `<timestamp>:<exact raw body>`, rejects requests older than five minutes, validates the production workspace and required CRM references, and returns success only after Trigger.dev confirms durable enqueue.

Trigger.dev emits append-only PostHog events on the Prospect timeline:

- `sale_completed` when an Opportunity first enters won;
- `sale_lost` when it first enters lost;
- `sale_revenue_adjusted` when amount or currency changes while won;
- `sale_outcome_corrected` when a later terminal stage contradicts the recorded terminal outcome.

Every event carries Prospect ID, originating Lead Journey ID, Twenty Person ID, Twenty Opportunity ID, occurrence time, numeric amount, and ISO currency. PostHog `$insert_id` values make webhook redelivery and task retries successful no-ops. Original lifecycle events are never deleted or rewritten.

Twenty Opportunity field `pulpsenseSalesOutcome` stores only the last successfully emitted terminal outcome (`won` or `lost`). Trigger.dev updates it after PostHog accepts an event. If that write fails, a retry resends the same idempotent PostHog event before completing the state write. This minimal projection is used only to classify later corrections; it is not an analytics event ledger.

## Consequences

The production workspace must expose `prospectId` on Person and `originatingLeadJourneyId` plus `pulpsenseSalesOutcome` on Opportunity. Configuration uses immutable stage IDs through `TWENTY_WON_STAGE_ID` and `TWENTY_LOST_STAGE_ID`.

Historical People and Opportunities are migrated with an explicit four-row mapping file. The backfill command defaults to a non-mutating dry run; `--apply` is run only after approval, followed by `--read-back` verification.
