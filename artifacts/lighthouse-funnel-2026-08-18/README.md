# Paid funnel mobile Lighthouse evidence

Local production-build measurements captured on 2026-08-18 with Lighthouse
13.4.1, simulated mobile throttling, a 390 × 844 viewport, and device scale
factor 3.

| Vertical         | Performance |    FCP |    LCP | Speed Index |  TBT | CLS | Initial deck images |
| ---------------- | ----------: | -----: | -----: | ----------: | ---: | --: | ------------------: |
| Law firms        |          95 | 1.33 s | 2.93 s |      1.33 s | 0 ms |   0 |                   2 |
| Dental practices |          95 | 1.31 s | 2.85 s |      1.31 s | 0 ms |   0 |                   2 |

The first slide was the LCP element in both runs. Lighthouse confirmed that it
was discoverable in the initial document, eagerly loaded, and assigned
`fetchpriority="high"`. Its measured element-render-delay subpart was 292 ms
for law firms, down from the 1.12 s baseline cited in issue #184.

These local single runs did not meet the strict 2.5 s release LCP budget. The
remaining measured LCP blocker is the first slide's render delay after its
request completes; resource discovery and priority checks now pass. Run the
three-sample release check against the deployed HTTPS preview before release,
because the release budget intentionally requires the median live result.

## Responsive-image follow-up

After adding responsive deck sources, deferring the second slide and Turnstile,
and adding compact logo sources, the same local Lighthouse configuration
produced:

| Vertical         | Performance |    FCP |    LCP | Speed Index |  TBT | CLS | Initial deck images | Turnstile requests | Transfer |
| ---------------- | ----------: | -----: | -----: | ----------: | ---: | --: | ------------------: | -----------------: | -------: |
| Law firms        |          98 | 1.31 s | 2.25 s |      1.31 s | 0 ms |   0 |                   2 |                  0 |   210 KB |
| Dental practices |          98 | 1.31 s | 2.25 s |      1.31 s | 0 ms |   0 |                   2 |                  0 |   210 KB |

Both follow-up runs pass the strict 2.5 s LCP budget and retain CLS 0. Law
firms' measured LCP element-render delay fell again, from 292 ms to 86 ms.
Initial transfer fell from approximately 311 KB to 210 KB. The retained
`*-responsive-local.report.json` and `*-responsive-local.report.html` files
contain the follow-up evidence.

## Analytics dependency review

The landing page already defers the `FunnelAnalytics` React island until idle
interaction work, and `configureFunnelAnalytics` dynamically imports
`posthog-js` only when production analytics is configured. Calls made before
that import finishes are timestamped and held in the module's bounded event
queue, then flushed through the shared client after initialization. Pending
prospect identification is likewise retained and applied once the client is
ready. No additional analytics deferral was necessary for this change.

`apps/funnels/src/utils/funnelAnalytics.test.ts` verifies asynchronous PostHog
loading and queued-event delivery, production initialization, disabled
environments, sanitization, identification, and identity handling. The full
test suite passed after changing the carousel hydration timing.
