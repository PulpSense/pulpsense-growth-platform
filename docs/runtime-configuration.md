# Runtime configuration inventory

This inventory records configuration names and ownership without secret values. Secret values belong in ignored local files or the environment settings of the relevant runtime.

## Funnel application

| Variable or setting                              | Secret | Current behavior                                                                                                        | Local development                                      | Preview                         | Production                          |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- | ----------------------------------- |
| `PUBLIC_PULPSENSE_ENVIRONMENT`                   | No     | Selects `local`, `preview`, or `production` build safeguards.                                                           | `local`                                                | `preview`                       | `production`                        |
| `PUBLIC_META_PIXEL_ID`                           | No     | Astro includes browser Pixel loading when present; preview builds require it and reject the known production dataset.   | Unset or sandbox dataset in the build environment      | Required preview-only dataset   | Production dataset in launch ticket |
| `PUBLIC_CAL_LINK`                                | No     | Selects the Cal.com event mounted after qualification; preview builds require an explicit value.                        | Optional override                                      | Required preview-only event     | Production event                    |
| `PUBLIC_CAL_NAMESPACE`                           | No     | Selects the Cal embed namespace independently from its event link.                                                      | Optional override                                      | Preview namespace when distinct | Production namespace                |
| `PUBLIC_TURNSTILE_SITE_KEY`                      | No     | Renders the browser Turnstile widget used for first contact submission.                                                 | Cloudflare test or local site key                      | Preview-only site key           | Production site key                 |
| `META_PIXEL_ID`                                  | No     | Meta dataset used by `/api/meta-capi`; the endpoint returns 500 when it or the access token is absent.                  | `apps/funnels/.dev.vars`                               | Funnel-host environment         | Funnel-host environment             |
| `META_CAPI_ACCESS_TOKEN`                         | Yes    | Authorizes Meta Conversions API delivery.                                                                               | `apps/funnels/.dev.vars`                               | Preview-only credential/dataset | Production credential               |
| `MILLION_VERIFIER_API_KEY`                       | Yes    | Enables server-side email verification; when absent, verification reports unverified `provider_error` and fails open.   | `apps/funnels/.dev.vars`                               | Preview credential              | Production credential               |
| `PULPSENSE_TRIGGER_SECRET_KEY`                   | Yes    | Authorizes lifecycle task triggers; when absent, `/api/form-submit` returns an accepted-but-skipped response.           | `apps/funnels/.dev.vars`                               | Trigger.dev preview/dev key     | Trigger.dev production key          |
| `PULPSENSE_TRIGGER_API_ORIGIN`                   | No     | Trigger.dev API origin; defaults to `https://api.trigger.dev`.                                                          | Optional override                                      | Optional override               | Optional override                   |
| `CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID`     | No     | Task ID for `contact_submitted`.                                                                                        | `funnels.contact-submitted` in `.dev.vars.example`     | Same ID in preview project      | Same ID in production project       |
| `CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID` | No     | Task ID for `application_submitted`.                                                                                    | `funnels.application-submitted` in `.dev.vars.example` | Same ID in preview project      | Same ID in production project       |
| `CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID`     | No     | Task ID for `booking_completed`.                                                                                        | `funnels.booking-completed` in `.dev.vars.example`     | Same ID in preview project      | Same ID in production project       |
| `ANALYZE`                                        | No     | Enables the Next.js bundle analyzer only when set to `true`.                                                            | Shell or local env when needed                         | Unset                           | Unset unless deliberately profiling |
| `NODE_ENV`                                       | No     | Used only by the transitional Next.js rollback reference.                                                               | Managed by `next dev`                                  | Unset                           | Unset                               |
| Next.js rollback Pixel ID                        | No     | Pixel `828948073514575` remains in the rollback component but is not used by Astro pages.                               | Rollback scripts only                                  | Not used                        | Not used                            |
| Default Cal.com event link                       | No     | `santileoni/growth-mapping-funnel`, namespace `growth-mapping-funnel`; used only when no explicit override is required. | Default for local/rollback comparison                  | Rejected without explicit link  | Default until launch configuration  |

`apps/funnels/.env.example` is the value-free legacy/host key list. Wrangler local preview intentionally ignores `.env` files; copy `apps/funnels/.dev.vars.example` to the ignored `.dev.vars` file and use sandbox values only. Do not commit either local secret file.

## Automation worker

| Variable or setting     | Secret | Current behavior                                                                            | Local development               | Preview/dev                                                 | Production                                     |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `TRIGGER_SECRET_KEY`    | Yes    | Authenticates the Trigger.dev CLI/SDK worker.                                               | Ignored `apps/automations/.env` | Trigger.dev dev key                                         | Trigger.dev production key/runtime environment |
| Trigger.dev project ref | No     | `proj_hynamgahugenjrtxzpcd` in `trigger.config.ts`; determines where tasks register/deploy. | Committed configuration         | Confirm the selected Trigger.dev environment before running | Confirm production project before deploy       |

`apps/automations/.env.example` is safe to commit. The ignored `apps/automations/.env` contains local values and must remain untracked.

## Environment isolation checks

- Preview and local environments must use Trigger.dev dev/preview keys and non-production downstream credentials.
- Preview Astro builds must set `PUBLIC_PULPSENSE_ENVIRONMENT=preview`, a non-production Meta dataset, and an explicit non-production Cal event.
- Browser tracking loads after the first interaction or a two-second idle fallback; verify passive `PageView` delivery against the preview dataset.
- Production secrets must not be exposed to browser code or variables prefixed for public bundling.
- Never copy values from ignored `.env` files into documentation, commits, logs, or issue comments.
- Before deploying, verify required keys in the hosting and Trigger.dev dashboards; repository presence proves names and defaults, not that remote values are configured.
