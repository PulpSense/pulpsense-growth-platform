# Vertical funnel personalization playbook

**Status:** Authoritative implementation and approval process

**Effective:** 2026-08-22

**Reference implementation:** Law firms

**Applies to:** Law firms, dental practices, dental implants, plastic surgery,
hair restoration, and med spas

## Purpose

This playbook defines how to adapt the proven AI SEO funnel to another vertical.
The goal is strong niche recognition without redesigning the funnel, changing its
conversion mechanics, or turning research recommendations into unapproved
claims.

The law-firm funnel is the reference implementation: it uses the same shared
shell and conversion path as the standard med-spa funnel, while the major sales
argument is rewritten in the buyer's language.

## Authority and source precedence

When sources disagree, use this order:

1. Explicit commercial decisions approved for the current rollout.
2. This playbook.
3. The shared funnel configuration and `PERSONALIZATION` preview pages.
4. The relevant vertical VOC report in `docs/research/`.
5. The cross-vertical research synthesis and historical architecture handoff.

VOC research is an input to copywriting, not permission to publish a claim,
change the offer, add form friction, or redesign the funnel.

## Core rule

Customize the language to the niche while deviating from the standard funnel as
little as possible.

For every proposed change, preserve:

- the section's conversion purpose;
- the same information hierarchy;
- the same content shape—a sentence stays a sentence and a paragraph stays a
  paragraph;
- approximately the same copy length and mobile line count;
- the shared visual treatment, spacing, interactions, and CTA placement.

Do not use vertical research as a reason to replace the established offer with a
new diagnostic, calculator, or sales process unless that is approved as a
separate experiment.

## The standard funnel contract

The med-spa/shared experience is the structural control. A normal vertical
personalization must keep these elements unchanged:

- landing, application, and thank-you route topology;
- landing-page section order and component structure;
- carousel, CTA placement, sticky CTA, styling, and interactions;
- number of benefit cards, process steps, offer items, guarantee pills, and
  FAQs;
- contact capture, validation, attribution, qualification, and booking behavior;
- qualification answer options, thresholds, and disqualification logic;
- shared proof assets until approved vertical-specific proof exists;
- the “Traditional Paid Ads vs. AI Search” comparison copy;
- the 45-results-in-90-days offer structure and work-free remedy;
- the concise shared guarantee terms inside Important Disclosures.

Changing one of these is a product or CRO experiment, not routine vertical
personalization, and requires separate approval.

## Approved personalization surfaces

The visual source of truth for these surfaces is:

- `/personalization-preview/`
- `/personalization-preview/apply/`

The implementation lives in
`apps/funnels/src/funnels/ai-seo/components/personalization-preview/`.

### Landing page

Personalize the following while preserving their structure and intent:

| Area         | Fields to personalize                                       | Constraint                                                                               |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Metadata     | Page titles and descriptions                                | Describe the same offer for the niche                                                    |
| Hero         | Service callout, promised-result noun, supporting paragraph | Match the standard length; mobile supporting copy should fit within three lines at 390px |
| Benefits     | Major heading, intro, and designated niche-sensitive cards  | Keep the same three-card structure                                                       |
| Market shift | Heading and supporting paragraph                            | Explain the same market change in buyer language                                         |
| Education    | Heading, intro, item titles, and item bodies                | Preserve item count and teaching sequence                                                |
| Results      | Heading and intro                                           | Do not imply shared proof came from the new niche                                        |
| Process      | Heading, intro, step titles, and step bodies                | Preserve step count and operational promise                                              |
| Offer        | Heading, intro, and exclusivity note                        | Preserve deliverables and CTA                                                            |
| Guarantee    | Result noun, body, and first result-specific pill           | Preserve 90 days and the work-free remedy                                                |
| FAQ          | Only the approved niche-sensitive questions and answers     | Preserve ten items and their objection-handling purpose                                  |
| Reviews      | Section heading                                             | Do not relabel cross-industry reviews as same-vertical proof                             |

Keep the comparison section universal unless a separate change is approved:

> **Traditional Paid Ads vs. AI Search**
>
> Paid ads stop when the budget stops. Our system builds visibility that keeps
> sending people directly to your business.

### Application page

The first lead-information step remains unchanged.

The application keeps exactly two qualification questions after contact
capture:

1. Owner/primary-decision-maker question: personalize the business noun.
2. Monthly-marketing-budget question: personalize the desired-result noun.

Keep the intent, answer choices, budget bands, qualification thresholds, and
question order unchanged. Each question should have no more than four or five
options. Do not add a niche-specific third question during routine
personalization.

The application headline, supporting paragraph, expectation copy, and sidebar
callout may be rewritten for the niche if their structure and purpose stay the
same.

### Thank-you page

Personalize the booked-audit framing, preparation language, calendar reminder,
video heading, and review heading. Preserve the same confirmation behavior,
assets, section order, and next steps.

## Research-to-copy workflow

### 1. Select the vertical source

Use the matching report:

- `docs/research/law-firms-voc.md`
- `docs/research/dental-practices-voc.md`
- `docs/research/dental-implants-voc.md`
- `docs/research/plastic-surgery-voc.md`
- `docs/research/hair-restoration-voc.md`
- `docs/research/med-spas-voc.md`

### 2. Build a constrained language sheet

Before drafting page copy, extract only what is needed to translate the existing
sales argument:

- buyer/business noun;
- buyer's customer or prospective-customer noun;
- measurable inquiry/result noun;
- service, case, treatment, procedure, or practice vocabulary;
- strongest pains and objections relevant to the existing sections;
- phrases buyers actually use;
- proof or claims that must be avoided or qualified;
- whether each point is evidence, inference, or a hypothesis.

Do not automatically adopt the report's proposed funnel architecture, number of
questions, calculator, CTA, or alternative offer.

### 3. Draft against the control

Work field by field from `shared-content.ts`, not from a blank page. For each
field, record:

- standard copy;
- proposed vertical copy;
- research basis;
- original intent being preserved;
- length or mobile-line risk;
- any claim requiring commercial approval.

Prefer noun and context substitutions plus a sharper buyer-specific pain over a
new paragraph structure.

### 4. Review the commercial offer separately

Confirm these decisions explicitly before implementation:

- the noun being guaranteed—calls, inquiries, or another approved result;
- what makes that result qualified;
- whether the 45-in-90-days target remains appropriate;
- whether any vertical-specific eligibility language is necessary;
- whether the shared proof can remain and how it must be labeled.

The default is to retain the standard offer and remedy. Research concerns do not
silently change the guarantee.

### 5. Implement in the vertical configuration

Put presentation copy in the matching file under:

`apps/funnels/src/funnels/ai-seo/campaign-config/`

Inherit deliberately shared content from `shared-content.ts` and override only
approved fields. Do not:

- clone page markup;
- put vertical conditionals inside shared Astro components;
- change shared CSS for one vertical when copy can solve the fit;
- introduce HTML, JSX, callbacks, or rendering logic into campaign data;
- change contracts, automation behavior, or qualification logic as part of a
  copy-only rollout.

### 6. Review visually against the standard

Compare the new route side by side with med spas at desktop and mobile widths.
Confirm:

- the same content density above the fold;
- hero headline and supporting copy do not create extra lines or push the CTA;
- each personalized section has the same visual rhythm as the control;
- the offer and guarantee use one consistent result noun throughout;
- proof labels do not imply same-vertical results when they are cross-industry;
- no generic placeholder or another vertical's vocabulary leaked through;
- contact, qualification, and booking behavior are unchanged.

### 7. Approval sequence

Use one vertical per approval cycle:

1. Review the proposed copy matrix.
2. Render a local or PR preview.
3. Obtain visual/commercial approval.
4. Run code review against `origin/master`.
5. Fix approved findings.
6. Re-run validation and deploy the updated preview.
7. Obtain explicit merge/deploy approval.

## Validation gates

At minimum, run:

```bash
pnpm test
pnpm check-types
pnpm lint
pnpm build
pnpm format:check
pnpm check-parity
```

Tests should assert:

- campaign identities, slugs, and tracking destinations remain unique;
- every route has complete content;
- shared CRO structure and element counts remain intact;
- expected niche vocabulary renders;
- retired copy and other verticals' terminology do not render;
- the application retains contact → owner → budget → calendar;
- the shared guarantee disclosure renders inside Important Disclosures;
- crawler blocking, tracking, and booking integrations remain intact.

## Reference: what changed for law firms

Law firms demonstrate the permitted scope:

- “45 New Calls” became “45 Qualified New-Client Inquiries.”
- Major headlines and supporting paragraphs use firm, client, matter,
  practice-area, intake, and signed-matter language.
- The same two qualification questions use law-firm and qualified-inquiry nouns.
- The comparison section, layout, proof assets, CTA behavior, answer choices,
  thresholds, booking flow, guarantee remedy, and shared disclosure stayed the
  same.

That is the model for the remaining verticals: recognizable niche expertise on
top of the same optimized funnel.

## Changes that require a separate project

The following are intentionally outside routine personalization:

- additional or conditional qualification questions;
- calculators, branching diagnostics, or new interactive modules;
- new guarantee mechanism, quantity, duration, or eligibility model;
- new proof assets or claims presented as verified vertical outcomes;
- new form payloads, schema versions, CRM fields, or automation paths;
- section additions, removals, reordering, or materially different content
  density;
- changes to qualification thresholds or booking access;
- A/B-test infrastructure or downstream outcome measurement.

The research documents may support future experiments in these areas, but each
requires its own scope, approval, and validation plan.
