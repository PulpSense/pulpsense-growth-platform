# PulpSense Funnels

The AI SEO funnel is rendered as a static Astro site for Cloudflare Pages. Astro owns the visual document and React islands provide narrowly scoped form, booking, and tracking behavior. Cloudflare deployment history is the application rollback mechanism.

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

Open the lawyer campaign at
<http://localhost:4321/visibility-audit/law-firms/> or the dentist campaign at
<http://localhost:4321/visibility-audit/dental-practices/>.

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

## Project structure

```text
functions/                  # Thin Cloudflare Pages request adapters
├── api/                    # Funnel APIs and authenticated webhooks
└── e/                      # First-party PostHog proxy
public/                     # Assets, robots.txt, _headers, and _redirects
src/
├── pages/                  # Active Astro routes
├── layouts/                # Static HTML shell and crawler metadata
├── server/                 # Runtime-neutral Pages Function behavior
├── funnels/                # Funnel-owned content, sections, and styles
├── lib/funnel/             # Shared funnel runtime and submission machinery
├── styles/                 # Global application styles
└── components/             # Shared React primitives and explicit islands
```

Each funnel owns its sections and page styles while the route remains the
composition shell:

```text
src/funnels/ai-seo/
├── components/
│   ├── landing/            # Landing-page sections and interactions
│   └── thank-you/          # Confirmation-page sections and interactions
└── styles/                 # Route-specific funnel stylesheets
```

Lead magnets remain internal domain objects in `packages/lead-magnets`. Their
public pages use `/resources/{slug}`; never expose `/lead-magnets/` in new URLs.

Cloudflare files under `functions/` are thin adapters. Server handlers keep
the `(request, env) => response` interface, while endpoint internals live behind
that seam. The funnel-event handler delegates contact and application flows to
`src/server/funnel-events/`, which also owns signed identities, request context,
and durable Trigger.dev delivery.

## Runtime isolation

Wrangler local preview does not load `.env.local`. Use an ignored `.dev.vars` copied from `.dev.vars.example`, with sandbox values only. Local and deployed preview builds omit browser Meta tracking; the live Pixel IDs are supplied only to production builds. Both AI SEO campaigns are generated in the same build: their opaque routes select separate funnel identities without a deployment-wide vertical switch. Preview builds still require a non-production `PUBLIC_CAL_LINK`.

Browser-facing `PUBLIC_*` values must be present in the Astro build environment. Pages Function secrets belong in the Cloudflare preview environment instead. `PUBLIC_CAL_NAMESPACE` may be set when the sandbox event uses a distinct embed namespace.

Set `PUBLIC_POSTHOG_KEY` to enable privacy-allowlisted CRO events. Deployed builds set `PUBLIC_POSTHOG_HOST=/e`, whose Pages Function forwards SDK assets, remote configuration, events, and replay chunks to the US PostHog project without exposing PostHog's ingestion domains to the browser. Ingestion waits for the visitor's first interaction and never includes contact values or raw application answers.

Contact and application lifecycle events are accepted through `/api/funnel-events`. Email verification remains synchronous at `/api/verify-email`. Cal booking completion is accepted only at the signed `/api/webhooks/cal` boundary; the browser callback redirects to confirmation but cannot advance Twenty or emit Meta `Schedule`.

The Cal embed is loaded as a separate lazy chunk only after the server returns a signed booking identity for a qualified applicant with a verified business email. Set `CAL_BOOKING_LINK` to the same dedicated paid-ad event as `PUBLIC_CAL_LINK`; the server uses it to create the prefilled Brevo booking URL without trusting a browser-supplied destination. Wistia players load paused and proof videos attach sources only near their viewport. Configure Cal's signed `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, and `BOOKING_CANCELLED` webhook triggers with `CAL_WEBHOOK_SECRET` and point them at `/api/webhooks/cal`.

Contact and email-verification requests call the private `FUNNEL_RATE_LIMIT_SERVICE` binding with a hashed IP key. The bound Worker owns Cloudflare's native Rate Limiting binding and has no public `workers.dev` route. `pnpm start` launches both configurations locally. Preview and production use separate Pages projects and private rate-limiter Workers.

See [`../../docs/astro-cloudflare-preview.md`](../../docs/astro-cloudflare-preview.md) for preview details and [`../../docs/release-runbook.md`](../../docs/release-runbook.md) for production deployment and rollback.

## License

ISC
