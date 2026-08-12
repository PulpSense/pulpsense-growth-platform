# Cloudflare Pages delivery

The repository deploys the Astro funnel through `.github/workflows/cloudflare-pages.yml`. Cloudflare Pages remains a Direct Upload project; GitHub Actions runs the repository checks, builds the client bundle with environment-scoped public values, and uploads `apps/funnels/dist` with Wrangler.

## Pull-request previews

Pull requests targeting `master` run the test suite, workspace type checks, funnel lint, and a credential-free Astro production build before deployment. A non-draft pull request from this repository then:

1. reads sandbox configuration from the GitHub `Preview` environment;
2. builds Astro with `PUBLIC_PULPSENSE_ENVIRONMENT=preview`;
3. deploys to `pulpsense-funnels-preview` on branch `pr-<number>`; and
4. publishes the branch alias as a GitHub deployment and job summary.

New commits cancel older in-progress work for the same pull request. Fork and Dependabot pull requests run verification without receiving deployment credentials or creating previews.

Configure the `Preview` GitHub environment with:

| Kind     | Name                            | Value                                                                     |
| -------- | ------------------------------- | ------------------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`          | A token scoped to Cloudflare Pages edit access for the PulpSense account  |
| Variable | `CLOUDFLARE_ACCOUNT_ID`         | The PulpSense Cloudflare account ID                                       |
| Variable | `CLOUDFLARE_PAGES_PROJECT`      | `pulpsense-funnels-preview`                                               |
| Variable | `PUBLIC_META_PIXEL_ID_AI_SEO_L` | The non-production lawyers Meta dataset used by the AI SEO funnel         |
| Variable | `PUBLIC_META_PIXEL_ID_AI_SEO_D` | The non-production dentist Meta dataset used by the dentist route         |
| Variable | `PUBLIC_META_PIXEL_ID_AI_SEO_DI` | The non-production dental implants Meta dataset                         |
| Variable | `PUBLIC_META_PIXEL_ID_AI_SEO_PS` | The non-production plastic surgery Meta dataset                          |
| Variable | `PUBLIC_META_PIXEL_ID_AI_SEO_HR` | The non-production hair restoration Meta dataset                         |
| Variable | `PUBLIC_META_PIXEL_ID_AI_SEO_MS` | The non-production med spa Meta dataset                                  |
| Variable | `PUBLIC_POSTHOG_KEY`            | The public PostHog project key used for privacy-allowlisted funnel events |
| Variable | `PUBLIC_POSTHOG_HOST`           | The region-appropriate PostHog ingestion host                             |
| Variable | `PUBLIC_CAL_LINK`               | The non-production Cal event link                                         |
| Variable | `PUBLIC_CAL_NAMESPACE`          | Optional Cal embed namespace                                              |
| Variable | `PUBLIC_TURNSTILE_SITE_KEY`     | The browser-facing Turnstile widget key                                   |

Pages Function credentials such as Trigger.dev, MillionVerifier, Turnstile, and webhook secrets stay in the Cloudflare Pages environment. They are not copied into GitHub because Direct Upload preserves the project's runtime configuration. The checked-in Wrangler configuration binds preview deployments to the private `pulpsense-funnel-rate-limiter-preview` Worker. Deploy that Worker from `apps/rate-limiter` before the Pages project; #87 must provide a separate production service before launch.

The Turnstile widget's Hostname Management must authorize `pulpsense-funnels-preview.pages.dev`. Cloudflare applies that authorization to the project hostname and all branch aliases beneath it, so do not add per-PR hostnames. A correct site key still fails client-side with Turnstile error `110200` when the Pages project hostname is absent.

## Production gate

A push to `master` reruns verification and then enters the GitHub `Production` environment. Protect that environment with:

- `master` as its only deployment branch;
- the project owner as a required reviewer; and
- prevention of self-review when a second authorized reviewer is available.

The job cannot read its Cloudflare or Trigger.dev tokens or deploy until the environment is approved. A push to `master` runs verification and automatically starts the protected production job. After SHA-specific owner approval, the job validates the required Pages secret and Trigger.dev Production variable names without displaying their values, builds with production public configuration, and deploys through `wrangler.production.toml` so the production Pages project cannot bind the preview rate limiter. `workflow_dispatch` with `deploy_production` remains available as a manual recovery path.

Once approved for launch, configure the same secret and public variables as Preview, plus:

| Kind     | Name                       | Purpose                                                    |
| -------- | -------------------------- | ---------------------------------------------------------- |
| Variable | `CLOUDFLARE_PAGES_BRANCH`  | Production branch configured on the selected Pages project |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | Production Pages project name                              |

Production starts automatically after a verified push to `master` and waits at the protected `Production` environment for approval. Follow [`release-runbook.md`](./release-runbook.md) for qualification, the exact approval statement, live checks, and the 30-minute rollback window.

## Required repository check

Protect `master` and require the workflow's `Verify` job before merge. `Verify` includes the production build and runs without deployment credentials. Do not require `Deploy preview`: credential-free fork pull requests intentionally skip that job.

## Failure and retry

If verification fails, no deployment starts. Open the failed step, fix the underlying test, type, lint, or build error, and push a new commit. For a transient runner or Cloudflare failure, use **Re-run failed jobs** in GitHub Actions. A successful retry deploys the same `pr-<number>` alias while preserving its previous atomic deployment URLs.

For configuration failures, confirm the failing job selected the intended GitHub environment, its required variables exist, and `CLOUDFLARE_API_TOKEN` still has Pages edit access for that environment's account and project. Do not bypass `Verify`, expose the token as a repository variable, or relax the Production approval rule to recover a deployment.

## Manual recovery

If GitHub Actions is unavailable, an authorized operator can create a sandbox preview from a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check-types
pnpm lint
PUBLIC_PULPSENSE_ENVIRONMENT=preview \
PUBLIC_POSTHOG_KEY=<project-key> \
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com \
PUBLIC_CAL_LINK=<sandbox-owner/sandbox-event> \
PUBLIC_CAL_NAMESPACE=<sandbox-namespace> \
PUBLIC_TURNSTILE_SITE_KEY=<sandbox-widget-key> \
pnpm --filter @pulpsense/funnels build
pnpm --filter @pulpsense/funnels exec wrangler pages deploy dist \
  --project-name pulpsense-funnels-preview \
  --branch recovery-<ticket-or-sha>
```

Record the atomic deployment URL in the incident or pull request. Never use production credentials for a recovery preview.

## Rollback

For a preview, redeploy the last known-good commit to the same `pr-<number>` branch or close the pull request and use its previous atomic deployment URL.

For production, open the Cloudflare Pages project, choose **Deployments**, select the last verified production deployment, and roll it back. Then revert or repair `master` so the next approved workflow run cannot reintroduce the bad build. Record the deployment ID, rollback time, owner, and smoke-test result.
