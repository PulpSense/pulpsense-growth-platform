# Vertical funnel configuration architecture — developer approval handoff

**Status:** Architecture approved and implemented; retained as a historical
design record.
**Updated:** 2026-08-22

> **Current implementation authority:** Use
> [`../vertical-funnel-personalization-playbook.md`](../vertical-funnel-personalization-playbook.md)
> for creating and approving vertical funnels. This handoff explains the module
> seams that enabled that work, but its unimplemented Phase 2/3 proposals are not
> current requirements.

## Current state

The shared shell plus typed per-campaign configuration is now implemented under
`apps/funnels/src/funnels/ai-seo/campaign-config/`. `campaigns.ts` remains the
registry facade, the shared Astro/React components own rendering and behavior,
and `shared-content.ts` contains deliberately universal content.

The approved rollout model is narrower than some proposals in this handoff:

- personalize presentation through the existing typed campaign files;
- preserve the standard section structure and CRO behavior;
- keep contact capture plus the same owner and budget questions;
- personalize the nouns in those two questions without adding a third question;
- keep answer choices, qualification thresholds, contracts, automation, and
  booking behavior shared;
- treat richer qualification profiles, contract v2, calculators, and downstream
  measurement as separate future projects requiring explicit approval.

## Original decision request

Approve a **shared funnel shell + typed campaign configuration** architecture for the six AI SEO paid-traffic verticals:

- Law firms
- Dental practices
- Dental implants
- Plastic surgery
- Hair restoration
- Med spas

This handoff is about project structure and module seams only. It does **not** approve final copy, proof claims, guarantees, qualification thresholds, or implementation.

## Why this change

The current routes are technically separate, but most of the sales argument is hard-coded in shared Astro modules. `campaigns.ts` currently changes route identity, metadata, pixel destination, a hero callout, and one qualification callout. The hero, benefits, comparison, proof, process, offer, guarantee, FAQ, reviews, form, thank-you copy, and pre-call emails remain substantially universal.

That makes the funnels vertically renamed rather than vertically customized.

The proposed design keeps the existing route, rendering, analytics, booking, security, and deployment machinery shared. Each campaign supplies a typed configuration containing the content and behavioral selections that genuinely vary.

## Recommendation in one sentence

Keep `campaigns.ts` as the small public registry/facade, move each complete campaign definition into its own typed file, and make the existing shared Astro/React modules render the selected campaign configuration.

## Proposed project structure

```text
apps/funnels/src/funnels/ai-seo/
├── campaigns.ts                         # Public registry and lookup facade
├── campaign-config/
│   ├── types.ts                         # AiSeoCampaignConfig interface
│   ├── defaults.ts                      # Deliberate shared defaults only
│   ├── validate.ts                      # Cross-config invariants
│   ├── law-firms.ts                     # Complete law-firm configuration
│   ├── dental-practices.ts              # Complete general-dental configuration
│   ├── dental-implants.ts               # Complete implant configuration
│   ├── plastic-surgery.ts               # Complete plastic-surgery configuration
│   ├── hair-restoration.ts              # Complete hair-restoration configuration
│   ├── med-spas.ts                      # Complete med-spa configuration
│   └── index.ts                         # Typed ordered registry
├── qualification/
│   ├── types.ts                         # UI flow/question interfaces
│   ├── registry.ts                      # profile ID -> typed flow adapter
│   ├── shared-steps.ts                  # contact, decision-maker, calendar
│   └── flows/
│       ├── law-firms.ts
│       ├── dental-practices.ts
│       ├── dental-implants.ts
│       ├── plastic-surgery.ts
│       ├── hair-restoration.ts
│       └── med-spas.ts
├── components/
│   ├── AiSeoQualificationForm.tsx       # Shared flow engine
│   ├── landing/                         # Shared props-driven sections
│   └── thank-you/                       # Shared props-driven sections
└── styles/                              # Shared visual system

apps/automations/src/email/
├── precall-copy.ts                      # Shared scheduling/module machinery
└── precall-copy-by-funnel.ts            # Copy selected by FunnelId

packages/contracts/src/
└── funnel-events.ts                     # Versioned event schemas and answers
```

### Important placement decision

Do **not** put all six campaigns into one enormous `campaigns.ts` file.

`campaigns.ts` should remain the stable interface used by routes and runtime configuration:

```ts
export {
  AI_SEO_CAMPAIGNS,
  getAiSeoCampaignStaticPaths,
  resolveAiSeoCampaign,
  resolveAiSeoBrowserPixelId,
} from "./campaign-config";

export type {
  AiSeoCampaignConfig,
  AiSeoCampaignKey,
  AiSeoFunnelId,
} from "./campaign-config/types";
```

Each vertical file becomes the single source of truth for that campaign’s route identity and presentation configuration.

## Module responsibilities

### 1. `campaign-config/types.ts`

Defines the interface every campaign must satisfy. It should describe content and selections, not rendering details or CSS classes.

Suggested shape:

```ts
type AiSeoCampaignConfig = {
  identity: {
    key: AiSeoCampaignKey;
    funnelId: AiSeoFunnelId;
    slug: string;
    browserPixelEnvKey: `PUBLIC_${string}`;
    serverMetaDestination: MetaDestination;
  };

  metadata: {
    landingTitle: string;
    landingDescription: string;
    thankYouTitle: string;
    thankYouDescription: string;
  };

  measurement: {
    economicUnit:
      | "signed_matter"
      | "kept_patient"
      | "accepted_implant_case"
      | "booked_surgery"
      | "booked_hair_case"
      | "treated_med_spa_patient";
    leakStages: readonly LeakStage[];
    primaryExperimentId: string;
  };

  landing: {
    hero: HeroContent;
    benefits: BenefitsContent;
    marketShift: MarketShiftContent;
    comparison: ComparisonContent;
    education: EducationContent;
    results: ResultsContent;
    process: ProcessContent;
    offer: OfferContent;
    riskReversal: RiskReversalContent;
    faq: FaqContent;
    reviews: ReviewsContent;
    stickyCta: CtaContent;
  };

  application: ApplicationPageContent;

  qualification: {
    profileId: QualificationProfileId;
    version: string;
  };

  thankYou: ThankYouContent;
};
```

Names can change during implementation. The important design constraints are:

- Configuration contains **content and explicit behavioral selections**.
- Astro/React modules own markup, accessibility, responsive behavior, tracking hooks, and visual presentation.
- Configuration must not contain HTML strings, JSX, CSS classes, callbacks, or arbitrary executable logic.
- Every campaign must satisfy the same top-level interface.

This is the target interface after Phase 2. Phase 1A introduces only identity,
metadata, presentation content, and the existing derived paths. The
`qualification` behavioral selection is added when the profile registry exists
in Phase 2; do not add an unused profile field to the Phase 1A interface.

### 2. Individual vertical files

Each vertical file exports one complete immutable campaign definition:

```ts
export const lawFirmsCampaign = defineAiSeoCampaign({
  identity: {
    key: "lawyers",
    funnelId: "ai-seo",
    slug: "visibility-audit/law-firms",
    browserPixelEnvKey: "PUBLIC_META_PIXEL_ID_AI_SEO_L",
    serverMetaDestination: "AI_SEO_L",
  },
  metadata: {
    /* ... */
  },
  measurement: {
    economicUnit: "signed_matter",
    leakStages: ["visibility", "inquiry", "intake", "consultation", "signed"],
    primaryExperimentId: "law-firms-demand-leak-v1",
  },
  landing: {
    /* ... */
  },
  application: {
    /* ... */
  },
  qualification: {
    profileId: "law-firms-v1",
    version: "2026-08-21",
  },
  thankYou: {
    /* ... */
  },
});
```

This keeps the complete sales argument for one vertical locally understandable without cloning page markup.

### 3. `campaign-config/defaults.ts`

Only include content that is intentionally identical across all six campaigns.

Good candidates:

- Brand name
- Disclosure text
- Contact/privacy links
- Shared accessibility labels
- Generic audit process steps that are genuinely universal

Bad candidates:

- The primary promise
- Proof
- Objections
- Buyer vocabulary
- Qualification questions
- Guarantee language
- Economic unit
- CTA copy

A default should mean “approved shared behavior,” not “we have not customized this yet.”

### 4. `campaign-config/validate.ts`

Use one invariant validator during tests/build to catch configuration drift:

- Unique `key`, `slug`, and `funnelId`
- Unique pixel destination mapping
- Landing and thank-you routes derived consistently
- No empty hero/CTA content
- Proof cards require provenance and an applicability label
- Experiment IDs are present and unique where required
- Qualification profile exists in the flow registry once Phase 2 introduces it
- No forbidden/retired claims such as the unsupported universal call guarantee

This is a deep module: routes learn one lookup interface while validation and campaign assembly remain internal.

## Shared rendering flow

The existing route topology remains unchanged: one shared landing shell, one
shared application shell at `/apply/`, and one shared thank-you shell at
`/thank-you/`. Campaign configuration changes what those shells render; it does
not move the form onto the landing page or remove a route.

The landing route remains a shared shell:

```astro
---
const { campaign } = Astro.props;
---

<HeroSection content={campaign.landing.hero} />
<BenefitsSection content={campaign.landing.benefits} />
<MarketShiftSection content={campaign.landing.marketShift} />
<ComparisonSection content={campaign.landing.comparison} />
<EducationSection content={campaign.landing.education} />
<ResultsSection content={campaign.landing.results} />
<ProcessSection content={campaign.landing.process} />
<OfferStackSection content={campaign.landing.offer} />
<RiskReversalSection content={campaign.landing.riskReversal} />
<FaqSection content={campaign.landing.faq} />
<ReviewsSection content={campaign.landing.reviews} />
<StickyCta
  content={campaign.landing.stickyCta}
  ctaPath={campaign.qualificationPath}
/>
```

The application route remains a separate shared shell:

```astro
<QualificationSection
  content={campaign.application}
  funnelId={campaign.identity.funnelId}
  qualifiedRedirect={campaign.thankYouPath}
  {...runtimeProps}
/>
```

Phase 2 adds `profileId={campaign.qualification.profileId}` to the application
shell when the profile registry and versioned contracts are implemented.

The exact prop names can change. The desired seam is one typed content object per shared section—not dozens of unrelated string props and not direct imports of campaign files inside section modules.

## When a shared section is not enough

Default rule: reuse the shared section with campaign data.

Create a vertical rendering adapter only when the interaction or information architecture genuinely differs. Examples:

- An implant financing/case-value calculator
- A law-firm matter-value/intake-leak calculator
- A med-spa retention/rebooking module

If that happens, select from a closed typed variant:

```ts
calculator: {
  variant: "matter-leak";
  inputs: [
    /* typed copy and ranges */
  ];
}
```

Then one shared `RevenueLeakCalculator` chooses a known implementation. Do not place React modules or arbitrary callbacks in campaign configuration.

## Qualification architecture

### Why qualification should not be a free-form JSON form builder

The application answers cross the funnel → contracts → Trigger.dev → CRM seam. Arbitrary configuration would make validation, analytics, migrations, and downstream handling fragile.

Use a closed `QualificationProfileId` selected by the campaign configuration. A registry resolves that ID to a typed flow adapter:

```ts
type QualificationProfileId =
  | "law-firms-v1"
  | "dental-practices-v1"
  | "dental-implants-v1"
  | "plastic-surgery-v1"
  | "hair-restoration-v1"
  | "med-spas-v1";
```

The shared `AiSeoQualificationForm` should continue to own:

- Contact-first capture
- Email verification
- Phone validation
- Turnstile
- Attribution
- Submission identity
- Calendar handoff
- Error and retry behavior
- Common analytics events

Each flow adapter should own only:

- Niche-specific question order
- Allowed answer values
- UI labels/help text
- Qualification evaluation
- Sanitized analytics labels
- Mapping to the versioned contract payload

Do not collect patient health details, legal matter details, names of patients/clients, or free text that could create PHI/confidentiality risk.

## Contract evolution

`packages/contracts/src/funnel-events.ts` currently repeats one `aiSeoApplicationAnswersSchema` across all six funnel IDs.

Recommended migration:

1. Preserve the complete schema-version-1 event union for already-enqueued and replayed events.
2. Add an application-submitted event with top-level `schemaVersion: 2` and a discriminated union keyed by `funnelId`.
3. Put `profileVersion` inside every v2 `payload.application` object.
4. Keep contact and booking lifecycle schemas backward compatible.
5. Update Trigger.dev and CRM adapters to accept v1 and v2 during the migration window.
6. Remove v1 production emission only after deployed consumers accept v2.

Illustrative shape:

```ts
type VerticalApplication =
  | {
      funnelId: "ai-seo";
      schemaVersion: 2;
      payload: {
        application: LawFirmAnswersV2 & {
          profileVersion: "law-firms-v1";
        };
      };
    }
  | {
      funnelId: "ai-seo-dentists";
      schemaVersion: 2;
      payload: {
        application: DentalPracticeAnswersV2 & {
          profileVersion: "dental-practices-v1";
        };
      };
    }
  | {
      funnelId: "ai-seo-dental-implants";
      schemaVersion: 2;
      payload: {
        application: DentalImplantAnswersV2 & {
          profileVersion: "dental-implants-v1";
        };
      };
    };
```

The exported application-event parser should explicitly accept the legacy v1
shape or the new v2 shape. Do not silently change the existing v1 payload under
the same schema version, and do not reuse `profileVersion` as the event schema
discriminator.

## Automation and pre-call copy

The automation app should not import presentation configuration from `apps/funnels`. That would blur the existing deployment seam.

Instead:

- The funnel emits `funnelId`, versioned application answers, attribution, and stable experiment/profile identifiers.
- `apps/automations/src/email/precall-copy-by-funnel.ts` selects automation-owned copy by `FunnelId`.
- Shared scheduling, suppression, timing, retries, and sender configuration remain in the automation app.
- Trigger.dev and CRM logic consume contracts, not Astro modules.

This creates intentional duplication of marketing copy ownership across two deployment modules while sharing stable identifiers through `packages/contracts`. Do not create a shared “content package” unless another real consumer appears and the duplication becomes costly.

## Analytics and experiments

Keep `FunnelAnalytics`, Meta tracking, attribution capture, and submission mechanics shared.

Add allowlisted fields/events rather than sending entire configuration objects:

- `vertical_key`
- `economic_unit`
- `qualification_profile_version`
- `experiment_id`
- `experiment_variant`
- `selected_bottleneck`
- `calculator_completed`
- `qualified_lead`
- `booking_completed`
- `booking_showed`
- `opportunity_created`
- `outcome_won`
- `collected_revenue` through an authorized server/CRM path only

Never send legal matter details, patient information, health information, or unrestricted form text to browser analytics.

## Proof model

Proof must be data, not hard-coded markup scattered through sections.

Suggested interface:

```ts
type ProofItem = {
  id: string;
  headline: string;
  body: string;
  sourceLabel: string;
  sourceUrl?: string;
  applicability: "same-vertical" | "adjacent" | "sample-audit";
  approved: boolean;
};
```

Rendering rules:

- Only `approved: true` proof renders in production.
- Same-vertical proof is preferred.
- Adjacent proof must be labeled and must not imply the result occurred in the current niche.
- A sample audit can demonstrate method, not client outcome.
- No campaign should inherit another vertical’s result merely because a default exists.

Whether approval metadata belongs in source code or a future CMS can be revisited later. For this change, source-controlled typed data is simpler and reviewable.

## Proposed implementation phases

### Phase 1A — Behavior-preserving presentation extraction

Lowest-risk structural change.

1. Add `campaign-config/types.ts` and six vertical files.
2. Move existing campaign identity/metadata into those files without changing behavior.
3. Convert the landing, application, and thank-you Astro sections to typed `content` props.
4. Move the current hard-coded copy into all six configs exactly as it exists today.
5. Add configuration invariant tests and per-route rendering tests.
6. Preserve the existing form payload and automation behavior.

This phase must produce no intentional copy, claim, qualification, analytics,
contract, or automation behavior change. Its purpose is to establish and verify
the configuration seam.

**Deployment risk:** Low to medium. Static rendering and structural movement only.

### Phase 1B — Approved vertical presentation rollout

1. Obtain commercial approval for each vertical's promise, proof, guarantee,
   objections, qualification-page copy, and CTA language.
2. Replace only approved presentation fields in the per-vertical configs.
3. Use semantic route tests to prevent cross-vertical content leakage.
4. Keep qualification answers, contracts, and automation behavior unchanged.

Phase 1B may ship vertical-by-vertical. Research findings are inputs to approval;
they are not themselves approval to publish a claim.

**Deployment risk:** Medium. Customer-facing copy and claims change.

### Phase 2 — Vertical qualification

1. Add qualification profile registry and six typed flows.
2. Add contract schema v2 while retaining v1 parsing.
3. Update funnel server handling, Trigger.dev consumers, CRM mapping, and analytics.
4. Deploy consumers before producers.
5. Verify replay/idempotency behavior and existing booking flow.

**Deployment risk:** Medium to high. Crosses funnel, automation, and CRM seams.

### Phase 3 — Downstream outcome measurement

1. Define stable lifecycle outcomes by vertical.
2. Import show/opportunity/won/collected events from the system of record.
3. Reconcile those events to `submissionId`, `prospectId`, and `funnelId`.
4. Build CPL-to-revenue reporting and experiment scorecards.

**Deployment risk:** High. Stateful and dependent on external systems.

Separating these phases allows the team to improve message match without coupling the first release to a contract migration.

## Testing expectations

### Configuration tests

- Exactly six campaigns exist.
- Keys, slugs, funnel IDs, pixel keys, and server destinations are unique.
- Every campaign resolves from its generated route.
- Every campaign has complete required section content.
- Qualification profile IDs resolve once Phase 2 introduces them.
- Proof approval/applicability rules pass.
- Retired claims fail validation.

### Rendering tests

For every campaign route:

- The correct hero, CTA, vocabulary, and proof render.
- Content from another vertical does not render.
- Metadata and thank-you route match the campaign.
- Shared tracking and booking modules remain present.
- The page remains `noindex`.

Prefer semantic assertions over full-page snapshots. A focused assertion such as “the law-firm route renders `signed matters` and not `implant cases`” catches cross-vertical leakage better than a giant snapshot.

### Qualification and contract tests

- Each profile accepts valid answers and rejects another profile’s answers.
- v1 historical events still parse.
- v2 events round-trip through funnel enqueue, Trigger.dev, and CRM mapping.
- No sensitive answers enter browser analytics.
- Contact-first capture and calendar booking remain unchanged.

### Build gates

```bash
pnpm lint
pnpm check-types
pnpm build
```

Run focused unit/integration tests for campaign registry, section rendering, qualification flows, contracts, funnel server handling, and automations before the full gates.

## Files expected to change in Phase 1A

```text
apps/funnels/src/pages/[...campaign]/index.astro
apps/funnels/src/pages/[...campaign]/apply/index.astro
apps/funnels/src/pages/[...campaign]/thank-you/index.astro
apps/funnels/src/funnels/ai-seo/campaigns.ts
apps/funnels/src/funnels/ai-seo/campaign-config/**
apps/funnels/src/funnels/ai-seo/components/application/*.astro
apps/funnels/src/funnels/ai-seo/components/landing/*.astro
apps/funnels/src/funnels/ai-seo/components/thank-you/*.astro
apps/funnels/src/funnels/ai-seo/campaigns.test.ts
```

`AiSeoQualificationForm.tsx` does not change in Phase 1A. It receives a profile
ID only when Phase 2 adds the profile registry, vertical flows, versioned
contracts, and their tests.

## Explicit non-goals

- Six cloned Astro page trees
- A CMS
- A generic no-code form builder
- A new frontend framework or runtime
- Moving Trigger.dev responsibilities into the funnel app
- Sending private legal/health data to analytics
- Reworking booking, Turnstile, attribution, or email verification in Phase 1A
- Implementing unapproved copy or guarantees
- Creating a shared content package before there is a second real presentation consumer

## Alternatives considered

### A. Keep adding fields to the current `campaigns.ts`

Rejected. It becomes a large junk drawer, lowers locality, and makes one vertical risky to edit.

### B. Clone the entire funnel once per vertical

Rejected. It improves local copy ownership but duplicates layout, analytics, accessibility, booking, bug fixes, and tests six times.

### C. Store campaign content in JSON/YAML

Not recommended for this phase. TypeScript gives compile-time checks, co-locates review with code, and supports safe closed unions for variants. External content storage can be reconsidered if non-developers must publish independently.

### D. Put all funnel and email copy in a shared package

Rejected for now. It couples separate deployments and confuses presentation ownership with stable event contracts. Share identifiers and schemas, not application copy.

## Historical developer approval checklist

> This checklist records the original architectural decision. It is not an open
> implementation checklist. Current vertical rollout acceptance criteria live in
> the personalization playbook.

Please approve or comment on these decisions:

- [ ] Keep one shared Astro route and shared visual modules.
- [ ] Keep `campaigns.ts` as a small public registry/facade.
- [ ] Store each complete campaign in one typed TypeScript file under `campaign-config/`.
- [ ] Pass one typed content object to each shared section.
- [ ] Allow only closed rendering variants; no JSX/callbacks in configuration.
- [ ] Use a profile registry for vertical qualification rather than a generic form builder.
- [ ] Version the application-event contract instead of mutating v1.
- [ ] Keep automation-owned email copy inside `apps/automations`.
- [ ] Deliver behavior-preserving presentation extraction before approved vertical copy, qualification/contracts, and downstream measurement.
- [ ] Enforce campaign completeness and forbidden-claim rules in tests.

## Recommended approval outcome

Approve **Phase 1A** as proposed. It creates the correct seam with limited
operational risk. Treat **Phase 1B** as a separate customer-facing rollout gated
on commercial approval of each vertical's copy and claims.

Require a separate technical review for **Phase 2** because it changes cross-app contracts and qualification behavior. Require an instrumentation/data review for **Phase 3** because attribution to collected revenue depends on systems of record and privacy controls.

## Supporting research

The strategic and niche-specific content recommendations are documented separately:

- `docs/vertical-funnel-personalization-playbook.md` — current rollout authority
- `docs/research/vertical-funnel-customization-brief.md`
- `docs/research/law-firms-voc.md`
- `docs/research/dental-practices-voc.md`
- `docs/research/dental-implants-voc.md`
- `docs/research/plastic-surgery-voc.md`
- `docs/research/hair-restoration-voc.md`
- `docs/research/med-spas-voc.md`

This handoff intentionally limits itself to the project structure needed to support those recommendations.
