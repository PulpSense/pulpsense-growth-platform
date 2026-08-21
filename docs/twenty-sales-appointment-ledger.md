# Twenty Sales Appointment ledger

Twenty must expose the following custom objects before the lifecycle processor or Meta Ads daily brief is deployed. API names are part of the automation contract.

## `salesAppointment` / `salesAppointments`

| API field                  | Type                       | Constraint                                       |
| -------------------------- | -------------------------- | ------------------------------------------------ |
| `name`                     | text                       | required                                         |
| `rootCalBookingUid`        | text                       | required, unique                                 |
| `currentCalBookingUid`     | text                       | required                                         |
| `initialConfirmedAt`       | date-time                  | required, indexed                                |
| `scheduledStartAt`         | date-time                  | required                                         |
| `scheduledEndAt`           | date-time                  | required                                         |
| `originatingLeadJourneyId` | text                       | required, indexed                                |
| `funnelId`                 | text                       | required                                         |
| `environment`              | select                     | `local`, `preview`, `production`                 |
| `classification`           | select                     | `PRODUCTION_COMMERCIAL`, `NON_PRODUCTION`        |
| `isCommercial`             | boolean                    | required                                         |
| `isTest`                   | boolean                    | required                                         |
| `status`                   | select                     | `SCHEDULED`, `NO_SHOW`, `COMPLETED`, `CANCELLED` |
| `prospectId`               | text                       | optional, indexed                                |
| `person`                   | relation to Person         | required                                         |
| `opportunity`              | relation to Opportunity    | required                                         |
| `currentBookingVersion`    | relation to BookingVersion | required after initial projection                |

`rootCalBookingUid` and `initialConfirmedAt` are immutable. Reporting counts distinct records classified as production-commercial by `initialConfirmedAt`; status changes never remove the original conversion.

## `bookingVersion` / `bookingVersions`

| API field                   | Type                          | Constraint                          |
| --------------------------- | ----------------------------- | ----------------------------------- |
| `name`                      | text                          | required                            |
| `calBookingUid`             | text                          | required, unique                    |
| `salesAppointment`          | relation to Sales Appointment | required, indexed                   |
| `scheduledStartAt`          | date-time                     | required                            |
| `scheduledEndAt`            | date-time                     | required                            |
| `lifecycleOccurredAt`       | date-time                     | required                            |
| `state`                     | select                        | `ACTIVE`, `SUPERSEDED`, `CANCELLED` |
| `previousBookingVersion`    | self relation                 | optional                            |
| `replacementBookingVersion` | self relation                 | optional                            |

The automation writes relation IDs using Twenty's generated `<relationName>Id` fields. Custom-object permissions must allow the Trigger.dev API key to read and write both objects; the reporting key needs read-only access to Sales Appointments.

## Historical backfill

Prepare a locally ignored JSON array containing explicit, evidence-backed mappings. Every row must include `calBookingUid`, `title`, `initialConfirmedAt`, `scheduledStartAt`, `scheduledEndAt`, `originatingLeadJourneyId`, `funnelId`, `environment`, `personId`, `opportunityId`, `sourceNoteId`, `status`, `isCommercial`, and `isTest`; `prospectId` is optional.

Run the dry-run first:

```bash
pnpm --filter @pulpsense/automations backfill:sales-appointments ./ignored-mapping.json
```

The dry-run performs no writes and reports duplicate or ambiguous rows. Only an ambiguity-free approved mapping may be applied, followed by read-back:

```bash
pnpm --filter @pulpsense/automations backfill:sales-appointments ./ignored-mapping.json --apply
pnpm --filter @pulpsense/automations backfill:sales-appointments ./ignored-mapping.json --read-back
```

Do not infer missing Cal UIDs, status, commercial classification, or historical reschedule lineage. Leave those rows unresolved for manual investigation.
