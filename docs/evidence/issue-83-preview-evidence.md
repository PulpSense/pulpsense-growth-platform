# Issue 83 preview evidence

Date: 2026-08-09

## Environment

- Funnel: dedicated non-production Cloudflare project at `https://pulpsense-funnels-preview.pages.dev/creative-multiplier-sprint/`
- Atomic deployment: `https://7b6c45e3.pulpsense-funnels-preview.pages.dev`
- Trigger.dev: Development workers because preview branches are not enabled for the project (`20260809.1` for unqualified and `20260809.2` for qualified)
- Twenty: live workspace with uniquely named QA records and exact-ID cleanup
- Meta: existing dataset through Conversions API; the automation required an `events_received: 1` acknowledgement

## Unqualified journey

Answers:

- Spend: `Less than $20k/month`
- Winner: `Yes, one clear winner`
- Platforms: `Meta`
- Timeline: `Next 2 weeks`

Observed results:

- Browser navigated to `/creative-multiplier-sprint/unqualified/`.
- Contact Trigger run `run_06fucia63g5c6tqdg9a3ig3201` succeeded.
- Application Trigger run `run_06fucii2cf9pe0k90osa6f6v01` succeeded.
- Twenty Person `86bbd8b8-a446-4f2b-abca-792a631595c6` was created and linked to the existing PulpSense Company.
- Twenty Note and NoteTarget `9b504285-6bb8-4d76-9054-dc7f99bc35e2` contain the complete application answers and `Qualification: unqualified`.
- No Opportunity was related to the Person.
- Meta event ID `application_submitted:9b504285-6bb8-4d76-9054-dc7f99bc35e2` was acknowledged by the durable adapter.

## Company automation audit

- Exactly one automated database trigger targets Company ownership: `1c88bbcc-d237-4c4f-b05e-6e777719368d`.
- Workflow `49fbcff3-a078-5789-a0fc-15cb63e04e35`, **Create company when adding a new person**, has one active version: `ba08c951-0e05-5f83-a6ca-0d8f0bd910c2`.
- The active workflow rejects personal domains, extracts the normalized business domain, searches Companies, checks for an exact match, and then links the existing Company or creates and links one Company.
- Company `domainName` is active and unique.
- The QA Person linked to Company `3d5d4738-8514-4ce6-9e4a-3e09aa33f5b4`; the exact `https://pulpsense.com` query returned one Company.

## Opportunity schema ownership

The five funnel-specific fields are owned declaratively by the separate
`PulpSense/twentycrm-extensions` application. Its live schema-only plan added
the fields and generated view columns with zero updates and zero destroys:

- `brandUrl` (`LINKS`);
- `paidSocialSpend` (`SELECT`);
- `winnerStatus` (`SELECT`);
- `platforms` (`MULTI_SELECT`);
- `deliveryTimeline` (`SELECT`).

The standard Opportunity `stage` field remains Twenty-owned. The workspace
metadata was updated to add **Qualified – Awaiting Booking** with API value
`QUALIFIED_AWAITING_BOOKING` at position 0 while preserving every existing
option and ID. Closed-stage API values remain `NEW_DEALS_WON`,
`NEW_DEALS_LOST`, and `NEW_DEALS_UNQUALIFIED`; the booking stage remains
`NEW_DEALS_MEETING_BOOKED`.

## Qualified journey

Answers:

- Brand URL: `https://pulpsense.com`
- Spend: `$50k - $150k/month`
- Winner: `Yes, several winners`
- Platforms: `Meta`
- Timeline: `Next 2 weeks`

Observed results:

- The browser rendered the Cal booking step rather than the unqualified page.
- Contact Trigger run `run_06fucnrbjnr0qj8gcl1kj4b501` succeeded.
- Application Trigger run `run_06fucnv9bijcla88a63ijv7001` succeeded.
- Twenty Person `9a350840-eca4-4538-b990-ad41590fb69d` was created and linked to the one existing PulpSense Company.
- Twenty Note and NoteTarget `75627e02-6094-47bf-aca5-6bdb77051475` contain the complete application answers and `Qualification: qualified`.
- Exactly one Opportunity, `270e3974-7d30-47db-bfab-a1adc7d1af87`, was related to the Person and Company.
- The Opportunity stage was `QUALIFIED_AWAITING_BOOKING`.
- Its structured projection was `brandUrl=https://pulpsense.com`, `paidSocialSpend=FROM_50K_TO_150K_MONTH`, `winnerStatus=SEVERAL_WINNERS`, `platforms=[META]`, and `deliveryTimeline=NEXT_2_WEEKS`.
- The durable Meta adapter acknowledged the matching `SubmitApplication` event with `events_received: 1` as part of the successful run.

## Cleanup

The unqualified QA NoteTarget, Note, and Person were removed by exact ID after
evidence capture. The qualified QA NoteTarget, Note, Opportunity, and Person
were then removed by exact ID. Follow-up queries returned zero QA People and
exactly one Company for `https://pulpsense.com`; the existing Company was never
deleted or rewritten.
