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

| Kind     | Name                        | Value                                                                    |
| -------- | --------------------------- | ------------------------------------------------------------------------ |
| Secret   | `CLOUDFLARE_API_TOKEN`      | A token scoped to Cloudflare Pages edit access for the PulpSense account |
| Variable | `CLOUDFLARE_ACCOUNT_ID`     | The PulpSense Cloudflare account ID                                      |
| Variable | `CLOUDFLARE_PAGES_PROJECT`  | `pulpsense-funnels-preview`                                              |
| Variable | `PUBLIC_META_PIXEL_ID`      | The non-production Meta dataset used by the current target market        |
| Variable | `PUBLIC_CAL_LINK`           | The non-production Cal event link                                        |
| Variable | `PUBLIC_CAL_NAMESPACE`      | Optional Cal embed namespace                                             |
| Variable | `PUBLIC_TURNSTILE_SITE_KEY` | The browser-facing Turnstile widget key                                  |

Pages Function credentials such as Trigger.dev, MillionVerifier, Turnstile, and webhook secrets stay in the Cloudflare Pages environment. They are not copied into GitHub because Direct Upload preserves the project's runtime configuration. The checked-in Wrangler configuration binds preview deployments to the private `pulpsense-funnel-rate-limiter-preview` Worker. Deploy that Worker from `apps/rate-limiter` before the Pages project; #87 must provide a separate production service before launch.

The Turnstile widget's Hostname Management must authorize the Pages project hostname and the stable branch alias used for acceptance testing. For PR #94 those are `pulpsense-funnels-preview.pages.dev` and `pr-94.pulpsense-funnels-preview.pages.dev`. A correct site key still fails client-side with Turnstile error `110200` when the current preview hostname is absent.

## Production gate

A push to `master` reruns verification and then enters the GitHub `Production` environment. Protect that environment with:

- `master` as its only deployment branch;
- the project owner as a required reviewer; and
- prevention of self-review when a second authorized reviewer is available.

The job cannot read its Cloudflare token or deploy until the environment is approved. Leave the Production environment variables and secret unset until the release qualification in #87 authorizes a production Pages project and destination credentials.

Once approved for launch, configure the same secret and public variables as Preview, plus:

| Kind     | Name                       | Purpose                                                    |
| -------- | -------------------------- | ---------------------------------------------------------- |
| Variable | `CLOUDFLARE_PAGES_BRANCH`  | Production branch configured on the selected Pages project |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | Production Pages project name                              |

Production can also be retried from **Actions → Cloudflare Pages → Run workflow** on `master` with `deploy_production` enabled. The protected environment approval still applies.

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
PUBLIC_META_PIXEL_ID=<sandbox-dataset> \
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
