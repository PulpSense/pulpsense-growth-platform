# Issue 161 production evidence

Recorded on 2026-08-16 for [issue 161](https://github.com/PulpSense/pulpsense-growth-platform/issues/161). This record intentionally excludes lead data and secret values.

## Release identity

- Growth implementation: merge commit `96e9cfa26fbb8857fbdb4292028e21ede209090d` from PR 170.
- Twenty schema: merge commit `4bcd0a544cb2e3da4ffdac879322381d2632e608` from PR 38.
- Cloudflare production workflow: run `31946187325`; verification and production deployment succeeded.
- Trigger.dev production version: `20260816.3`; deployment `4qx5hifd` succeeded with eight tasks.
- Twenty webhook: active for Opportunity update events at `/api/webhooks/twenty`.

## Historical reference migration

The approved four-record dry run reported `mutations: false`. After approval, all four Person/Opportunity pairs were applied and the migration command's read-back reported `prospectMatches: true` and `journeyMatches: true` for every pair.

A fifth qualifying record created after the agreed migration set was discovered before cutover. The owner approved backfilling all records. Its Person and Opportunity writes both returned HTTP 200, and a separate read-back reported both references matched. Final verified totals were five People, five Opportunities, and ten matching reference comparisons.

## Validation

- Pull-request verification passed tests, type checking, lint, formatting, and the Astro build.
- The production workflow re-ran the same verification before deployment.
- An unsigned request to the live Twenty webhook boundary was rejected with HTTP 401 before enqueue.
