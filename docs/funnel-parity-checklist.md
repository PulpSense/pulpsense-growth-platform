# Funnel parity and architecture checklist

This checklist protects the shared funnel platform while individual funnel copy,
media, and section order evolve. AI SEO is the current visual reference for new
funnels.

## Public routes

| Route                | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `/ai-seo/`           | AI SEO lander, qualification, contact, booking |
| `/ai-seo/thank-you/` | Post-booking instructions and proof            |

For every public funnel route, confirm:

- HTML includes `noindex, nofollow` metadata;
- responses include `X-Robots-Tag: noindex, nofollow, noarchive, noimageindex`;
- `/robots.txt` disallows every crawler;
- canonical routes retain trailing slashes;
- static copy, media, responsive layout, and CTA placement match the approved
  reference.

## Source structure

- `src/pages/[funnel]/` contains only thin Astro route entrypoints.
- Funnel-specific visual documents and islands live in `src/funnels/[funnel]/`.
- Shared form, booking, tracking, and presentation primitives live in
  `src/components/` or `src/funnels/` at the narrowest reusable seam.
- New funnels use the AI SEO visual language without copying provider or account
  identifiers into browser code.

## Contact and qualification

- Required fields are first name, business email, and phone; last name is
  optional.
- Email is checked client-side, synchronously verified by `/api/verify-email`,
  and verified again by the funnel-host submission boundary.
- Phone input uses the shared country rules, formatting, and digit validation.
- Turnstile, same-origin checks, and Cloudflare rate limiting remain enabled.
- The browser submits to `/api/funnel-events`; it never calls CRM or automation
  provider webhooks directly.
- Qualification is computed and signed by the funnel host before booking is
  exposed.

## Lifecycle delivery

- Accepted lifecycle events are durably enqueued to `process-funnel-event` with
  their event ID as the idempotency key.
- Trigger.dev owns Twenty upserts, opportunity/activity delivery, Meta CAPI,
  PostHog lifecycle events, retries, and failure alerts.
- Browser Meta events reuse server event IDs for deduplication and contain no
  raw form answers in custom data.
- Browser PostHog events use the shared environment-configured project and the
  privacy allowlist.

## Booking

- Cal is loaded only after the funnel host returns an encrypted booking identity.
- The configured Cal link and namespace come from `PUBLIC_CAL_LINK` and
  `PUBLIC_CAL_NAMESPACE`; preview must never fall back to production.
- A browser `bookingSuccessful` event may navigate to the thank-you page for
  immediate UX only.
- Only a signed `BOOKING_CREATED` webhook with matching attendee and booking
  identity may create `booking_completed`, advance Twenty, or emit Meta
  `Schedule` and PostHog booking lifecycle events.

## Release verification

Run:

```bash
pnpm build
pnpm check-types
pnpm lint
pnpm --filter @pulpsense/funnels check-parity
```

Verify the immutable preview with sandbox PostHog, Meta, Cal, Turnstile,
MillionVerifier, Trigger.dev, and Twenty destinations before production cutover.
