# Twenty Company ownership audit

## Decision

Twenty is the sole owner of Company creation and Person-to-Company linking for funnel leads. Trigger.dev must not create Companies.

The application processor normalizes the accepted contact's business-email domain to lowercase, removes a trailing dot, and queries Twenty with the canonical `https://<domain>` value. A qualified Opportunity is linked to the matching Company when it already exists. A missing Company does not cause Trigger.dev to race the Twenty automation by creating another record.

## Audit evidence

- Repository search found no other Company writer in the funnel host or automation worker.
- `process-funnel-event` contains no `POST /rest/companies` operation. Its Company adapter is lookup-only.
- Twenty enforces Company-domain uniqueness and uses the domain field as the human-readable relation identifier.
- The processor tests prove Company lookup uses the normalized email domain and that the unqualified path cannot create either a Company or Opportunity.

## Workspace constraint

Keep exactly one Twenty workspace automation enabled for Company creation/linking. It must derive the same normalized business-email domain and link the Person reliably. Do not add Company creation to Trigger.dev while that automation is enabled.

Before promoting an environment, verify in that Twenty workspace that:

1. the Company automation is enabled once, not duplicated;
2. `domainName` uniqueness is active;
3. a mixed-case email domain links to the existing normalized Company;
4. replaying the same Person does not create another Company.

If the Twenty automation fails this audit in a target workspace, fix or disable it before enabling funnel traffic. Changing Company ownership to Trigger.dev requires a separate migration with the old owner disabled first.
