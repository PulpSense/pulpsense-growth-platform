# Vertical Funnel Customization Brief

**Status:** Research synthesis; not the current implementation authority
**Prepared:** 2026-08-21
**Updated:** 2026-08-22
**Decision at time of writing:** Reduce Meta CPL waste and improve qualified-booking economics by replacing one generic AI-SEO funnel with a shared conversion shell plus six vertical campaign configurations.
**Source set:** [`law-firms-voc.md`](./law-firms-voc.md), [`dental-practices-voc.md`](./dental-practices-voc.md), [`dental-implants-voc.md`](./dental-implants-voc.md), [`plastic-surgery-voc.md`](./plastic-surgery-voc.md), [`hair-restoration-voc.md`](./hair-restoration-voc.md), and [`med-spas-voc.md`](./med-spas-voc.md).

> **Current implementation authority:** Use
> [`../vertical-funnel-personalization-playbook.md`](../vertical-funnel-personalization-playbook.md)
> for vertical rollout decisions. This brief remains the cross-vertical research
> and experiment backlog. Its proposed alternative offers, calculators, 4–6
> question forms, qualification branches, claim removals, and measurement phases
> are not approved changes to the current funnel.
>
> The approved law-firm pattern preserves the standard funnel's structure, CRO,
> two-question owner/budget qualification flow, 45-in-90-days offer structure,
> work-free remedy, shared proof, and shared disclosure. It personalizes the
> major headlines, supporting copy, result noun, selected FAQs, application
> language, and thank-you framing. Apply that constrained approach to the other
> verticals unless a separate experiment is explicitly approved.

> **Historical baseline:** Sections 1–8 describe the repository and strategic
> options as assessed on 2026-08-21, before the typed campaign architecture and
> approved law-firm personalization were completed. Read references to the
> “current funnel” in those sections as the baseline at that time.

> **Traceability rule:** Statements tagged **[LF]**, **[DP]**, **[DI]**, **[PS]**, **[HR]**, or **[MS]** are synthesized from the corresponding report above. Where a report labels evidence as inference, adjacent-category evidence, vendor evidence, or a hypothesis, this brief preserves that limitation. This document does not create new outcome claims or benchmarks.

## 1. Strategic conclusion

At the time of the original assessment, the funnel was vertically renamed but not vertically customized. All six campaigns shared a hard-coded hero—**“45 New Calls in 90 Days by Ranking #1 Google & ChatGPT”**—the same generic benefits, comparison, offer, guarantee, proof, form, and qualification logic. The campaign registry changed metadata, a small callout, slug, funnel ID, and pixel destination, but not the actual buyer promise or economics.

Across all six VOC studies, raw calls are the wrong optimization unit:

- Law firms buy **qualified opportunities and signed matters**, with source-to-signature attribution. [LF §§Executive conclusion, The real buyer economics]
- General dentists buy **suitable patients who book, show, accept treatment, and produce collections** within payer and chair-capacity constraints. [DP §§Executive summary, Suitable patients vs. low-intent volume]
- Implant practices buy **qualified consultations that become accepted/scheduled cases**, with financing and follow-up visibility. [DI §§Executive conclusion, Consultation quality and treatment acceptance]
- Plastic-surgery practices buy **procedure-fit, surgery-ready consultations that attend and become deposited/booked cases**. [PS §§Executive readout, Buyer pains]
- Hair-restoration clinics buy **attended consults with clinically plausible, finance-ready candidates that become booked procedures**, while separating surgical and non-surgical paths. [HR §§Executive synthesis, Buyer jobs]
- Med spas buy **treatment-fit consults that show, buy, rebook, and return**, not one-and-done discount traffic. [MS §§Executive takeaway, Buyer economics]

### The change in one sentence

**Keep one technical shell, but make the promise, problem recognition, proof, qualification, calculator, CTA, and downstream success event specific to each niche’s economic unit and largest leak.**

The visibility audit remains a useful acquisition wedge. It should become one stage of a broader **demand-to-revenue leak diagnostic**, not the promised business result. “Google/ChatGPT” must be presented as dated, query- and location-specific sampled evidence—not a stable rank, guarantee, or controllable recommendation.

### Why this should improve paid performance

The expected gain is not necessarily the lowest raw Meta CPL. Better vertical specificity may deliberately reduce cheap form fills while improving:

1. ad-to-page message match;
2. decision-maker recognition;
3. form self-qualification;
4. booked-call rate and show rate;
5. sales acceptance/opportunity rate;
6. eventual collected-revenue economics.

Judge variants on **cost per qualified lead, cost per showed booking, and cost per opportunity**, with collected revenue and retention as lagging truth. A higher CPL is acceptable when the downstream yield improves enough to lower cost per opportunity or increase contribution per 1,000 impressions/sales hour. [LF §Recommended experiment measurement; DP §Messaging experiments; DI §Measurement guardrails; PS §Messaging tests; HR §Messaging tests; MS §Buyer economics]

## 2. Implementation diagnosis at the time of research

### What is already a good shared shell

The repository already has the right route and deployment pattern:

- `apps/funnels/src/pages/[...campaign]/index.astro` composes one static page shell for every campaign.
- `apps/funnels/src/funnels/ai-seo/campaigns.ts` owns slug, funnel ID, pixel destination, metadata, hero callout, and qualification callout.
- `packages/contracts/src/funnel-events.ts` distinguishes all six funnel IDs and preserves first-/last-touch attribution.
- `FunnelAnalytics`, Meta tracking, Turnstile, email verification, contact creation, Cal booking, and thank-you routing are shared.
- Funnel lifecycle events already cover contact, application, booking, reschedule, and cancellation.

These should remain common.

### Where generic hard-coding defeats vertical routes

| Surface                                                                       | Current issue                                                                                                                                                                               | Required change                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/funnels/src/funnels/ai-seo/campaigns.ts`                                | Registry contains metadata/callouts but not full vertical content, economics, form schema, proof, or experiment IDs. Titles still promise 45 calls.                                         | Expand each campaign to reference a typed vertical configuration: hero, message-match angle, vocabulary, leak stages, proof cards, objections, form branch, calculator, CTA, claim guardrails, and experiment metadata.     |
| `apps/funnels/src/funnels/ai-seo/components/landing/HeroSection.astro`        | Hero and subhead are hard-coded to 45 calls, #1 Google/ChatGPT, no ad spend, and a guarantee.                                                                                               | Make all hero fields props-driven. Add optional bottleneck selector and vertical trust strip.                                                                                                                               |
| `BenefitsSection.astro`, `MarketShiftSection.astro`, `EducationSection.astro` | Explain generic AI visibility and calls rather than the niche’s decision journey and leak.                                                                                                  | Keep layout; inject niche cards, economic unit, patient/client journey, and source-qualified evidence.                                                                                                                      |
| `ComparisonSection.astro`                                                     | False binary of paid ads vs AI search; repeats “45 calls or free.”                                                                                                                          | Replace with either “vanity metrics vs business outcomes” or niche-specific “current reporting vs closed-loop system.” Keep paid + local/organic/AI as complementary channels.                                              |
| `ResultsSection.astro`                                                        | Cross-industry proof: retirement community ranking and dental call volume are shown to every niche.                                                                                         | Render only comparable, verified proof. If none exists, show a sample audit artifact and label the niche as a pilot—never borrow another vertical’s outcome as proof.                                                       |
| `ProcessSection.astro`, `OfferStackSection.astro`                             | Scope ends at rankings, directories, reviews, content, and calls.                                                                                                                           | Add measurement/integration, response/booking/follow-up diagnosis, and vertical-specific audit deliverables. Keep actual service boundaries explicit.                                                                       |
| `GuaranteeSection.astro`, `FaqSection.astro`                                  | Unconditional call guarantee is repeated.                                                                                                                                                   | Remove fixed call guarantee from unsubstantiated routes. Replace with process risk reversal: buyer keeps findings, assumptions are visible, data ownership/exit terms are clear.                                            |
| `QualificationSection.astro`                                                  | Heading and intro repeat 45 calls and guarantee.                                                                                                                                            | Use campaign-specific audit name, value, fit criteria, and expectations.                                                                                                                                                    |
| `AiSeoQualificationForm.tsx`                                                  | Only operational qualifiers are decision-maker and budget; all six niches submit the same answers.                                                                                          | Preserve short contact-first step, then add a vertical branch with economic-unit, capacity, bottleneck, and tracking-readiness questions. Avoid collecting sensitive case/health details.                                   |
| `packages/contracts/src/funnel-events.ts`                                     | Application schema can only store owner, budget, and optional investment intent.                                                                                                            | Add a versioned vertical-answer discriminated union keyed by funnel ID; preserve backward compatibility for in-flight events.                                                                                               |
| `apps/funnels/src/utils/funnelAnalytics.ts`                                   | Analytics can report generic qualification answers but has no explicit vertical segment, bottleneck, economic unit, experiment variant, calculator completion, or downstream quality event. | Add allowlisted events/properties for segment selected, calculator completed, form branch, experiment exposure, qualified lead, and booking show/outcome imports. Do not place PHI/confidential legal details in analytics. |
| `apps/funnels/src/funnels/ai-seo/components/thank-you/ConfirmationHero.astro` | Repeats the 45-call guarantee.                                                                                                                                                              | Replace with vertical audit preparation and required baseline data.                                                                                                                                                         |
| `apps/automations/src/email/precall-copy.ts`                                  | Pre-call sequence repeatedly frames calls as the main result and repeats the guarantee.                                                                                                     | Branch copy by funnel ID; ask for the niche’s 60–180 day funnel baseline and prime source-to-revenue diagnosis.                                                                                                             |
| `apps/automations/src/trigger/process-funnel-event.ts` and CRM destinations   | Booking is recorded, but later show/opportunity/revenue stages are outside the funnel contract.                                                                                             | Preserve booking flow; add CRM/imported lifecycle mapping for show, opportunity/case acceptance, won/collected revenue, and retention where relevant.                                                                       |

### Recommended content architecture

Do **not** clone six pages. Add a typed `VerticalFunnelConfig` consumed by shared components. Suggested top-level shape:

```ts
type VerticalFunnelConfig = {
  identity: {
    campaignKey: AiSeoCampaignKey;
    audience: string;
    auditName: string;
  };
  hero: {
    eyebrow: string;
    promise: string;
    subhead: string;
    primaryCta: string;
    secondaryCta?: string;
  };
  messageMatch: { adAngles: AdAngle[]; recognitionItems: string[] };
  economics: {
    unitName: string;
    stages: string[];
    calculator: CalculatorConfig;
  };
  proof: {
    requirements: ProofRequirement[];
    caseStudies: VerifiedProof[];
    pilotFallback: PilotProof;
  };
  objections: ObjectionResponse[];
  form: {
    initialFields: FieldConfig[];
    progressiveFields: FieldConfig[];
    prohibitedDataNote?: string;
  };
  claims: { remove: string[]; qualifiers: string[] };
  experiments: ExperimentConfig[];
};
```

The renderer should support vertical order changes. Med spas need retention/rebooking; hair restoration needs surgical/non-surgical branching; law firms need practice-area branching and confidentiality guardrails. A rigid identical section order with swapped nouns is still insufficient customization.

## 3. Shared funnel shell: keep common

These elements can stay common across all six routes:

1. **Static route/deployment plumbing:** campaign slug resolution, funnel IDs, per-route Meta pixels, PostHog, Turnstile, Cal booking, noindex, disclosure footer.
2. **Contact-first capture:** first name, work email, phone, hidden bot field, consent, email verification, attribution persistence.
3. **Working-session offer structure:** short audit/diagnostic; buyer leaves with a one-page leak map, visibility snapshot, and top three priorities whether or not they buy.
4. **Common leak visual primitive:** `Discovered → inquiry → contacted → booked → showed → business outcome`; labels after “showed” vary by niche.
5. **Common local-discovery module:** dated Google Maps/local organic/AI-answer snapshot showing query, geography, date/time, cited sources, and variability disclaimer.
6. **Common calculator engine:** user-entered variables, transparent formulas, low/base/high or sensitivity ranges, blank defaults, capacity warning, and “illustrative—not a guarantee.”
7. **Common proof-card schema:** vertical, market, starting baseline, timeframe, spend, definitions, work performed, operational dependencies, downstream outcome, source-system evidence, and caveats.
8. **Common objection themes:** “we tried an agency,” “lead quality is poor,” “our team is overloaded,” “our market is different,” “can you prove revenue,” and “is AI visibility real?” Responses and evidence must be niche-specific.
9. **Common progressive form behavior:** value/fit first; economics and systems second; never demand all fields before showing value.
10. **Common risk reversal:** keep the audit findings; own/access accounts and data; clear scope and exit terms; no ranking, case, patient, or revenue guarantee.
11. **Common measurement spine:** Meta/ad exposure → landing → form → qualification → booking → show → opportunity → collected revenue, joined by funnel ID, submission/prospect ID, campaign/ad IDs, and CRM record.

## 4. Cross-niche campaign matrix

| Niche            | Buyer JTBD                                                                          | Core economic unit                                                                    | Biggest likely leak to diagnose                                         | Primary message-match angle                                                           | Primary CTA                                          | Downstream truth event                                          |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Law firms        | Build predictable, suitable matters and prove source-to-signature economics         | Signed/retained matter; collected fee or expected case value with realization horizon | Intake response + qualification + attribution, varying by practice area | “Your agency reports calls. Your partners care about signed matters.”                 | **Map My Firm’s Lost-Matter Funnel**                 | Signed matter, then collected fees/realized value               |
| General dental   | Fill the right chair capacity with payer/service-fit patients who keep appointments | Kept appointment progressing to accepted/collected treatment                          | Missed calls, booking, no-shows, payer/service mismatch                 | “Before buying more leads, see where current calls stop becoming kept appointments.”  | **Get My Demand-to-Schedule Audit**                  | Kept appointment; accepted/collected treatment where integrated |
| Dental implants  | Turn implant demand into accepted, scheduled cases                                  | Accepted/scheduled implant case; collected production                                 | Consultation, financing clarity, follow-up after “need to think”        | “See where your next implant case is lost—from search to consultation and follow-up.” | **Map My Implant-Case Leaks**                        | Accepted/scheduled case, then collected production              |
| Plastic surgery  | Generate procedure-fit attended consults that become deposits/booked surgery        | Deposit or surgery booked; collected case revenue                                     | Procedure fit + consult attendance + financing/deposit                  | “Find the leak between inquiry and booked surgery for the procedures you want.”       | **Map My Case Leakage**                              | Surgery booked/deposit; collected revenue                       |
| Hair restoration | Fill consult capacity with viable, realistic, finance-ready candidates              | Booked surgical case; separate non-surgical start/LTV                                 | Clinical pre-screen + trust/comparison shopping + long nurture          | “Meta says leads; your coordinator says price shoppers.”                              | **Get My Consult-to-Case Leak Map**                  | Booked procedure or non-surgical start; contribution/LTV        |
| Med spas         | Acquire treatment-fit guests who show, buy, and return without discounting brand    | Kept treated visit and 12-month collected patient value                               | No-show/cancellation + treatment fit + rebooking/reactivation           | “More qualified consults that show—not another list of cheap leads.”                  | **Get My Local Patient-Demand & Revenue-Leak Audit** | Treated/collected visit; second rebook/90–180 day retention     |

## 5. Niche briefs

### 5.1 Law firms

**Source basis:** [LF], especially §§Executive conclusion; Practice-area differences; Intake leakage; Agency distrust; Ad-to-funnel implications; Calculator specification; Form questions; Claims to avoid; Messaging tests.

#### Buyer JTBD, economics, leak, and stakes

- **JTBD:** Create a predictable stream of matters the firm wants and can sign; prove which channel produced each matter; prevent intake failures and junk inquiries from consuming attorney/staff capacity.
- **Core economic unit:** qualified opportunity → attended consult → **signed/retained matter** → collected fee or realized case value. PI needs expected value and realization horizon separated from current cash; flat-fee/retainer work can use initial collected fee and contribution.
- **Biggest leak:** response/qualification/source-to-signature handoff. Clio’s cited 500-firm mystery-shop and owner anecdotes make intake leakage a credible diagnostic, but not a claim about every prospect.
- **Stakes:** getting “swindled,” wasting cash at incumbent-level spend, intake burnout, partners seeing marketing as overhead, and an established firm appearing less credible than a newer digital competitor.

#### Exact vocabulary to mirror

Use: **“lead quality and ROI,” “high-intent,” “qualified cases,” “qualified consultations,” “signed matters,” “retained clients,” “cost per signed case,” “price shoppers,” “free legal advice calls,” “intake,” “consult,” “retainer,” “ability to pay,” “practice area + location,” “source-to-signature attribution,” “authority-focused website.”** [LF §§Authentic VOC, Vocabulary]

Do not use “trash leads” or “tire kickers” in polite page copy even though they occur in VOC; translate them into wrong practice area, geography, timing, payment fit, or free-advice intent.

#### Hero, subhead, CTAs

- **Hero A:** **Turn marketing calls into attributable signed matters—not more price shoppers.**
- **Hero B:** **Find the leak between search, the first call, and signed retainer.**
- **Subhead:** “Get a practice-area-specific audit of visibility, response, qualification, consultations, and retained clients—modeled with your firm’s own economics.”
- **Primary CTA:** **Map My Firm’s Lost-Matter Funnel**
- **Secondary CTAs:** **Calculate Cost per Signed Matter**; **See a Sample Law-Firm Funnel Audit**; use **Audit Who Google and AI Surface** only on matching AI-visibility ads.

#### Ad-to-page message match

Default ad: **“Your agency reports calls. Your partners care about signed matters. Connect the two.”** Route practice-specific ads to matching recognition copy:

- Criminal: paying for directions/free advice/out-of-market calls.
- PI: model qualified and signed case economics before adding spend.
- Family: qualified consults and no-show leakage.
- Estate/probate: trust, process, fee clarity, and referral capture.
- Established/AI: digital-evidence gap versus newer firms, without “#1 in AI.”

Persist `practice_area` and `ad_angle` in query/attribution state so the hero, examples, and form branch match the ad.

#### Required proof

1. Comparable practice area, metro, firm size, starting authority, spend, intake model, and timeframe.
2. Source-system walkthrough: call tracking, GA4/Search Console, CRM/intake/case management, dispositions.
3. Full chain: inquiry → valid → qualified → consult scheduled/showed → signed → expected/collected value.
4. Negative evidence: junk rate, missed-call rate, loss reasons, campaigns stopped.
5. Account/data ownership, monthly scope, responsible owner, exit terms.
6. If comparable law-firm proof is absent, label as a pilot and show a sample audit artifact—not dental/cross-industry results.

#### Objection handling

- **“Agencies all suck.”** Show named ownership, exact scope, raw-system evidence, data portability, and exit terms.
- **“My phone already rings.”** Diagnose qualification, response, consult, close, and value—not volume.
- **“SEO costs as much as an associate.”** Compare signed-matter contribution/payback and asset ownership.
- **“We live on referrals.”** Add measurable capture for fluctuating months; do not position search as replacing trust.
- **“We tried Google/LSA.”** Separate channel quality from intake loss using dispositions.
- **“ChatGPT recommends newer firms.”** Audit observable sources/citations and dated outputs; do not promise recommendation control.

#### Recommended form questions

Initial progressive branch: role; primary practice area; market/state; attorney/intake headcount; can accept more qualified matters in 90 days; biggest leak. Then collect spend by channel, agency fee, inquiries, consults, signed matters, fee model/value range, after-hours coverage, response time, source-to-signature tracking, systems, and prior vendor reason lost. Add practice-specific conditional questions listed in [LF §Form questions]. Do not collect confidential facts, case merits, legal-advice details, or PHI.

#### Calculator

**Inputs:** practice area/market; fee model; media + program cost; inquiries; valid and qualified rates; contact/response; consult schedule/show; signed rate; initial collected fee or expected gross case value; margin; months to realization; capacity.

**Outputs:** cost per inquiry/valid/qualified/attended consult/signed matter; junk cost; leak count by stage; expected contribution and payback range; weakest-stage +10/20/30% sensitivity; capacity warning. Clearly distinguish expected PI value from collected revenue.

#### Risky claims to remove

Remove unconditional 45-call/90-day claim; guaranteed cases/revenue/ROI; guaranteed #1/map pack/LSA/ChatGPT; control of ChatGPT; universal CPC/CPL/close rates; all-attributed revenue; causal claims from correlational Clio figures; fake/composite testimonials; ethics-insensitive solicitation/outcome language. Require jurisdiction-specific legal-ad review. [LF §Claims to avoid]

#### Three highest-priority experiments

1. **Signed matters vs calls:** current hero against “see cost per signed matter and where qualified prospects disappear”; judge qualified booking, show, opportunity, and close.
2. **Leakage-first vs traffic-first:** “get leads” against “find the leak before buying traffic,” segmented by current spend and intake capacity.
3. **Practice-area message match:** generic qualified leads against criminal/PI/family/estate-specific negative VOC; judge cost per sales-accepted opportunity, not CTR.

### 5.2 General dental practices

**Source basis:** [DP], especially §§Executive summary; Insurance tension; Suitable patients; Front-desk leakage; Agency distrust; Authentic vocabulary; Ad-to-funnel implications; Funnel/calculator/form; Claims; Messaging experiments.

#### Buyer JTBD, economics, leak, and stakes

- **JTBD:** Fill the right seats with service- and payer-fit patients, protect already-paid demand, and trace source through booking, show, acceptance, and collections without overloading staff.
- **Core economic unit:** **kept new-patient appointment**, then accepted/started treatment and collected production; include recall/household/referral value where available.
- **Biggest leak:** answer/contact → booking → show, complicated by payer/service mismatch and uneven hygiene/doctor capacity.
- **Stakes:** overhead and reimbursement pressure, empty chair time, wrong payer/service mix, no-shows, staff overload, and agencies whose “metrics never seemed to translate to more new patients.”

#### Exact vocabulary to mirror

Use: **“high quality new patients,” “case patients,” “cash flow,” “fill the seats,” “control your margins,” “watch your overhead,” “track, track, track EVERY NP,” “booked and kept appointments,” “payer and service fit,” “open chair time,” “from search to schedule,” “protect the demand you already paid for.”** [DP §§Authentic vocabulary]

Avoid calling insurance patients low-value or patients “wrong crowd/penny pinchers.” Respectfully qualify payer/network fit, service, geography, urgency, and financial pathway.

#### Hero, subhead, CTAs

- **Hero:** **Turn local demand into more of the patients your practice actually wants.**
- **Subhead:** “See where visibility, calls, bookings, and kept appointments leak—across Google, AI search, your website, and your front desk.”
- **Primary CTA:** **Get My Demand-to-Schedule Audit**
- **Secondary CTA:** **See What the Audit Measures**
- **Final CTA:** **Show Me Where Qualified Patients Are Falling Out**

#### Ad-to-page message match

Control angle: **“Before you buy more leads, see where your current calls stop becoming appointments.”** Branch by trigger: added doctor/open hygiene, desired service line, PPO/FFS transition, no-show problem, failed agency, or multi-location variance. The corresponding landing route must echo that trigger above the fold and set matching default selections.

#### Required proof

Practice-specific Google/Maps/AI query snapshot; review quantity/recency/themes; service/payer-message gap; inquiries by source; answer/missed-call and response baseline; booked vs kept appointments; accepted/started/collected where connected; comparable practice by ownership, market, payer strategy, desired service and capacity; definitions/timeframe/source beside every result. Do not generalize one vendor call study as an industry benchmark.

#### Objection handling

- **“SEO is a waste.”** Show source → booking/kept appointment and limits, not rankings alone.
- **“We tried Facebook/Google.”** Segment by offer, payer/service fit, booking, show, acceptance, collections.
- **“My team cannot handle leads.”** Ask open capacity and add missed-call/overflow/follow-up safety net.
- **“We already have reviews.”** Connect review themes/recency to desired services and conversion.
- **“We are PPO/FFS/Medicaid.”** Tailor economics and policy assumptions; do not moralize payer mix.
- **“ChatGPT is hype.”** Show dated local query samples and cited-source gaps as one discovery layer.

#### Recommended form questions

Practice type/location count/role/service area; desired services; payer mix to grow; open hygiene/doctor/service/day capacity; additional kept-appointment capacity; primary bottleneck; monthly inquiries/booked/kept; call recording; source tracking; missed-call follow-up; marketing spend/vendor renewal; 90-day win definition. Branch before deeper economics. [DP §Recommended form questions]

#### Calculator

**Inputs:** inquiries; contact/answer rate; booking rate; show rate; treatment-start rate; 12-month collections per desired patient; margin/variable cost; spend.

**Outputs:** contacted, booked, showed, started, estimated collections/contribution, cost per booked/showed, break-even showed patients, and sensitivity ranges. Segment by service/payer/promotion. Never convert a vendor benchmark into a default.

#### Risky claims to remove

Remove unconditional 45 calls; guaranteed patients/revenue; stable ChatGPT comparison; #1 rankings; universal missed-call numbers; anti-insurance claims; universal anti-discount claims; front-desk blame; channel-replacement claims; vanity proof; fake scarcity; medical outcome/case-acceptance promises. [DP §Claims and positioning to avoid]

#### Three highest-priority experiments

1. **Kept patients vs calls:** “45 calls” against “patients your practice wants” / “kept appointments for desired service and payer mix.”
2. **Leak-first CTA + calculator:** current form-first “visibility audit” against a short demand-to-schedule leak calculator with the full report gated.
3. **Trigger routes:** added doctor/open hygiene, PPO transition, desired service, and missed-call/no-show branches against generic dental growth.

### 5.3 Dental implants

**Source basis:** [DI], especially §§Executive conclusion; Practice economics; Cost/financing anxiety; Consultation quality; Lead quality/follow-up; Landing structure; Form questions; Claims; Messaging tests; First-party research.

#### Buyer JTBD, economics, leak, and stakes

- **JTBD:** Find and repair the highest-value break between implant discovery, contact, consult, acceptance, financing, scheduling, and collection while matching procedure mix and capacity.
- **Core economic unit:** **accepted/scheduled implant case**, then collected production. Keep single, multiple, overdenture, and full-arch paths separate.
- **Biggest leak:** consultation clarity/acceptance and post-consult follow-up, including cost/financing uncertainty—not merely inquiry scarcity.
- **Stakes:** expensive coordinator/clinician time, unscheduled treatment, fear that “leads” are shoppers, staff inconsistency, and losing a valuable case because complexity, discomfort, time, or expense remained unresolved.

#### Exact vocabulary to mirror

Use buyer language: **“scheduling needed care,” “treatment plans sitting unscheduled,” “follow-ups happening on time,” “same message from every team member,” “accepted/scheduled case,” “qualified consultation,” “case acceptance,” “treatment coordinator,” “financing,” “collected production.”** Patient-friction words supported by the report: **“complexity, discomfort, time and expense,” “unexpected costs,” “pain, outcomes, or the unknown,” “I need to think about it.”** [DI §§Cost anxiety, Consultation quality, Buyer/patient VOC]

Do not label every affordability question low quality; distinguish serious intent with uncertainty from lack of fit/readiness.

#### Hero, subhead, CTAs

- **Hero:** **See Where Your Next Implant Case Is Being Lost**
- **Subhead:** “Get a local implant-demand audit across Google, AI search, lead response, consultation booking, financing clarity, and follow-up—then see which fix could carry the highest case value.”
- **Primary CTA:** **Map My Implant-Case Leaks**
- **Secondary CTA:** **See a Sample Case-Leak Map**
- **Booking CTA:** **Book My Implant Growth Diagnostic**

#### Ad-to-page message match

Primary ad: **“What would one more accepted implant case per month be worth—and where are current inquiries falling out?”** Test against competitor-visibility curiosity. The landing page must immediately repeat the selected leak: not enough qualified consults, low booking/show, low acceptance, unscheduled plans/follow-up, unused provider capacity, or attribution unknown.

#### Required proof

Dated Maps/organic/AI query logs; source → two-way contact → booked consult → show → accepted/scheduled → collected; qualified-consult and accepted-case CAC; response-time distribution and loss reasons; follow-up completion; comparable case study with practice model, geography, procedure mix, spend, timeframe, operational changes, definitions, and caveats. If PulpSense lacks this, use transparent audit deliverables and a pilot label.

#### Objection handling

- **“Leads are price shoppers.”** Show treatment intent, stage, affordability path, and contactability; do not treat cost anxiety as automatic disqualification.
- **“We need more leads.”** First quantify current contact, booking, show, acceptance, financing, and follow-up losses.
- **“Our cases are different.”** Branch by practice model and procedure mix; use practice-entered case values.
- **“Our team is short-staffed.”** Diagnose owner, response coverage, coordinator capacity, scripts, and follow-up ownership before scale.
- **“Ranking reports do not mean cases.”** Report qualified-consult and accepted/scheduled-case CAC.
- **“Can you guarantee cases?”** Explain what PulpSense controls, what the practice controls, and range-based modeling.

#### Recommended form questions

Target implant treatments; practice model; locations/providers/ZIP; main constraint; monthly consults and scheduled cases; extra monthly capacity; optional collected-production bands by case type; spend/channels; response owner and coverage; first-human-response band; PMS/CRM/call tracking; stages tracked by source; coordinator presence; financing options and presentation stage; process after “I need to think about it”; prior agency experience. [DI §Recommended form questions]

#### Calculator

**Inputs:** inquiries; contact, booking, show, acceptance, financing/collection realization; procedure mix; average collected production per accepted case; monthly case capacity; spend; optional variable cost/margin.

**Outputs:** expected scheduled cases; collected production (not profit unless costs entered); value lost by stage; allowable inquiry/consult acquisition cost; accepted-case CAC; capacity warning; low/base/high sensitivities. Leave defaults blank and label all results user-entered estimates.

#### Risky claims to remove

Remove 45 implant calls/90 days; guaranteed calls/patients/cases/rankings/revenue; “Google/ChatGPT recommends you first”; universal case value or acceptance rate; financing approval/0% without lender disclosure; pain-free/same-day/permanent/lifetime/universal candidacy; competitor/overseas superiority; medical-tourism fear; CPL as success proof. [DI §Claims to avoid]

#### Three highest-priority experiments

1. **Qualified consult/accepted case vs call count:** judge qualified-consult CAC and accepted-case yield.
2. **Case-leak diagnostic vs competitor ranking audit:** judge booked diagnostic, show, and sales-qualified opportunity—not audit curiosity alone.
3. **One-case economics vs 45-call volume:** “what is one more accepted case worth?” with user-entered calculator against current guarantee.

### 5.4 Plastic surgery

**Source basis:** [PS], especially §§Executive readout; Evidence ledger; Buyer language; Pains/proof; Funnel architecture; Calculator; CTA/form; Claims; Messaging tests.

#### Buyer JTBD, economics, leak, and stakes

- **JTBD:** Generate procedure-fit, physically/emotionally/financially ready consultations; get them to attend; provide enough trust/cost clarity to reach an ethical deposit/booked-surgery decision; attribute revenue by procedure.
- **Core economic unit:** **qualified attended consult → deposit/surgery booked → collected case revenue**, segmented by target procedure.
- **Biggest leak:** fit/response/consult attendance followed by financing/deposit; a high non-close rate can also reflect appropriate clinical/ethical disqualification.
- **Stakes:** coordinator time lost to wrong-procedure or low-readiness inquiries, no-shows, financing friction, reputation and aftercare risk, generic-agency distrust, and pressure to grow profitable procedure mix without unsafe selling.

#### Exact vocabulary to mirror

Use: **“qualified consults,” “surgery-ready,” “finance-ready,” “procedure mix,” “consult-to-close,” “deposit collected,” “case value,” “source-to-surgery attribution,” “physically, emotionally, and financially ready,” “volume over fit,” “no clear accountability,” “hard-to-exit contract.”** Patient questions to reflect as inferred copy, not verbatim survey answers: **“What will this cost?” “Who handles my follow-up?” “What happens if there is a complication?” “How long is recovery?”** [PS §§Buyer language, Evidence ledger]

Avoid “tire-kickers.” Use research-stage, timing-misaligned, clinically unsuitable, expectation-misaligned, or financing-constrained.

#### Hero, subhead, CTAs

- **Hero:** **See Where High-Value Plastic-Surgery Cases Leak**
- **Subhead:** “Get a procedure-level acquisition audit across local/AI visibility, first response, consult attendance, financing, deposit, and booked surgery.”
- **Primary CTA:** **Map My Case Leakage**
- **Secondary CTA:** **See My Competitive Visibility**
- **Offer framing:** 20-minute diagnostic plus a one-page case-leak/visibility map—not a vague strategy call.

#### Ad-to-page message match

Default: **“Find the leak between inquiry and booked surgery for the two procedures you actually want to grow.”** Test procedure-specific ads and route hero/proof/calculator accordingly. Competitor-visibility ads should land on a time-stamped shortlist/reputation snapshot but still bridge to attended consult and booked surgery.

#### Required proof

Procedure-level source → inquiry → response → booked → attended → qualified → financing/deposit → surgery booked → collected revenue; baseline/after response time, show rate, consult-to-deposit, booked-case value; dated local/AI/review gap evidence; operational follow-up/reminder/reschedule workflow; specialty-relevant case study; data ownership and exit terms; clinical guardrails making clear marketing does not override surgeon candidacy.

#### Objection handling

- **“Meta produces low-fit shoppers.”** Show procedure/geography/timing/readiness qualification and cost per attended qualified consult.
- **“Our coordinator cannot handle volume.”** Diagnose after-hours response, self-scheduling, reminders, reschedule, and handoffs before adding spend.
- **“Patients ask price and disappear.”** Add transparent range/inclusions/financing expectations without bait pricing or pressure.
- **“Reviews and outcomes are enough.”** Show that communication, staff, billing, scheduling, recovery, and aftercare are conversion/reputation factors.
- **“Agencies create generic content.”** Show specialty-specific plan, named owner, timeline, account/data ownership, and portable reporting.
- **“Can you close everyone?”** No; fit/readiness and ethical clinical selection remain required.

#### Recommended form questions

Two procedures to grow; monthly inquiries for them; biggest leak; response-time band; whether attended consult/deposit/surgery revenue are tracked; financing timing; recent trigger; URL and ZIP/market. On the booking page ask whether the useful outcome is more qualified consults, fewer leaks, clearer attribution, or competitive visibility. Do not solicit sensitive health details on this B2B marketing form. [PS §CTA and form questions]

#### Calculator

**Inputs:** inquiries by target procedure; all-in case revenue or deposit; first response; contact; booking; show; qualified; consult-to-deposit/booked rate; financing offered/approval where appropriate.

**Outputs:** expected booked cases; expected booked revenue; leak value by stage; cost per attended qualified consult/booked case; show-rate/close-rate sensitivity. Never seed universal industry rates.

#### Risky claims to remove

Remove 45 calls/90 days; guaranteed surgery/revenue/rankings/AI recommendations; five-minute response expectations not supported by this report; universal conversion benchmarks; every lead is a case; review gating/manipulation or implied clinical superiority; cheap-price minimization; unqualified HIPAA/compliance claims. [PS §Claims to avoid]

#### Three highest-priority experiments

1. **Cases vs calls:** booked-surgery leakage hero against current call promise.
2. **Procedure specificity:** two target procedures and matched proof against generic plastic-surgery growth.
3. **Commercial proof:** full source-to-surgery chain against ranking screenshots/cross-industry logos; judge opportunity rate and sales objection rate.

### 5.5 Hair restoration

**Source basis:** [HR], especially §§Executive synthesis; Evidence ledger; Economics; VOC dictionary; Buyer jobs; Funnel action plan; Calculator; Form; Claims; Messaging tests; Research gaps.

#### Buyer JTBD, economics, leak, and stakes

- **JTBD:** Fill consult capacity with viable donor/candidacy profiles, realistic expectations, sufficient budget, and enough trust to choose the surgeon; nurture long-cycle shoppers; distinguish surgical from recurring non-surgical value.
- **Core economic unit:** **booked surgical procedure**; for non-surgical pathways use separate treatment start and retention/LTV.
- **Biggest leak:** clinical pre-screen + comparison-shopping trust + long-cycle nurture, amplified by financing and overseas price comparison.
- **Stakes:** wasting coordinator/surgeon capacity, attracting price-only or clinically unsuitable inquiries, losing months-long shoppers to a competitor/overseas clinic, risking donor/outcome reputation, and misvaluing non-surgical prospects as surgeries.

#### Exact vocabulary to mirror

Use patient language: **“natural looking ‘mature’ hairline,” “best surgery and end result,” “I am not playing dice with MY head,” “4 online consultations,” “several months to find the surgeon,” “good candidate,” “excellent donor supply,” “how much money I need to set aside,” “lowest rate.”** Buyer language: **“qualified consult,” “viable candidate,” “attended consult,” “show rate,” “treatment plan,” “booked case,” “coordinator follow-up,” “financing-ready,” “surgeon capacity,” “donor management.”** [HR §§VOC dictionary, Evidence ledger]

#### Hero, subhead, CTAs

- **Hero:** **How Many Qualified Hair-Restoration Cases Are Hiding Inside the Leads You Already Pay For?**
- **Subhead:** “Map the leaks from inquiry and photo-ready pre-screen to attended consult, treatment plan, financing, and booked case—while seeing which competitors patients encounter during research.”
- **Primary CTA:** **Get My Consult-to-Case Leak Map**
- **Secondary CTA:** **See Who Patients Find Before Your Practice**

#### Ad-to-page message match

Primary ad: **“Your Meta report says ‘leads.’ Your coordinator says ‘price shoppers.’”** The page must repeat that line and immediately show the path: inquiry → contact → photo/pre-screen → consult booked → attended → treatment plan → finance → case. Separate surgery-only and mixed surgical/non-surgical campaigns. Treat medical tourism through local continuity/accountability, never fear or nationality-based attacks.

#### Required proof

Full funnel with dispositions; definition of clinically plausible/qualified without diagnosing online; median/range and timeframe; response/show/consult-to-case/booked-case cost; reconciled CRM/revenue; vertical creative examples; surgeon role/credentials and comparable standardized before/after context; follow-up/repair/continuity; surgical vs non-surgical economics.

#### Objection handling

- **“Leads are just price shoppers.”** Ask candidacy/timeline/budget path and provide range logic; distinguish research from no intent.
- **“Turkey is cheaper.”** Contrast local assessment, named surgeon involvement, conservative donor planning, complication/repair process, and follow-up—without safety superiority claims.
- **“Prospects consult everyone.”** Make the consult produce a differentiated written plan, not just a quote.
- **“They take months.”** Use 6–12 month attribution/nurture and do not optimize only same-week booking.
- **“We cannot know candidacy from a form.”** Correct; use non-diagnostic pre-screen and route to clinician review.
- **“What about PRP/medical therapy?”** Track as a separate recurring path with its own value and retention.

#### Recommended form questions

Role, locations/service radius, inquiries by source, booked and attended consults, surgical cases and non-surgical starts separately, biggest leak, CRM/call tracking/dispositions, optional surgical revenue and contribution ranges, capacity, consent for public visibility/call-disposition audit. A downstream patient pre-screen may ask age band, area/duration/stability, current treatment, prior procedure, timeline, financing openness, and willingness to send photos with a clear “not a diagnosis” statement. [HR §CTA and form questions]

#### Calculator

**Inputs:** surgical leads; contact; clinically plausible/qualified; consult booking/show; close; contribution per case; unqualified/unreachable count; follow-up minutes and loaded labor; no-show rate/recoverable share; separate PRP/medical visits, retention, and surgery-conversion assumptions.

**Outputs:** surgical lost-case contribution; cost per attended consult/booked case; coordinator waste; no-show recovery scenario; mixed-path 12-month LTV. Do not apply the surgical ticket to all leads or use gross revenue as contribution.

#### Risky claims to remove

Remove 45 calls; guaranteed graft/candidacy/density/permanency/timing; “best,” scarless, pain-free, risk-free, no downtime, universal effectiveness; stable ChatGPT rank; universal ROI from gross fee; insurance implication; fear attacks on medical tourism; cherry-picked/inconsistent before-and-afters. [HR §Claims to avoid]

#### Three highest-priority experiments

1. **Qualified attended consult vs calls:** judge sales-accepted booking and booked-case yield.
2. **Coordinator VOC hook:** “Meta says leads; coordinator says price shoppers” against generic growth.
3. **Leak-map CTA vs visibility audit/demo:** judge booked-call show and opportunity rate; separately monitor free-audit curiosity.

### 5.6 Med spas

**Source basis:** [MS], especially §§Executive takeaway; Economics; VOC language; Triggers/objections; Ad-to-funnel match; Calculator/form; Claims; Messaging hypotheses.

#### Buyer JTBD, economics, leak, and stakes

- **JTBD:** Turn local treatment-specific demand into qualified consults/appointments that show, buy, and return; fill provider/device capacity without discount dependence; prove revenue by treatment.
- **Core economic unit:** **kept treated visit and collected revenue**, then second rebook/membership/90–180 day retention and 12-month patient value.
- **Biggest leak:** booking-to-show/cancellation plus one-and-done retention; reactivation may beat additional acquisition in some practices.
- **Stakes:** Groupon-style discount traffic, agency/“AI ads” distrust, unused provider/device capacity, cancellations, weak same-store growth, brand/medical credibility, and no source-to-revenue visibility.

#### Exact vocabulary to mirror

Use operator words: **“booked consults,” “qualified patients,” “show rate,” “cancellation/no-show,” “rebook,” “second rebook,” “membership,” “treatment plan,” “chair/provider utilization,” “average ticket,” “collected revenue,” “new vs existing guests,” “reactivation,” “deposit,” “medical director,” “injector,” “before-and-after,” “reviews,” “attribution,” “ROI.”** Use patient proof language: **“clean,” “professional,” “not pushy,” “no selling,” “took her time listening,” “explain everything,” “comfortable and confident,” “never felt rushed or pressured,” “licensed and trained.”** [MS §§VOC language bank]

Do not lead with traffic, impressions, engagement, AI ads, calls, or generic visibility.

#### Hero, subhead, CTAs

- **Hero:** **More Qualified Consults That Show—Not Another List of Cheap Leads.**
- **Subhead:** “See which treatments and competitors own local demand, where booked revenue leaks through response, cancellation, and follow-up, and what could bring the right patients back.”
- **Primary CTA:** **Get My Local Patient-Demand & Revenue-Leak Audit**
- **Secondary CTA:** **See My Treatment-Level Revenue Map**
- **Microcopy:** “Get the first three fixes without committing to another lead-gen retainer.”

#### Ad-to-page message match

Run separate angles for show rate, anti-agency attribution, anti-discount, rebooking, local competition, unused provider/device capacity, medical trust, and reactivation. Persist treatment line and angle so the landing page uses the same language and calculator path. A reactivation ad must not land on a page whose only promise is new calls.

#### Required proof

Treatment-level source → qualified → booked → showed → treated → collected → rebooked; new versus existing guest; baseline and after; capacity; spend; treatment; market; revenue and repeat window; provider credentials/medical oversight/authorized product evidence supplied and approved by client; consented contextual before-and-afters; ethical reviews; dashboard and data ownership. If unavailable, clearly label proof gap.

#### Objection handling

- **“We tried agencies/AI ads.”** Show treatment-level source-to-revenue dashboard, account ownership, and 30/60/90 plan.
- **“Meta brings cheap shoppers.”** Use treatment/service-area/timeline/budget fit, non-discount creative, and deposit/consult policy.
- **“Leads do not answer/show.”** Show response SLA, booking handoff, reminders, deposit/reschedule/no-show recovery.
- **“Front desk is overloaded.”** Clarify response owner, coverage, escalation, and calendar integration.
- **“Can you prove revenue?”** Reconcile POS/CRM collected revenue—not booked calls.
- **“Will this hurt our medical brand?”** Use compliance review, credentials, no clinical guarantees, and ethical review policy.
- **“Our market is different.”** Use a live local treatment/reputation/competitor snapshot.

#### Recommended form questions

Role; location/service radius; priority treatments; average collected ticket/range; open weekly provider/device capacity; monthly inquiries/bookings/show; biggest leak; channels/spend; booking/CRM/POS; deposit/cancellation/reminders; medical director/provider licensure status framed as operational fit—not legal advice; pilot timing/decision makers. [MS §Lead form]

#### Calculator

**Inputs:** service line; first-ticket; optional contribution; consult-to-treatment; show; qualified inquiries; response/booking; repeat visits/12-month value; open slots; cancellation/no-show; spend.

**Outputs:** kept appointments; first-treatment and 12-month collected revenue; break-even qualified consults; revenue lost to no-shows; capacity required; rebooking/reactivation sensitivity. Separate injectables/repeat path from higher-ticket course/device path.

#### Risky claims to remove

Remove unqualified 45 calls; guaranteed patients/revenue/clinical outcomes; permanent ChatGPT recommendations; cheap-CPL hero; unverified #1/best/safest/board-certified; fake/purchased/gated/sentiment-conditioned reviews or undisclosed testimonials; sensitive-health targeting/PHI uploads; revenue math treating fees/tickets/bookings as profit. [MS §Claims and angles to avoid]

#### Three highest-priority experiments

1. **Show/treatment revenue vs calls:** qualified consults that show against 45 calls.
2. **Treatment-specific capacity vs generic med-spa growth:** injectables/device/body/skin branches with open-capacity proof and economics.
3. **Acquisition-only vs acquisition + rebook/reactivation:** judge 90/180-day collected revenue and second-rebook rate, not only booked consults.

## 6. Prioritized implementation backlog

Scores are relative and directional: **Impact** estimates likely effect on qualified-booking/opportunity economics; **Effort** estimates design/engineering/data burden. Validate with real Meta and CRM outcomes.

| Priority | Change                                                                                                                                                                       | Expected impact                        | Effort      | Why now / acceptance criterion                                                                                                  |
| -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
|       P0 | Remove/disable the hard-coded 45-call, #1 Google/ChatGPT, and results-guaranteed copy across hero, guarantee, qualification, FAQ, comparison, thank-you, and pre-call emails | Very high                              | Low–medium  | Every route stops making the least defensible promise; campaign-specific bounded copy renders end to end.                       |
|       P0 | Make hero/subhead/CTA/recognition strip props-driven from the campaign registry                                                                                              | Very high                              | Medium      | Six routes visibly communicate six economic units; ad angle can select matching variant.                                        |
|       P0 | Replace generic form qualification with short niche branches: segment, desired economic unit, capacity, biggest leak, and tracking readiness                                 | Very high                              | Medium–high | CRM receives structured vertical fields; qualification no longer equals only owner + `$1,500+` budget.                          |
|       P0 | Add experiment IDs and preserve `funnel_id`, ad/creative IDs, niche segment, and angle through booking/CRM                                                                   | Very high                              | Medium      | Every qualified lead, booking, show, and opportunity can be joined back to a variant.                                           |
|       P1 | Replace cross-industry results with a verified vertical proof registry and honest pilot fallback                                                                             | High                                   | Medium      | No route displays irrelevant proof as if comparable; every proof card includes denominator, timeframe, definitions, and source. |
|       P1 | Add reusable leak-map component with configurable stages and self-selection                                                                                                  | High                                   | Medium      | Selector drives page copy, form defaults, sales context, and analytics.                                                         |
|       P1 | Add shared range-based calculator engine with niche schemas                                                                                                                  | High                                   | High        | User can edit assumptions; formulas visible; no default benchmark masquerades as truth; capacity warning works.                 |
|       P1 | Branch qualification/contract payloads by funnel ID with schema versioning                                                                                                   | High                                   | High        | New vertical answers reach automations/CRM without breaking old submissions or lifecycle events.                                |
|       P1 | Replace generic comparison/offer/process sections with outcome chain, data ownership, audit deliverables, and vertical objections                                            | High                                   | Medium      | Each route explains visibility as a mechanism connected to its commercial endpoint.                                             |
|       P1 | Branch thank-you preparation and pre-call nurture by funnel ID                                                                                                               | High                                   | Medium      | Buyer arrives with relevant baseline data and no longer receives generic call-guarantee emails.                                 |
|       P2 | Add CRM lifecycle mapping for showed meeting, sales-qualified opportunity, won/lost reason, collected revenue, and retention imports                                         | Very high long-term                    | High        | Dashboard can distinguish cheap leads from commercial outcomes and train Meta/offline optimization when volume permits.         |
|       P2 | Add practice/treatment sub-routes (law practice area; dental service/payer; surgery procedure; hair path; med-spa treatment)                                                 | High                                   | High        | Top-volume ad sets get exact message match without cloning pages.                                                               |
|       P2 | Add vertical proof assets, sample audit visuals, and calculator screenshots                                                                                                  | Medium–high                            | Medium–high | Credible artifact-based selling replaces generic logos and vanity ranking cards.                                                |
|       P3 | Personalize section order based on bottleneck and buyer role                                                                                                                 | Medium                                 | High        | Manager sees operations first; owner sees economics first; only after P0/P1 produce enough traffic.                             |
|       P3 | Feed offline opportunity/revenue signals back to Meta                                                                                                                        | High if volume/data quality sufficient | High        | Only after event definitions, consent, match quality, lag, and deduplication are verified.                                      |

### Recommended first release scope

Ship one meaningful verticalized release, not six superficial noun swaps:

1. typed campaign copy + leak stages + CTA for all six;
2. remove risky generic guarantee everywhere, including thank-you and pre-call;
3. vertical form branch with 4–6 high-information questions;
4. verified-proof/pilot fallback;
5. experiment exposure + booked/showed/opportunity linkage;
6. launch two high-volume niches first while retaining all six configurations.

Choose the first two launch niches from current Meta spend and sales-opportunity data—not assumptions. If data are unavailable, a pragmatic default is **law firms + general dental** because their reports contain strong owner VOC and clear operational leakage evidence, while implant/plastic/hair/med-spa routes require tighter clinical/procedure proof controls.

## 7. Measurement plan and event definitions

### 7.1 Required funnel stages

| Stage                                  | Definition                                                                                                                                                                                          | Source of truth           | Primary rate/cost                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| Landing view                           | Valid page view with campaign/variant identified                                                                                                                                                    | PostHog/server logs       | Cost per landing view; diagnostic only                  |
| Lead/contact                           | Contact accepted and deduplicated; not yet fit-qualified                                                                                                                                            | Funnel event/CRM person   | **CPL** = spend ÷ accepted leads                        |
| Qualified lead                         | Meets predeclared vertical fit: decision access, relevant business model/segment, economic capacity/open capacity, non-disqualifying need, and tracking/data willingness; definition version stored | Application payload + CRM | **CPQL** = spend ÷ qualified leads; lead→qualified rate |
| Booked call                            | Valid Cal booking linked to submission/prospect                                                                                                                                                     | Booking event             | Cost per booking; qualified→book rate                   |
| Showed call                            | Prospect attended enough of the scheduled diagnostic for discovery; exclude reschedule/cancel/no-show                                                                                               | Cal/CRM activity          | Cost per show; booking show rate                        |
| Sales-qualified opportunity            | Sales confirms fit, pain, authority/process, timing, and plausible economics; stage definition consistent by niche                                                                                  | CRM opportunity           | Cost per opportunity; show→opportunity rate             |
| Opportunity accepted / case acceptance | **PulpSense commercial event:** proposal accepted/contract signed. **Client downstream event:** use niche-specific patient/client unit below and never mix the two                                  | CRM + client system       | Opportunity win rate; customer acquisition cost         |
| Collected revenue                      | Cash actually collected, net definition explicit; keep expected/booked value separate                                                                                                               | Finance/CRM/client PMS    | Collected CAC/ROAS/contribution/payback                 |
| Retention                              | PulpSense client active at 60/90 days; for med spa/non-surgical paths, patient rebook/return in defined window                                                                                      | CRM/billing/POS/PMS       | Logo/revenue retention; second rebook/90–180 day return |

### 7.2 Niche-specific downstream events

| Niche            | Qualified lead for PulpSense                                                                                    | Client-side outcome events to request                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Law              | Relevant practice/market, can accept matters, decision/operational access, measurable acquisition spend or plan | valid/qualified inquiry, consult booked/showed, signed matter, expected value, collected fees, realization date           |
| General dental   | Desired service/payer/capacity defined; owner/manager/growth access; enough inquiry/schedule data               | booked NP, kept NP, accepted/started treatment, collected production, recall/household retention                          |
| Implants         | Target procedures/capacity defined; coordinator/tracking readiness                                              | contacted, consult booked/showed, accepted, financed where appropriate, scheduled, collected by case type                 |
| Plastic surgery  | Target procedures/capacity; tracks or will track attended consult/deposit                                       | contacted, consult booked/showed, qualified/declined reason, deposit, surgery booked, collected, cancel/refund            |
| Hair restoration | Surgical vs non-surgical path and capacity clear; disposition tracking                                          | contacted, pre-screen complete, consult booked/showed, plan, booked surgery or non-surgical start, contribution/retention |
| Med spa          | Priority treatments/open capacity; booking/POS access; compliant provider operation                             | qualified booked, showed, treated, collected, second rebook, membership, 90/180-day return/reactivation                   |

### 7.3 Experiment reporting rules

Report weekly leading indicators and monthly/quarterly lagging outcomes by `funnel_id × campaign × ad_set × creative × landing_variant × segment × bottleneck`:

- spend, impressions, CTR, landing views;
- contact leads and CPL;
- qualified leads, CPQL, and qualification reasons;
- bookings, cost per booking, and booking rate;
- shows, cost per show, and show rate;
- opportunities, cost per opportunity, and show→opportunity rate;
- wins, customer acquisition cost, expected contribution/payback;
- collected revenue and retention when mature;
- loss/disqualification reasons and sales hours consumed.

**Winner hierarchy:** collected contribution/retained value > won opportunity > sales-qualified opportunity > showed qualified booking > qualified lead > raw lead. Do not call a winner from CTR or CPL when downstream sample is immature.

Use a predeclared minimum observation window that covers the niche’s lag. Hair restoration and implant/plastic surgery require longer assisted-conversion windows than a basic dental appointment; law contingency matters require expected and realized value tracked separately. Report counts and confidence/uncertainty, not only percentages.

### 7.4 Data and privacy guardrails

- Preserve `submissionId`, `prospectId`, funnel ID, first/last touch, Meta click/browser IDs, and CRM IDs with deterministic deduplication.
- Store experiment exposure and definition version at event time; do not infer later from current page config.
- Do not put legal case facts, medical symptoms/photos, treatment diagnosis, financing details, PHI, or sensitive health in PostHog/Meta events.
- Keep B2B qualification separate from any downstream patient pre-screen. Use appropriate client-owned compliant systems for patient data.
- Distinguish `booked_value`, `expected_value`, `collected_revenue`, and `contribution`; never label them interchangeably as ROI.
- Record cancellations, reschedules, refunds, disqualification reasons, and missing attribution rather than silently excluding them.

## 8. Evidence gaps requiring first-party validation

### Cross-niche gaps

1. **PulpSense vertical proof:** raw denominator data for impressions → contact → qualified → booked → showed → opportunity/won and client-side revenue. Current landing proof is cross-industry and call/rank based.
2. **Current funnel baselines:** CPL, CPQL, booking, show, opportunity, win, sales hours, and retention by the six funnel IDs and by creative.
3. **“45 calls” substantiation:** exact call definition, incrementality, baseline, media conditions, client distribution, exclusions, and typical-results disclosure. Until verified/legal-reviewed, remove it from the primary experience.
4. **Buyer-language validation:** 5–8 interviews per niche/model plus sales-call coding to confirm which phrases and triggers convert, especially where reports mark inference.
5. **AI-search purchase salience:** whether it produces qualified buyers or free-audit curiosity; measure separately from the leak/economics offer.
6. **Comparable proof threshold:** which context dimensions buyers require before trusting a case study.
7. **Form friction:** whether vertical questions improve opportunity yield enough to offset lower form completion.
8. **Data availability:** which client CRMs/PMS/POS/case systems can reliably return show, acceptance, collected revenue, and retention.

### Niche-specific gaps

- **Law:** PulpSense signed-matter results by practice/market; exact qualification definitions; ethical/legal-ad review; cost and close distributions; source-to-signature reliability; B2B-law route viability. [LF §§Evidence limits, Final confidence]
- **General dental:** broader missed-call/booking leakage beyond one vendor case; best trigger segment; AI visibility salience; source→kept→accepted/collected integration; promotion/payer economics. [DP §Evidence limits]
- **Implants:** direct buyer/patient interviews; speed-to-lead response curve; agency-distrust prevalence; full-arch neutral economics; accepted-case CAC; medical-tourism prevalence. [DI §§Evidence status, First-party plan]
- **Plastic surgery:** specialty-specific CPL, no-show, response, consult-to-surgery and financing/deposit benchmarks; direct buyer language; PulpSense procedure-level proof. [PS §Research gaps]
- **Hair restoration:** percentage of “bad leads,” no-show, coordinator attempts, agency distrust, financing approval friction, consult-to-case benchmarks, long-lag attribution, mixed-path LTV. Code 100–200 recent leads before publishing rates. [HR §Confidence and research gaps]
- **Med spas:** validate snippet-derived agency/discount VOC; collect treatment-level PulpSense cases; prove show→treated→rebook attribution; test acquisition versus reactivation economics; verify compliant credential/review claims. [MS §§Evidence notes, Proof gap]

### First-party collection protocol

For each pilot, freeze 90–180 days of pre-change data where available. Export timestamps, source/campaign, response, disposition, booked/show/cancel, downstream outcome, value type, collected amount, and follow-up touches. Conduct interviews across accepted/won, lost/no-show, and buyer/operator groups. Publish only definitions and rates supported by the resulting dataset.

## 9. Historical experiment roadmap

> This roadmap captures the broader research opportunity. It is not the current
> vertical-personalization rollout sequence. See the authoritative playbook for
> the approved implementation and review process.

### Phase 0 — Measurement and claim cleanup (week 0–1)

- Snapshot current six-route performance and live copy.
- Remove/feature-flag risky guarantee/#1 copy across landing, thank-you, and email.
- Define `qualified_lead`, `showed_call`, and `sales_qualified_opportunity` with sales.
- Add variant and vertical segment persistence.

### Phase 1 — Message-match MVP (week 1–3)

- Expand campaign config and props-drive hero, recognition strip, leak stages, CTA, objections, and proof fallback.
- Launch one control and one verticalized treatment per initial niche.
- Keep layout/performance/tracking constant so copy/qualification effects are interpretable.
- Do not add the full calculator yet if it delays the core test.

### Phase 2 — Qualification and proof (week 3–6)

- Add 4–6 progressive niche questions and CRM fields.
- Replace irrelevant proof with vertical case/pilot artifact.
- Branch thank-you/pre-call preparation.
- Evaluate CPQL, cost per show, opportunity rate, and sales time—not just CPL.

### Phase 3 — Calculator and sub-routes (week 6–10)

- Add shared calculator with six schemas.
- Add highest-volume sub-routes only where data show meaningful segment differences.
- Test calculator-before-form versus after contact capture.

### Phase 4 — Closed-loop optimization (week 10+)

- Import show, opportunity, won, collected, and retention events.
- Reallocate spend based on expected contribution and sales capacity.
- Feed offline events to Meta only after data quality, volume, consent, and dedupe are verified.

## 10. Historical expanded-program acceptance checklist

> These items apply only if the expanded diagnostic, calculator,
> vertical-qualification, and downstream-measurement program is separately
> approved. They are not acceptance criteria for routine copy personalization.

- [ ] Six live routes no longer show the same hero/subhead/CTA.
- [ ] No unsubstantiated fixed call, ranking, case, patient, or revenue guarantee remains in landing, thank-you, FAQ, comparison, or pre-call email.
- [ ] Ad angle and niche segment persist into the page, form, booking, and CRM.
- [ ] Every route names its economic unit and shows the correct leak stages.
- [ ] Every route has niche-specific vocabulary, objection responses, form fields, calculator schema, proof requirements, and claim guardrails from its report.
- [ ] Shared components remain shared; no six-page clone drift.
- [ ] Proof is verified/comparable or explicitly labeled pilot/sample artifact.
- [ ] Calculators expose formulas, use user inputs/ranges, and distinguish revenue/value/contribution.
- [ ] Contract changes are versioned and backward compatible; tests cover each funnel ID.
- [ ] Analytics distinguish CPL, qualified lead, booked, show, opportunity, win/client acceptance, collected revenue, and retention.
- [ ] No PHI, sensitive medical data, or confidential legal facts flow to Meta/PostHog.
- [ ] Experiment decisions use downstream economics and report loss reasons/sample counts.

## 11. Historical recommended implementation order

> Superseded for routine vertical rollout by
> [`../vertical-funnel-personalization-playbook.md`](../vertical-funnel-personalization-playbook.md).

1. **Delete the generic promise debt:** update `HeroSection.astro`, `GuaranteeSection.astro`, `QualificationSection.astro`, `FaqSection.astro`, `ComparisonSection.astro`, `ConfirmationHero.astro`, and `precall-copy.ts` so unverified “45 calls / #1 / guaranteed” language is no longer universal.
2. **Expand `campaigns.ts` into a true vertical registry:** hero, CTA, economic unit, stages, recognition, objection/proof/claim sets, form branch, calculator key, and experiment IDs.
3. **Update `AiSeoQualificationForm.tsx` + `packages/contracts/src/funnel-events.ts`:** collect and transmit the few fields that determine fit and economic routing; preserve current contact-first/booking reliability.
4. **Implement comparable proof/pilot fallback in `ResultsSection.astro`:** do not show retirement-community/dental call proof indiscriminately.
5. **Instrument downstream quality:** add segment/variant/calculator events in `funnelAnalytics.ts`; map showed call and sales opportunity in CRM; build one report from spend through opportunity before scaling experiments.

## 12. Final decision

PulpSense should not treat high CPL as a landing-page wording problem alone. The present funnel asks six economically different buyers to believe the same upstream quantity promise, then qualifies them only on ownership and budget. That can create both poor message match and misleading optimization.

The strongest cross-niche offer is:

> **A vertical demand-to-revenue leak diagnostic that shows where qualified business is lost, what the largest recoverable gap could be worth using the buyer’s own inputs, and which three fixes to test first.**

Google/Maps/AI visibility remains an effective curiosity and evidence module. The sale, qualification, proof, calculator, and measurement must terminate in the niche’s actual business unit: signed matter, kept patient, accepted implant case, booked surgery, booked hair procedure/non-surgical start, or treated-and-returning med-spa guest.
