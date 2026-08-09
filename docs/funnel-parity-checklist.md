# Creative Multiplier Sprint parity baseline

This checklist captures the user-visible behavior of the transitional Next.js funnel at the monorepo checkpoint for issue #80. The Astro replacement must preserve these journeys unless a later ticket explicitly changes them.

## Reproduce the checkpoint

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @pulpsense/funnels lint
pnpm --filter @pulpsense/funnels check-types
pnpm --filter @pulpsense/funnels build
pnpm --filter @pulpsense/funnels check-parity
pnpm --filter @pulpsense/automations check-types
pnpm --filter @pulpsense/automations dev
```

The two applications have separate manifests and can be selected independently:

```bash
pnpm install --filter @pulpsense/funnels... --frozen-lockfile
pnpm --filter @pulpsense/funnels dev

pnpm install --filter @pulpsense/automations... --frozen-lockfile
pnpm --filter @pulpsense/automations dev
```

## Public routes

All public funnel pages inherit the root `robots` metadata, the global `X-Robots-Tag` response header, and the disallow-all `robots.txt` policy.

| Route                                      | Existing purpose                                                                         | Parity check                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/creative-multiplier-sprint/`             | Lander, proof, offer details, fit guidance, application form, and qualified booking step | Page renders the current copy, media, section order, responsive layout, sticky mobile CTA, form, and footer.                     |
| `/creative-multiplier-sprint/thank-you/`   | Qualified, successfully booked outcome                                                   | Shows “Call confirmed,” pre-call instructions, proof videos, and the legal footer.                                               |
| `/creative-multiplier-sprint/unqualified/` | Completed but unqualified application outcome                                            | Shows “Application received,” explains the current fit threshold, and invites a later reapplication. No booking widget is shown. |

For every route above, confirm:

- the HTML contains `noindex, nofollow` robots metadata;
- the response contains `X-Robots-Tag: noindex, nofollow, noarchive, noimageindex`;
- `/robots.txt` returns `User-agent: *` and `Disallow: /`;
- the route keeps its trailing-slash behavior.

## Lander and responsive behavior

- The desktop headline is “Turn one winning ad into 10 avatar videos in 2 business days.” The small-screen headline is “10 avatar videos from one winning ad.”
- Primary CTAs scroll to `#apply`; the secondary proof flow scrolls to `#proof`.
- The hero output mockup is desktop-only, while the primary hero CTA is hidden on the smallest breakpoint and the sticky CTA supplies the mobile action.
- The proof gallery retains 12 vertical examples and their current posters/videos.
- The carousel, proof video controls, comparison, deliverables, fit guidance, testimonials, FAQ, application panel, disclaimer, and legal links retain their current content and order.
- The application panel remains responsive inside its fixed page region. The embedded Cal.com booking view currently manages its own scroll area.

## Application journey

### Step 1 — contact

- Required fields are first name, last name, business email, and phone.
- Personal/free email domains fail client-side validation. On blur, an otherwise eligible email is checked through `/api/verify-email`.
- MillionVerifier `ok` and `catch_all` results pass. Known invalid results fail. A missing API key or provider/network failure currently fails open.
- Phone input uses a searchable country picker, country-specific length validation, and submits the country code with the formatted number.
- Advancing sends `contact_submitted` to `/api/form-submit` and emits Meta `Lead` once per mounted form.

### Step 2 — qualification

- Required fields are brand URL, monthly paid-social spend, winning-ad status, one or more target platforms, and delivery timeline.
- The brand URL is normalized to `https://...` in the submitted form state.
- A submission is unqualified when either:
  - monthly paid-social spend is `Less than $20k/month`; or
  - winning-ad status is `No proven winner yet`.
- Advancing sends `application_submitted` with `qualified` and `qualificationStatus`, then emits Meta `SubmitApplication` once per mounted form.
- An unqualified applicant is redirected immediately to `/creative-multiplier-sprint/unqualified` and never sees the booking step.
- A qualified applicant advances to the Cal.com step.

### Step 3 — qualified booking

- The embedded event is `santileoni/growth-mapping-funnel`, namespaced `growth-mapping-funnel`, using the dark month view.
- Contact and qualification answers prefill the booking widget where Cal.com accepts them.
- A `bookingSuccessful` event sends `booking_completed` with booking UID/date/title and the captured form data.
- A qualified booking emits Meta `Schedule` once and redirects to `/creative-multiplier-sprint/thank-you`.
- The Back control returns to qualification without clearing the mounted form state.

## Attribution and tracking behavior

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` are captured from the initial URL and appended to lifecycle payloads.
- Meta Pixel `828948073514575` loads after the first interaction or a two-second idle fallback and emits `PageView` on the lander.
- Browser Pixel and `/api/meta-capi` use the same generated event ID for `Lead`, `SubmitApplication`, and `Schedule` deduplication.
- Meta CAPI hashes email and phone, includes request IP/user agent plus `_fbc`/`_fbp` when available, and forwards custom event data.
- As of this checkpoint, `SubmitApplication` custom data includes `qualification_status`, `paid_social_spend`, and `winner_status`. This is a parity fact, not an endorsement of the later target design.
- `/api/form-submit` accepts only `contact_submitted`, `application_submitted`, and `booking_completed`, selects the task ID by funnel ID and event, and forwards the current payload shape to Trigger.dev.
- Form lifecycle delivery and Meta CAPI delivery are currently best-effort in the browser. A failed request does not block the visitor's next step or redirect.

## Manual parity sign-off

`pnpm check-parity` is the executable HTTP baseline. It starts the production build and asserts each public page's status, crawler controls, and stable journey copy markers, plus the disallow-all `robots.txt`. Visual and browser-only interactions remain manual checks.

- [ ] Lander matches the checkpoint at desktop and mobile widths.
- [ ] Contact validation and email-verification states match.
- [ ] Qualified answers reach the Cal.com booking step.
- [ ] Unqualified spend redirects to the unqualified page.
- [ ] Missing winning-ad proof redirects to the unqualified page.
- [ ] Successful booking reaches the qualified thank-you page.
- [ ] Lifecycle payloads retain form fields, country-coded phone, timestamps, funnel ID, and captured UTM values.
- [ ] PageView, Lead, SubmitApplication, and Schedule fire at the same journey points and preserve shared Pixel/CAPI event IDs.
- [ ] All three public pages and `robots.txt` retain crawler blocking.
- [ ] No copy, qualification rule, redirect, booking link, media, or responsive interaction changed during the monorepo move.

## Checkpoint verification — 2026-08-08

- `pnpm install --frozen-lockfile`: passed for all workspace projects with pnpm 11.20.0.
- Funnel lint, TypeScript, and Next.js production build: passed.
- Executable production HTTP parity check: passed for all three public pages and `robots.txt`.
- Automation TypeScript: passed.
- Production response checks: all three public funnel routes returned 200 with the expected robots metadata and `X-Robots-Tag`; `/robots.txt` returned the disallow-all policy.
- Trigger.dev local worker: registered `health-check` in version `20260808.1` on the `default` dev branch.
- Harmless run `run_06fu42eqjmsg2p255dnedj4t01`: completed successfully in 5 ms with `ok: true` and message `Issue #80 checkpoint`.

## Astro preview verification — 2026-08-08

- Cloudflare Pages Preview: <https://issue-81.pulpsense-funnels-preview.pages.dev/creative-multiplier-sprint/>
- Dedicated project: `pulpsense-funnels-preview`; production branch: `never-production`; deployed branch: `issue-81`.
- The desktop and mobile lander matched the Next.js checkpoint in browser comparison.
- Carousel controls, contact validation, qualified Cal.com progression, and unqualified redirects passed in-browser checks.
- Proof video sources remained detached above the fold and attached near `#proof`; Cal.com stayed unmounted until the qualified booking step.
- Browser console checks returned no errors or warnings.
- The executable parity check passed against the public preview for all three routes, six narrow React island exports, three sandbox API fallbacks, and `robots.txt`.
- The preview response includes `X-Robots-Tag: noindex, nofollow, noarchive, noimageindex`; each page includes noindex metadata; `robots.txt` disallows all crawling.
- The historical deployment had no production Pixel ID or runtime credentials. Current preview builds instead require an explicit non-production `PUBLIC_META_PIXEL_ID` and `PUBLIC_CAL_LINK`, reject the known production Pixel ID, and exercise passive `PageView` loading through the idle fallback.
