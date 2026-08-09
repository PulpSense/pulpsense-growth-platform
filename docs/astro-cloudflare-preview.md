# Astro and Cloudflare Pages preview

`apps/funnels` now produces static Astro output in `dist/`. Cloudflare Pages serves that output and runs the request-time handlers under `functions/api/`.

## Local parity preview

```bash
pnpm --filter @pulpsense/funnels build
pnpm --filter @pulpsense/funnels start
pnpm --filter @pulpsense/funnels check-parity
```

The start and parity commands explicitly disable Wrangler's automatic `.env` loading. Copy `.dev.vars.example` to the ignored `.dev.vars` file only when sandbox runtime credentials are needed. With no local bindings, email verification fails open as unverified with `provider_error`, lifecycle delivery returns an accepted sandbox response, and browser Meta tracking is disabled. Set browser-facing `PUBLIC_*` values in the Astro build environment; `.dev.vars` supplies Pages Function runtime values, not the already-built client bundle.

## Rendering boundary

The page shell and outcome pages are static HTML. React hydration is limited to:

- the above-the-fold DSL carousel;
- the responsive hero loop, hydrated only for the visible desktop or mobile copy;
- the proof-video grids, hydrated when visible;
- the application flow, hydrated when visible, with Cal.com split into a later lazy chunk;
- interaction- or idle-delayed browser tracking;
- the mobile sticky CTA.

Hero and proof video sources are attached only when their active players approach the viewport. Cal.com is imported and mounted only after the server returns a signed booking identity for a qualified applicant with a verified business email. Browser Meta tracking is included only when a `PUBLIC_META_PIXEL_ID` is supplied at build time. Tracking attaches after the first visitor interaction or after the two-second idle fallback, ensuring a passive visit still emits `PageView`.

## Preview deployment

Pull requests targeting `master` are verified and deployed automatically by `.github/workflows/cloudflare-pages.yml`. The workflow uses the GitHub `Preview` environment, deploys branch `pr-<number>` to the dedicated non-production Pages project, and exposes the resulting Pages alias as a GitHub deployment.

The existing command remains a manual fallback for the issue #81 branch:

```bash
PUBLIC_META_PIXEL_ID=<preview-dataset-id> \
PUBLIC_POSTHOG_KEY=<project-key> \
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com \
PUBLIC_CAL_LINK=<preview-team/preview-event> \
PUBLIC_CAL_NAMESPACE=<preview-embed-namespace> \
pnpm --filter @pulpsense/funnels deploy:preview
```

`PUBLIC_META_PIXEL_ID`, `PUBLIC_POSTHOG_KEY`, and `PUBLIC_CAL_LINK` are mandatory in the GitHub preview deployment. The build requires a numeric Pixel ID and rejects the known production Meta dataset; the required Cal link prevents the preview from silently booking into the committed production destination. `PUBLIC_POSTHOG_HOST` defaults to the US ingestion host, and `PUBLIC_CAL_NAMESPACE` is optional when the preview event intentionally shares the default embed namespace.

The command targets project `pulpsense-funnels-preview` and branch `issue-81`. Do not attach a custom production domain or add production credentials to that project. Configure Pages Function secrets separately in the Pages preview environment; the public build values above are not secrets.

The issue #81 preview is available at:

- <https://issue-81.pulpsense-funnels-preview.pages.dev/creative-multiplier-sprint/>

The Pages project's production branch is `never-production`, so the `issue-81` deployment remains a Preview deployment. No custom domain or production credentials are attached.

See [`cloudflare-pages-delivery.md`](./cloudflare-pages-delivery.md) for GitHub environment configuration, fork behavior, the gated `master` path, manual recovery, and rollback.

## Rollback reference

The transitional Next.js route tree remains under `src/app/`. Use `dev:next`, `build:next`, and `start:next` only for rollback comparison until the final launch ticket removes it.
