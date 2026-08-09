# PulpSense Funnels

The Creative Multiplier Sprint is rendered as a static Astro site for Cloudflare Pages. Existing React components provide narrowly scoped carousel, form, video, tracking, and sticky-CTA islands; the transitional Next.js route tree remains as a rollback reference.

## Tech stack

- Astro 7 static output
- Cloudflare Pages and Pages Functions
- React 19 islands
- Tailwind CSS 4
- TypeScript and pnpm

## Local development

From the monorepo root:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:4321/creative-multiplier-sprint/>.

## Scripts

| Command               | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`            | Start Astro development                                                         |
| `pnpm build`          | Produce static output in `dist/`                                                |
| `pnpm start`          | Serve `dist/` with Pages Functions through Wrangler                             |
| `pnpm check-parity`   | Check routes, crawler controls, API fallbacks, and trailing slashes             |
| `pnpm check-types`    | Check Astro and TypeScript                                                      |
| `pnpm lint`           | Lint source and function files                                                  |
| `pnpm deploy:preview` | Manually deploy the `issue-81` fallback preview; PR previews use GitHub Actions |
| `pnpm dev:next`       | Start the transitional Next.js rollback reference                               |
| `pnpm build:next`     | Build the transitional Next.js rollback reference                               |

## Project structure

```text
functions/api/              # Cloudflare Pages request handlers
public/                     # Assets, robots.txt, _headers, and _redirects
src/
├── pages/                  # Active Astro routes
├── layouts/                # Static HTML shell and crawler metadata
├── server/                 # Runtime-neutral API behavior shared with rollback routes
├── app/                    # Funnel content/components plus Next.js rollback routes
└── components/             # Shared React primitives and explicit islands
```

## Runtime isolation

Wrangler local preview does not load `.env.local`. Use an ignored `.dev.vars` copied from `.dev.vars.example`, with sandbox values only. Local builds may omit browser Meta tracking. Preview builds require a non-production `PUBLIC_META_PIXEL_ID` and a non-production `PUBLIC_CAL_LINK`; the build fails if either is absent or if the known production Meta dataset is supplied.

Browser-facing `PUBLIC_*` values must be present in the Astro build environment. Pages Function secrets belong in the Cloudflare preview environment instead. `PUBLIC_CAL_NAMESPACE` may be set when the sandbox event uses a distinct embed namespace.

Form lifecycle events are accepted through `/api/form-submit` and forwarded by the Pages Function only when a Trigger.dev preview secret and matching task ID are configured. Email verification and Meta CAPI use the same Pages Function boundary.

Contact and email-verification requests call the private `FUNNEL_RATE_LIMIT_SERVICE` binding with a hashed IP key. The bound Worker owns Cloudflare's native Rate Limiting binding and has no public `workers.dev` route. `pnpm start` launches both configurations locally. This repository currently targets the isolated preview Pages project and preview rate-limiter service; production must receive a separate configuration during #87.

See [`../../docs/astro-cloudflare-preview.md`](../../docs/astro-cloudflare-preview.md) for deployment and rollback details.

## License

ISC
