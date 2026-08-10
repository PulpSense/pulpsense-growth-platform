# Issue #87 production release evidence

Status: **complete — launched and healthy**

Initial audit: 2026-08-09

Reconciled against live systems: 2026-08-10

## Release identity and cutover

| Item | Verified state |
| --- | --- |
| GitHub release source | `aebeb50330ca9ffffda2060b37f1d00d93f7e07a`; GitHub Actions run `31388460226` passed verification and the protected Production deployment on 2026-08-10 |
| Cloudflare production project | `pulpsense-funnels`, production branch `master` |
| Current Cloudflare deployment | `a4992461-d5ad-405d-8d07-733eea486a9a`, sourced from `aebeb50` |
| Production hostname | `go.pulpsense.com` is active on `pulpsense-funnels`; `pulpsense-funnels.pages.dev` remains the immutable project hostname |
| Runtime equivalence to current `master` | Production is deployed directly from the current `master` head |
| Production rate limiter | Private `pulpsense-funnel-rate-limiter` deployment is active; the production Pages config binds only this production service |
| Trigger.dev production deployment | Version `20260809.1`, deployment `1seln2g5`, commit `30a6968`; tasks `health-check` and `process-funnel-event` are active |
| Framework retirement | Complete. Astro, Cloudflare Pages, the private rate-limiter Worker, and Trigger.dev are the supported runtime; the Next.js/Vercel runtime is removed |
| Rollback | No rollback was performed. The preceding Cloudflare deployment remains available in Pages deployment history |

GitHub's `Production` environment still requires the project owner and restricts deployments through its branch policy. Its required Cloudflare and Trigger.dev credential names are present. The production Pages project has the required encrypted runtime names: `CAL_WEBHOOK_SECRET`, `MILLION_VERIFIER_API_KEY`, `PULPSENSE_ENVIRONMENT`, `PULPSENSE_TRIGGER_SECRET_KEY`, `SUBMISSION_SIGNING_SECRET`, and `TURNSTILE_SECRET_KEY`.

Trigger.dev Production has the required Twenty, Meta, PostHog, Slack, and environment variable names. `META_TEST_EVENT_CODE_AI_SEO_L` is absent, as required for live delivery.

## Automated and live HTTP qualification

The complete non-mutating release gate was rerun against `https://go.pulpsense.com` on 2026-08-10:

- 19 test files and 81 tests passed.
- All workspace type checks passed.
- Funnel lint and the Astro production build passed.
- All three public routes, six React island exports, trailing-slash behavior, API fallbacks, crawler controls, and `robots.txt` passed.
- Three-run mobile median: LCP 1,091.113 ms; CLS 0.

The live lander, thank-you route, and unqualified route return HTTP 200 with `X-Robots-Tag: noindex, nofollow, noarchive, noimageindex`. `robots.txt` returns HTTP 200 and disallows crawling.

## Production lifecycle evidence

Production Trigger.dev version `20260809.1` processed the following redacted journeys successfully on 2026-08-10. The source payloads remain available only to authorized operators in Trigger.dev and are not copied here.

| Journey | Result |
| --- | --- |
| Contact | Pass. Completed production runs returned a Twenty Person identifier and a matching Meta event identifier |
| Qualified application | Pass. A completed production run returned a Person, immutable application activity, open Opportunity, and Meta `SubmitApplication` identifier |
| Unqualified application | Pass. A completed production run returned a Person, immutable application activity, and Meta `SubmitApplication` identifier with no Opportunity |
| PostHog lifecycle delivery | Configured and invoked after each accepted lifecycle event; delivery remains non-blocking by design |
| Retry, duplicate, and recovery behavior | Proven by the automated replay suite and the controlled Development exercise in `docs/evidence/issue-86-dev-recovery.md`; no production replay was performed because it would resend an existing lead payload to live vendors |
| Verified booking | Pass. The owner completed the production form and booking test against the event-scoped `santileoni/funnel` Cal.com webhook |

The production attempts inspected during reconciliation showed the expected unverified safety behavior: unverified applications withheld booking. The owner separately confirmed the completed production form and booking test.

## Cal.com authoritative booking configuration

The earlier audit was stale because it inspected the account-level webhook list. The production webhook already existed locally on event type `santileoni/funnel`.

Reconciliation on 2026-08-10 confirmed:

- The existing event-scoped webhook is enabled and targets `https://go.pulpsense.com/api/webhooks/cal`.
- It subscribes only to `Booking created`.
- The event-scoped webhook and Cloudflare `CAL_WEBHOOK_SECRET` use the same rotated secret.
- The current `master` head was redeployed so the rotated Pages secret is active.
- The signed Cal.com ping passed with HTTP 202.
- An unsigned `BOOKING_CREATED` probe returned HTTP 401 with `invalid_cal_signature`.
- A mistakenly added account-level duplicate webhook was removed; the event-scoped webhook remains the single authoritative Cal.com delivery path for this funnel.

The owner confirmed the production form had already been tested and no second form submission was required during this reconciliation.

## Issue #79 closure amendment

On 2026-08-10, the owner explicitly accepted the completed manual browser and visual qualification in place of adding Playwright coverage or retaining screenshots in the repository. Those two original testing decisions are waived for this launched release and are not closure requirements. This release evidence is complete, and umbrella issue #79 can be closed.
