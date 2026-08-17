# Issue 162 production validation and managed dashboard

Recorded on 2026-08-17 against PostHog project `549551`. This record excludes raw emails, Prospect IDs, and other Prospect data.

## Result

Dashboard creation is intentionally blocked. The production taxonomy does not yet satisfy the dashboard contract in `apps/automations/scripts/posthog-lead-journey-dashboard.mjs`.

- Two accepted contact Prospects were found through current `email` person properties. Each profile contained six browser-side funnel events captured before acceptance, confirming anonymous history merged after identification.
- Both profiles contained one Lead Journey. No email-searchable Prospect with multiple journeys was available for validation.
- Browser events had a session ID, but the matching server-side contact lifecycle event did not. No `$snapshot` events were present, so recording linkage could not be validated.
- PostHog's project-side Session Replay network setting has not been verified with request/response header and body capture enabled. Local SDK options permit full capture, but the remote project setting must also enable it.
- Application and booking lifecycle events exist in production, including one reschedule and six cancellations, but the observed samples predate the current identified-Prospect rollout and lack searchable email and session linkage.
- `sale_completed`, `sale_lost`, `sale_revenue_adjusted`, and `sale_outcome_corrected` have not been observed in production. Their outcome properties therefore remain code-defined, not production-validated.

The machine-readable evidence file records event/property types and validation flags. Sales validation also records a redacted Prospect hash, the expected Journey and Twenty references, amount, currency, and the matching sample count. The automation requires exactly one matching sample for each sales event and rejects the file until every required shape and relationship is observed.

## Managed surface and update workflow

Once production evidence passes, `buildDashboardPlan` defines four managed insights: complete Prospect timeline/replay sessions, current mutable Prospect properties, immutable Journey Attribution, and immutable sales/revenue history. `reconcileDashboard` updates resources by managed key when identifiers already exist and creates only missing resources.

Before validation, open PostHog **Settings → Project → Replay → Network recording** and enable request/response headers and bodies. Confirm a new production replay exposes those payloads, then set `networkPayloadCapture` to true.

After a representative production Prospect has completed the missing paths, update the JSON evidence from redacted PostHog queries and run the focused test. Then run `POSTHOG_PERSONAL_API_KEY=... node apps/automations/scripts/posthog-lead-journey-dashboard.mjs docs/evidence/issue-162-lead-journey-dashboard.json`. The command discovers resources by managed name/tag, creates or patches them through PostHog's supported REST API, and prints JSON containing the managed dashboard, variable, and insight identifiers. Record those returned identifiers here. Credentials belong in ignored environment variables or the authenticated PostHog connector, never this repository.
