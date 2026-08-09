# Issue #87 release-candidate evidence

Status: **not approved for cutover**

Audit started: 2026-08-09

Candidate: the full `master` SHA containing this evidence; record it before deployment with `git rev-parse HEAD`

## Pre-cutover audit

| Gate                                | Result  | Evidence                                                                                                                                                                                                                     |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocking issue #86                  | Pass    | GitHub issue #86 is closed; controlled recovery evidence is in `docs/evidence/issue-86-dev-recovery.md`                                                                                                                      |
| Upstream verification               | Pass    | GitHub Actions run `31337577034`, `Verify` job, passed tests, types, lint, and Astro build for `580531682e40d179f1ba7a248524f3301ddc35d7`                                                                                    |
| Protected production approval       | Pass    | GitHub `Production` environment has the project owner as required reviewer and a deployment branch policy                                                                                                                    |
| Preview Pages project               | Pass    | `pulpsense-funnels-preview` exists with no custom production domain; latest inspected PR deployment was `ba7b28b1-7545-46e4-a25b-6442f1c26d0d`                                                                               |
| Preview Pages runtime names         | Pass    | Cloudflare reported the expected Cal, MillionVerifier, environment, Trigger.dev, signing, and Turnstile secret names without revealing values                                                                                |
| Preview browser Meta configuration  | Blocked | Meta Pixel logged `Invalid PixelID`; the configured preview value is not a numeric Meta Pixel ID. The release candidate now rejects this at build time, so Preview must receive a valid sandbox Pixel ID before redeployment |
| Production Pages project            | Blocked | No production Pages project exists yet                                                                                                                                                                                       |
| GitHub Production configuration     | Blocked | Required production variables and secrets are not configured                                                                                                                                                                 |
| Trigger.dev Production destinations | Blocked | Only platform telemetry variables exist; Twenty, Meta, PostHog, Slack, and `PULPSENSE_AUTOMATION_ENVIRONMENT` are absent                                                                                                     |
| Current hostname                    | Blocked | `https://go.pulpsense.com/` returned Cloudflare `522` during the audit; the hostname has not been cut over                                                                                                                   |
| Explicit owner approval             | Blocked | No SHA-specific production-cutover approval has been given                                                                                                                                                                   |

The unapproved production job from run `31337577034` was cancelled after its successful `Verify` job. No production deployment, custom-domain attachment, credential copy, or production vendor event was performed during this audit.

## Qualification results

Complete this section against the immutable production-project `pages.dev` deployment described by `docs/release-runbook.md`.

| Check                                       | Result                    | Evidence                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full tests, types, lint, and build          | Pass locally              | `pnpm qualify:release`: 19 test files / 80 tests, all workspace type checks, funnel lint, and Astro build passed                                                                                         |
| HTTP parity and crawler controls            | Pass on inspected preview | All three routes, six React islands, trailing slashes, `X-Robots-Tag`, metadata, and `robots.txt` passed against `ba7b28b1.pulpsense-funnels-preview.pages.dev`                                         |
| Mobile LCP ≤ 2.5 s and CLS ≤ 0.1            | Pass on inspected preview | Final three-run mobile median: LCP 1,680 ms; CLS 0                                                                                                                                                      |
| Desktop 1440 × 900 parity                   | Pass on inspected preview | Desktop headline, hero media, primary CTA, carousel, application panel, and responsive composition rendered; carousel controls and business-email validation responded                                  |
| Mobile 390 × 844 parity                     | Pass on inspected preview | Mobile headline, compact carousel, media stack, and sticky application CTA rendered at the agreed viewport                                                                                              |
| Contact journey                             | Partial                   | Synthetic contact advanced to qualification; downstream Twenty, Meta, PostHog, and Trigger run evidence still requires provider-dashboard verification                                                  |
| Qualified application journey               | Partial                   | Server-qualified answers were exercised, but the synthetic email was unverifiable and booking was correctly withheld under issue #84. A verifier-approved synthetic business identity is still required |
| Unqualified application journey             | Pass on inspected preview | Spend below $20k redirected to `/creative-multiplier-sprint/unqualified/` and rendered the application-received outcome without a booking widget; downstream provider evidence remains pending          |
| Verified booking journey                    | Pending                   |                                                                                                                                                                                                         |
| Retry and duplicate journeys                | Pending                   |                                                                                                                                                                                                         |
| Twenty and Meta recovery exercise           | Pass                      | `docs/evidence/issue-86-dev-recovery.md`                                                                                                                                                                |
| Production configuration destination review | Pending                   |                                                                                                                                                                                                         |

The inspected preview predates the issue #87 release-control commit. Repeat every passing check against the immutable production-project `pages.dev` candidate after the blocked configuration is supplied.

## Approval and cutover record

- Approved candidate SHA: pending
- Owner approval reference and timestamp: pending
- Cloudflare production deployment ID: pending
- Trigger.dev production version: pending
- Custom-domain activation time: pending
- T+0 / T+5 / T+15 / T+30 smoke results: pending
- T+30 owner decision: pending
- Rollback performed: no
- Transitional Next.js/Vercel retirement commit: pending live acceptance
