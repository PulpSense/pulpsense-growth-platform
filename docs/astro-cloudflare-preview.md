# Astro and Cloudflare Pages preview

`apps/funnels` now produces static Astro output in `dist/`. Cloudflare Pages serves that output and runs the request-time handlers under `functions/api/`.

## Local parity preview

```bash
pnpm --filter @pulpsense/funnels build
pnpm --filter @pulpsense/funnels start
pnpm --filter @pulpsense/funnels check-parity
```

The start and parity commands explicitly disable Wrangler's automatic `.env` loading. Copy `.dev.vars.example` to the ignored `.dev.vars` file only when sandbox runtime credentials are needed. With no local bindings, email verification fails open as `skipped`, lifecycle delivery returns an accepted sandbox response, and browser Meta tracking is disabled. Set `PUBLIC_META_PIXEL_ID` in the Astro build environment only when a non-production browser dataset is available.

## Rendering boundary

The page shell and outcome pages are static HTML. React hydration is limited to:

- the above-the-fold DSL carousel;
- the responsive hero loop, hydrated only for the visible desktop or mobile copy;
- the proof-video grids, hydrated when visible;
- the application and Cal.com flow, hydrated when visible;
- interaction-delayed browser tracking;
- the mobile sticky CTA.

Hero and proof video sources are attached only when their active players approach the viewport. Cal.com is mounted only after a qualified application reaches the booking step. Browser Meta tracking is included only when a non-production `PUBLIC_META_PIXEL_ID` is supplied at build time, and third-party scripts are attached only after visitor interaction.

## Preview deployment

Build and deploy to the dedicated non-production Pages project and branch:

```bash
pnpm --filter @pulpsense/funnels deploy:preview
```

The command targets project `pulpsense-funnels-preview` and branch `issue-81`. Do not attach a custom production domain or add production credentials to that project. Configure runtime secrets separately in the Pages preview environment.

The issue #81 preview is available at:

- <https://issue-81.pulpsense-funnels-preview.pages.dev/creative-multiplier-sprint/>

The Pages project's production branch is `never-production`, so the `issue-81` deployment remains a Preview deployment. No custom domain or production credentials are attached.

## Rollback reference

The transitional Next.js route tree remains under `src/app/`. Use `dev:next`, `build:next`, and `start:next` only for rollback comparison until the final launch ticket removes it.
