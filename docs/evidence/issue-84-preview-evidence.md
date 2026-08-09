# Issue 84 preview evidence

Date: 2026-08-09

## Environment

- Pull request: `PulpSense/pulpsense-growth-platform#97`
- Preview deployment: `https://c7598dcc.pulpsense-funnels-preview.pages.dev`
- Stable preview alias: `https://pr-97.pulpsense-funnels-preview.pages.dev`
- Trigger.dev Development worker: `20260809.15`
- Twenty: live workspace with a uniquely identified QA Person, Opportunity, Note,
  and NoteTarget
- Meta: sandbox dataset using the ignored local preview credential and test event
  code

The controlled application request used an operator-signed retry identity at the
same preview API boundary as the browser. This avoided submitting a synthetic
lead through Turnstile while still exercising server-owned qualification and
the encrypted booking identity handoff. The server returned `nextStep=booking`
and issued a booking identity only for the qualified application with a verified
business email.

## Durable CRM schema prerequisite

Preview QA found that the five Opportunity fields documented for issue 83 had
been installed from an unmerged branch and disappeared after the next main
deployment. The schema-owner change was published and merged as
`PulpSense/twentycrm-extensions#32`.

Its remote plan reported 10 additions, 0 changes, and 0 destroys. Live GraphQL
introspection then returned all five fields: `brandUrl`, `paidSocialSpend`,
`winnerStatus`, `platforms`, and `deliveryTimeline`.

## Accepted and duplicate booking

Synthetic identity:

- Submission ID: `b0ebf267-73a3-4326-9322-1ef9d1067e33`
- Email: `issue84-mslyld2g@pulpsense.com`
- Cal booking UID: `issue84_booking_mslyld2g`

Observed results:

- Final application run `run_06fueffo6tc5o009s2fmjcch01` completed.
- Final booking run `run_06fuefggghb72uud9hq1bde301` completed.
- Replaying the identical signed Cal webhook returned the same booking run ID,
  proving enqueue idempotency from the stable Cal UID.
- The deterministic booking event ID was
  `booking_completed:issue84_booking_mslyld2g`.
- The deterministic booking activity ID was
  `a69ba5bb-d5e9-57ff-bfc2-86a1d2be768d`.
- Twenty contained exactly one QA Person and one related Opportunity,
  `a9ece22e-0949-4364-a712-156d7a3064f3`.
- The Opportunity stage was `NEW_DEALS_MEETING_BOOKED` and its structured
  projection was `brandUrl=https://pulpsense.com`,
  `paidSocialSpend=FROM_50K_TO_150K_MONTH`,
  `winnerStatus=SEVERAL_WINNERS`, `platforms=[META]`, and
  `deliveryTimeline=NEXT_2_WEEKS`.
- The application Note and NoteTarget used the submission ID. The booking Note
  and NoteTarget used the deterministic booking activity ID.
- Both Trigger runs returned their matching `metaEventId` only after Meta
  acknowledged `events_received: 1`. The booking run returned
  `booking_completed:issue84_booking_mslyld2g`, proving the server-owned
  `Schedule` event used the same durable ID.

During the replay, Twenty returned its real duplicate response as HTTP 400 with
`A duplicate entry was detected` rather than HTTP 409. The processor now treats
only that explicit 400 response as an idempotent success; its full suite covers
the behavior.

## Rejected bookings

Against the same preview deployment:

- A Cal payload with an invalid signature returned HTTP 401
  `invalid_cal_signature`.
- A correctly signed, otherwise valid `BOOKING_CREATED` payload without the
  server-issued submission metadata returned HTTP 422 `booking_not_eligible`.
- Neither rejected request received a Trigger run ID.

The browser callback remains navigation-only. It cannot emit Meta `Schedule`;
only the authenticated Cal webhook can create the server booking event.

## Validation and cleanup

- `pnpm test`: 8 files, 52 tests passed
- `pnpm check-types`: 0 errors
- `pnpm lint`: passed
- Preview build/parity checks and the separate lazy Cal booking chunk passed
  before deployment.

After capturing evidence, the QA booking NoteTarget, booking Note, application
NoteTarget, application Note, Opportunity, and Person were deleted in dependency
order by exact ID. Follow-up REST requests returned 404 for every activity and
Opportunity ID, and the exact QA email query returned zero People. The existing
PulpSense Company and the durable Opportunity schema were not deleted or
rewritten.
