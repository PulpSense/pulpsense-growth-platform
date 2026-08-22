# Issue 202 production rollout evidence

Date: 2026-08-22

## Preflight

- Source: `origin/master` at `bb609fe16d0f2c81955fb81c10e7bc499637a76f`,
  containing the completed #196 implementation and merged #228/#229 changes.
- Trigger.dev production worker: `20260822.23`, SDK `4.5.9`.
- Schedule: `*/5 * * * *`, schedule ID `sched_birvqvqshf1s31t2xipx2`.
- Production mode before rollout: `reconcile`; canary-only: `true`.
- Retained completed-canary allowlist: `qD2mEJtjymvcvHy91svNB6`.
- OAuth, designated calendar, Cal, Twenty, and Slack configuration names were
  present. Secret values were not recorded.
- Slack reliability destination: `C09FTA0TEEN`; no unexpected recent
  reconciliation alert or failed Trigger run was present before mutation.

## Historical mapping audit

Six canonical Sales Appointments were inspected against their Twenty booking
Notes, BookingVersions, exact Cal booking UIDs, and direct Google event
mappings.

| Classification                                            | Count |
| --------------------------------------------------------- | ----: |
| Production-commercial mappings audited                    |     4 |
| Already mapped                                            |     4 |
| Newly mapped                                              |     0 |
| Intentionally ineligible non-production test appointments |     2 |
| Unresolved                                                |     0 |

The ignored input is
`apps/automations/.env.issue-202-sales-appointment-mapping.json`; it is excluded
by the repository's `.env.*` rule and is not committed.

Retained reports:

- `docs/evidence/issue-202-mapping-dry-run.json`: four ready, zero ambiguous.
- `docs/evidence/issue-202-mapping-apply.json`: four approved rows, zero
  ambiguous; the deterministic records already existed.
- `docs/evidence/issue-202-mapping-read-back.json`: four of four matched with
  zero differences.

### Explained historical difference

Sales Appointment `3e4be473-c294-5193-9426-3c92a0b33595` (Farhad Rejali) had a
canonical Monday Cal booking and a Thursday Google move. The operator confirmed
that the meeting was manually dragged in Google before automatic rescheduling
was fully supported and that the meeting occurred Thursday. The appointment
was repaired from `SCHEDULED` to terminal `COMPLETED`; its exact Cal UID,
BookingVersion, Google event ID, and generation were preserved. This row no
longer enters general reconciliation and no past Cal mutation was attempted.

## Runbook changes

`docs/google-calendar-reconciliation.md` now covers single-user OAuth scope and
rotation, designated-calendar verification, ignored mapping inputs and report
refusal conditions, all rollout modes, exact-UID/internal-attendee canary
assertions, Slack interpretation and recovery, manual repair guardrails,
cross-provider verification, terminal cancellation and eligible NO_SHOW
semantics, monitoring, and rollback. `docs/runtime-configuration.md` records
the post-canary control expectations and `off` rollback.

## Enablement and observation

The rollout changed only the approved production controls:

- exercised rollback with `GOOGLE_CALENDAR_RECONCILIATION_MODE=off`, verified
  the management operation succeeded, and restored `reconcile` before the next
  scheduled cycle;
- deleted `GOOGLE_CALENDAR_RECONCILIATION_SIMULATED_CAL_FAILURE_UID` rather
  than retaining an inert value;
- set `GOOGLE_CALENDAR_RECONCILIATION_CANARY_ONLY=false`;
- retained the exact UID allowlist `qD2mEJtjymvcvHy91svNB6`; and
- left credentials, the worker version, schedule, calendar, and all other
  infrastructure unchanged.

The post-enable observation ran from 12:02 UTC through 12:12 UTC (more than ten
minutes) and covered two consecutive five-minute schedule timestamps:

| Schedule timestamp | Poll run                         | Selected | Child runs | Result                    |
| ------------------ | -------------------------------- | -------: | ---------: | ------------------------- |
| 12:05 UTC          | `run_06g2in5l3ofbmc3dg0lbukco01` |        4 |          4 | All completed `unchanged` |
| 12:10 UTC          | `run_06g2io9etu44deor18jgfiho01` |        4 |          4 | All completed `unchanged` |

Every dispatched child was inspected:

- first cycle: `run_06g2in7qok0qpt8f779pc7g701`,
  `run_06g2in7qeqs8ulmnka6erosv01`,
  `run_06g2in7q4fvfegbrqdoim9il01`, and
  `run_06g2in7prt261vil3dspl45k01`;
- second cycle: `run_06g2ioceatdn6hh2rgtj02ig01`,
  `run_06g2ioce35djt004feplvcmc01`,
  `run_06g2iocdpoqagp4th1elftrf01`, and
  `run_06g2iocddhua0g5kln9qapuh01`.

The revision fingerprints were identical across both cycles. These child
results establish live Twenty and mapped-Google-event agreement, including
stable lineage and automation generation. They do not establish a direct Cal
read-back or search Google for additional active events because the
`unchanged` path returns before its Cal preflight. The direct final Twenty
read-back showed the three commercial scheduled rows and the internal canary
`SYNCHRONIZED`, Farhad terminal `COMPLETED` with his preserved UID/generation,
and the cancelled non-production row still `MAPPING_PENDING` and ineligible.
The poll selected four rather than five, confirming that the completed
historical row stayed out of reconciliation.

No stale automation, missing mapping, failed Trigger run, or Slack noise was
observed during the original window. Searches of reliability channel
`C09FTA0TEEN` after enablement returned no calendar, reconciliation, or
appointment alert. The original sign-off did not directly verify Cal or the
absence of duplicate Google events; the corrective audit below supersedes that
part of the sign-off.

## Corrective provider audit after review

On 2026-08-22, a read-only follow-up directly opened all four eligible Cal
booking UIDs and searched the designated Google Calendar by each exact
UID/reschedule link. The retained machine-readable report is
`docs/evidence/issue-202-corrective-provider-audit.json`.

Cal directly returned the expected canonical booking and time for all four
UIDs. Google returned one active entry for the internal canary, Jamie, and
Taunya. Len UID `fwZSmkGJWyp6F8oXRyv5YX` returned three active entries carrying
the same reschedule link: the canonical August 19 event, an August 20 event
with the same appointment title, and an August 21 event retitled as onboarding.
The latter two still retained the original appointment description and Cal
link. No event was deleted or edited.

With no explanation yet available, this initially failed the duplicate-event
safety invariant and invalidated the original claim that provider verification
was complete. Production reconciliation was immediately rolled back to
`GOOGLE_CALENDAR_RECONCILIATION_MODE=off`, and issue #202 was reopened.
Scheduled poll `run_06g2iu1dk9qoq3ic4si73as201` then read back mode `off`,
selected zero appointments, and dispatched no children.

### Operator classification

The operator subsequently confirmed that the August 20 entry was an
intentional next-day follow-up with the original booker and the August 21 entry
was that same booker's onboarding meeting. Their Cal UID/link matched only
because Google duplicated the original event description. They are distinct
meetings, not duplicate active appointment events; exactly one Google event
remains the canonical mapped Sales Appointment. No provider event needed to be
deleted or edited, and the exact mapping, Cal booking, and Google event ID
remained unchanged.

The copied link remains stale metadata: it still points at the original Cal
booking. Future manually duplicated follow-up/onboarding events should remove
the original reschedule/cancel link after the title and time are changed. The
operator classification resolves the rollout invariant; controlled re-enable
still requires a fresh direct Cal/Google/Twenty read-back and observation.

### Controlled re-enable after classification

After direct Twenty read-back confirmed all four canonical appointments still
`SYNCHRONIZED` with unchanged UIDs and generations, production mode was
restored to `reconcile` at 12:47:13 UTC. The canary-only state, exact canary
allowlist, credentials, schedule, and provider records were not changed.

The post-restore observation ran through 12:57:16 UTC and covered two
consecutive scheduled cycles:

| Schedule timestamp | Poll run                         | Selected | Child runs | Result                    |
| ------------------ | -------------------------------- | -------: | ---------: | ------------------------- |
| 12:50 UTC          | `run_06g2j1fd2l3r3lutikq4k49001` |        4 |          4 | All completed `unchanged` |
| 12:55 UTC          | `run_06g2j2j2e8jvupv7l8498fci01` |        4 |          4 | All completed `unchanged` |

Every dispatched child was inspected:

- first cycle: `run_06g2j1hco076ggefosakq63j01`,
  `run_06g2j1hchckklgkhamdjdagl01`,
  `run_06g2j1hc9nn67a9l2mhcngtf01`, and
  `run_06g2j1hbtaisk7b49703qtui01`;
- second cycle: `run_06g2j2m0cvthfuofso1o6uu601`,
  `run_06g2j2m05nob7rfo0u23hnue01`,
  `run_06g2j2lvsl5p63siuh7urnfv01`, and
  `run_06g2j2lvfrv1lqo54enfh2qf01`.

The mapped Google revision fingerprints were identical across both cycles and
matched the pre-rollback values. Final Twenty read-back again showed all four
canonical rows `SYNCHRONIZED` with unchanged lineage/generation. The direct Cal
and exact-UID Google inspection remained the corrective audit recorded above;
no provider event changed during the rollback or re-enable. Slack channel
`C09FTA0TEEN` contained no calendar, reconciliation, or appointment alert during
the observation window.

## Validation

- `pnpm lint`
- `pnpm check-types` (zero errors; existing deprecation hints only)
- `pnpm --filter @pulpsense/automations exec vitest run scripts/backfill-sales-appointments.test.ts`
  (7 tests passed)
- `git diff --check`
