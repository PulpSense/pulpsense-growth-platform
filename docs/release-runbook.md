# Production release and cutover runbook

This runbook is the launch gate for `go.pulpsense.com`. It separates production preparation, explicit owner approval, cutover, live verification, and rollback so an approved release candidate cannot be changed silently between stages.

## Release identity

Record all of the following in `docs/evidence/issue-87-release-candidate.md` before qualification:

- the full Git commit SHA from `master`;
- the immutable Cloudflare Pages deployment ID and URL;
- the Trigger.dev production version;
- the production Pages project and rate-limiter Worker names;
- the operator and start time in UTC.

If any code, build-time public variable, Pages binding, runtime secret, Trigger.dev variable, Cal webhook, or vendor destination changes, invalidate the evidence and qualify a new release identity.

## Configuration gate

Validate names and destinations without printing or copying secret values.

### GitHub Production environment

The `Production` environment must allow only `master`, require the project owner to review deployments, and contain:

- secret `CLOUDFLARE_API_TOKEN`;
- secret `TRIGGER_ACCESS_TOKEN`;
- variables `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`, and `CLOUDFLARE_PAGES_BRANCH`;
- variables `PUBLIC_META_PIXEL_ID`, `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`, `PUBLIC_CAL_LINK`, `PUBLIC_CAL_NAMESPACE`, and `PUBLIC_TURNSTILE_SITE_KEY`.

The project must be `pulpsense-funnels`, its production branch must be `master`, and it must have no custom domain until owner approval.

### Cloudflare production runtime

Deploy `pulpsense-funnel-rate-limiter` with `pnpm --filter @pulpsense/rate-limiter deploy:production`. Confirm it has no public route. The Pages project must use `apps/funnels/wrangler.production.toml`, whose `FUNNEL_RATE_LIMIT_SERVICE` binding targets that production service, never the preview Worker.

Configure the Pages project with `PULPSENSE_ENVIRONMENT=production` and the secrets `TURNSTILE_SECRET_KEY`, `SUBMISSION_SIGNING_SECRET`, `MILLION_VERIFIER_API_KEY`, `PULPSENSE_TRIGGER_SECRET_KEY`, and `CAL_WEBHOOK_SECRET`. Confirm Turnstile authorizes both the production `pages.dev` hostname and `go.pulpsense.com`. Confirm the Cal webhook targets `/api/webhooks/cal` on the production hostname and uses the matching secret.

### Trigger.dev production runtime

Deploy the qualified automation version and confirm the Production environment contains:

- `PULPSENSE_AUTOMATION_ENVIRONMENT=production`;
- `TWENTY_API_ORIGIN`, `TWENTY_API_KEY`, `TWENTY_QUALIFIED_STAGE_VALUE`, `TWENTY_CALL_BOOKED_STAGE_VALUE`, and `TWENTY_CLOSED_STAGE_VALUES` for the production Twenty workspace;
- `META_PIXEL_ID_AI_SEO_L`, `META_CAPI_ACCESS_TOKEN_AI_SEO_L`, and `META_GRAPH_API_VERSION` for the intended production dataset;
- no `META_TEST_EVENT_CODE_AI_SEO_L` during live delivery;
- `POSTHOG_PROJECT_KEY` and the region-correct `POSTHOG_HOST`;
- `SLACK_FAILURE_WEBHOOK_URL` for the production reliability channel.

The gated GitHub workflow checks that the required Pages secrets and Trigger.dev variable names exist before deploying. Provider dashboards remain the source of truth for the destination each credential selects.

## Release qualification

Deploy the exact candidate SHA to the dedicated `pulpsense-funnels-preview` project with preview-only Cloudflare, Trigger.dev, Twenty, Meta, PostHog, Slack, Turnstile, MillionVerifier, and Cal destinations. Use the immutable preview deployment URL for qualification. Do not qualify by sending test data through production destinations before approval.

Run the automated gate from a clean checkout:

```bash
PARITY_CHECK_ORIGIN=https://<immutable-deployment>.pulpsense-funnels-preview.pages.dev \
  pnpm qualify:release
```

This runs the full test suite, workspace type checks, lint, an Astro production build, public HTTP parity/crawler checks, and three mobile Lighthouse runs. The median Lighthouse navigation uses a 390 × 844 viewport, device scale factor 3, and simulated mobile throttling. Release budgets are LCP < 2,500 ms and CLS < 0.1.

At desktop 1440 × 900 and mobile 390 × 844, complete and record these journeys with synthetic test identities:

| Journey                 | Required proof                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact                 | Accepted request, one Trigger run, one Twenty Person upsert, Meta `Lead`, and redacted PostHog contact event                                                                                               |
| Qualified application   | Booking step shown, immutable Twenty application activity, Opportunity at `Qualified – Awaiting Booking`, Meta `SubmitApplication` with only canonical qualification status, and PostHog application event |
| Unqualified application | Redirect to `/unqualified/`, immutable activity, no Opportunity, no booking widget, and Meta `SubmitApplication`                                                                                           |
| Booking                 | Signed Cal webhook accepted, redirect to `/thank-you/`, booking activity, Opportunity at `Call Booked`, Meta `Schedule`, and redacted PostHog booking event                                                |
| Retry                   | Force one enqueue failure, retry with the same identity, and confirm one durable lifecycle outcome                                                                                                         |
| Duplicate               | Replay each accepted event and confirm no duplicate Twenty object, activity, Opportunity, booking, or Meta conversion                                                                                      |
| Recovery                | Link the controlled Twenty and Meta recovery evidence required by `docs/funnel-event-recovery.md`                                                                                                          |

Also confirm all three live routes contain noindex metadata, return the global `X-Robots-Tag`, and that `/robots.txt` disallows all crawling. Do not record raw form answers, tokens, credentials, webhook bodies, email addresses, or phone numbers in evidence.

## Approval gate

The owner must approve the immutable candidate after reviewing the completed evidence. Approval must identify the SHA and use an unambiguous statement such as:

> I approve release candidate `<full-sha>` for production cutover to `go.pulpsense.com`.

An implementation request, merged pull request, workflow approval from an earlier candidate, or approval without the candidate SHA is not cutover approval.

## Cutover and live smoke test

1. Record the current `go.pulpsense.com` DNS/custom-domain state and the approved preview deployment ID.
2. From `master`, dispatch **Cloudflare Pages** with `deploy_production=true`, approve the protected `Production` job, and confirm it deploys the approved SHA.
3. On the production project's immutable `pages.dev` URL, repeat the non-mutating route/crawler checks and confirm the build exposes the approved public Meta, PostHog, Cal, and Turnstile destinations. Stop and roll back if the SHA or configuration differs from the approval record.
4. Attach `go.pulpsense.com` to `pulpsense-funnels`; do not change the apex or unrelated DNS records.
5. Start the rollback clock when Cloudflare reports the custom domain active.
6. At T+0, T+5, T+15, and T+30 minutes, check the three routes, crawler controls, a synthetic contact, a qualified application, an unqualified application, and a verified booking. Confirm the expected Twenty, Meta, PostHog, Trigger.dev, and Slack behavior without exposing lead data.
7. Record the live deployment ID, DNS state, observations, and owner decision at T+30.

## Rollback decision window

The focused rollback window is exactly 30 minutes from custom-domain activation. Roll back immediately during that window for any 5xx response on a public journey, crawler-control regression, lost or duplicate lead, incorrect qualification/redirect, unavailable booking, unverified `Schedule`, cross-environment delivery, missing production signal, or sustained LCP/CLS budget breach.

For an application regression, select the last verified deployment in Cloudflare Pages and roll it back, then repeat the live smoke test. For a domain or binding regression on the first launch, detach `go.pulpsense.com` from Pages and restore the recorded pre-cutover DNS state. Disable new production ingestion if cross-environment or duplicate delivery is possible, then follow `docs/funnel-event-recovery.md` before replaying events.

The deployment remains rollback-capable after 30 minutes; later incidents follow the same procedure without the scheduled T+ checks.

## Framework retirement

The transitional Next.js/Vercel implementation was removed from the release candidate at the owner's explicit direction. Astro, Cloudflare Pages, the private rate-limiter Worker, and Trigger.dev are the only supported path. Keep the approved Cloudflare deployment ID and corresponding git commit as the rollback reference; do not maintain a second framework runtime.
