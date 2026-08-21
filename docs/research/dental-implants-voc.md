# Dental Implant Practice Voice-of-Customer and Funnel Research

**Purpose:** Customize PulpSense's high-CPL Meta funnel for U.S. dental-implant practices without overpromising lead volume or search outcomes.
**Recovered evidence:** 21 August 2026 from the fixed archive in [`raw-dental-implants-voc/`](./raw-dental-implants-voc/).
**Current funnel reviewed:** `apps/funnels/src/funnels/ai-seo/campaigns.ts`, lines 90–105.
**Scope:** Implant dentist/oral surgeon/prosthodontist owners, practice managers, treatment coordinators, and marketing leads; patient concerns are included only to explain acquisition and conversion friction.

## Executive conclusion

The current promise—**“45 More Implant Calls in 90 Days”**—optimizes for a quantity that is too far upstream from practice revenue. The recovered evidence points to a different commercial problem:

1. **Demand is uneven, not universally scarce.** In Q4 2025, one-third of dentists reported they were not busy enough, while new-patient wait times remained stable; at the same time, staffing, insurance, overhead, and maintaining patient volume were leading concerns.[1]
2. **An implant inquiry is not an implant case.** High-cost implant plans face confusion, fear, unclear urgency, cost uncertainty, and inconsistent team messaging. Case acceptance is a workflow spanning diagnosis, estimates, financing, scheduling, and follow-up—not a single call.[4][5]
3. **The economic unit should be an accepted, scheduled case—not a raw lead or call.** A 2025 telephone survey of 278 practices found a $4,000 median complete single-tooth implant fee, with meaningful differences by provider type and city.[2] Full-arch economics are likely much larger, but the archive contains only vendor estimates, not a neutral U.S. benchmark.
4. **Financial clarity is part of conversion.** Cost anxiety can prevent care; transparent estimates, payment options, nonjudgmental discussion, and calculators can reduce uncertainty.[3] Implant patients are specifically described as worrying about complexity, discomfort, time, and expense.[4]
5. **The best PulpSense angle is “find and fix where valuable implant demand leaks.”** Search visibility can be one layer, but the funnel should diagnose visibility, lead handling, consultation readiness, financing communication, follow-up, and measurement. This is more credible and more economically aligned than guaranteeing 45 calls.

**Recommended positioning:**

> **See where your next implant case is being lost—from search visibility to the consultation and follow-up—and what fixing the highest-value leak could be worth.**

**Evidence status:** The business/economic and treatment-acceptance findings are well supported by ADA data and industry/practice-management sources. Direct buyer interviews, direct patient interviews, paid-media benchmarks, speed-to-lead experiments, agency-distrust quotes, medical-tourism prevalence, and PulpSense-specific results were **not** present in the recovered archive. Recommendations in those areas are explicitly labeled as inference or test hypotheses.

---

## 1. Evidence standard and confidence labels

- **Evidence — high confidence:** representative or clearly described empirical source (for example, ADA HPI polling or a documented multi-market survey).
- **Evidence — medium confidence:** named dental-industry expert, practitioner, or established practice-management publisher; directionally useful but not necessarily independent research.
- **Vendor claim — low/medium confidence:** published by a company selling financing, software, staffing, or related services; use to understand market language and hypotheses, not as an audited benchmark.
- **Inference:** conclusion logically derived from cited evidence but not directly measured by the source.
- **Hypothesis/test:** plausible proposition that requires PulpSense campaign or CRM data before it becomes a claim.

### Source-quality caveat

The archive is useful but not a complete VOC study. It contains ADA macro data, one pricing study, and several vendor/editorial articles. The saved `reddit-pullpush.json` contains zero items, so there is **no recovered Reddit evidence** and no basis to present anonymous forum language as authentic buyer or patient VOC. Quotes below identify the speaker/source type.

---

## 2. Current funnel diagnosis

The implant campaign currently uses:

- Landing title: **“45 More Implant Calls in 90 Days | PulpSense”**
- Description: **“Help more implant patients find and call your practice through Google and AI search.”**
- Qualification callout: the prospect will see who Google or ChatGPT is “recommending first” and “what it's costing you.”

### What is strong

- It is specific to implant practices.
- It connects discoverability to a high-value service line.
- The audit mechanism can be concrete if PulpSense shows actual local search/AI visibility evidence.

### What is weak

| Issue | Why it matters | Evidence or inference | Confidence |
|---|---|---|---|
| “45 calls” treats every call as equally valuable | Implant revenue depends on eligibility, appointment booking, show, acceptance, financing, and scheduling | Inference from the case-acceptance workflow.[5] | High |
| “In 90 days” implies a measurable outcome without stating conditions | Performance depends on market, capacity, response process, budget, baseline visibility, and offer | Inference; no PulpSense substantiation was recovered | High |
| “Google or ChatGPT recommended first” may overstate how ranking/recommendation works | Search and AI answer surfaces vary by query, location, personalization, and time | Inference; archive has no ranking study | Medium |
| The page creates urgency through lost calls, not lost accepted cases | A scheduled/completed treatment is the more honest downstream unit.[5] | Evidence + inference | High |
| The offer does not qualify operational readiness | Staffing and consistent communication can constrain conversion.[1][5][6] | Evidence | High |

**Implication:** Keep the visibility audit, but frame it as the first stage of an **implant-case acquisition diagnostic**, not a call guarantee.

---

## 3. Practice economics and the value of a case

### What the evidence says

A 2025 telephone survey of 278 practices in Houston, San Francisco, Chicago, Minneapolis, Denver, and Philadelphia reported:[2]

- **$4,000** nationwide median for a complete single-tooth implant (implant, abutment, crown).
- **$3,400** median where a specialist performed the surgery versus **$4,800** where a general dentist did.
- City medians from **$3,665 in Houston** to **$5,505 in Minneapolis**.
- Specialists performed surgery in 61% of surveyed offices; the study notes incomplete component pricing for some responses.[2]

This is fee/revenue context, **not profit**. It does not include the practice's lab, implant component, clinician, acquisition, financing, or overhead costs. ADA HPI separately described a continuing “fiscal squeeze”: equipment/supply prices and wages were rising faster than reimbursement rates.[1]

### Funnel implication

Do not ask only, “How many calls do you want?” Ask what a qualified case is worth, which case types the practice wants, and where the practice has capacity. A general dentist restoring and/or placing single implants has a different fee structure, referral model, and conversion path from an oral surgeon, periodontist, prosthodontist, or full-arch center.

### Recommended value-leak calculator

Use the practice's own inputs:

```text
Expected collected production
= implant inquiries
× reachable/contacted rate
× consultation-booked rate
× consultation-show rate
× treatment-acceptance rate
× financing/collection realization
× average collected production per accepted case

Allowable cost per inquiry
= target acquisition cost per accepted case
× contacted rate
× booked rate
× show rate
× acceptance rate
× financing/collection realization
```

Show a **range**, not a promised result. For illustration only, 100 inquiries at 65% contacted, 60% booked, 75% shown, 45% accepted, and $4,000 collected production per accepted case imply **$52,650 in expected collected production before costs**. Forty-five inquiries under the same illustrative assumptions imply **$23,692.50**. These are calculator mechanics, not benchmark conversion rates or forecasts.

**Inference — high confidence:** The same 45 calls can have radically different value depending on the practice's response, consult, financing, and follow-up process. Therefore, the funnel should sell visibility into the whole conversion chain.

---

## 4. Patient cost and financing anxiety

### Evidence

CareCredit's provider guidance states that dental cost anxiety can stop patients from pursuing needed care, particularly when expenses are unexpected or procedures are expensive. It recommends upfront cost explanations, simple language, open discussion, transparent pricing, payment options, and digital cost-estimation/payment tools.[3]

Useful patient-friction language from that source includes:

- **“unexpected costs”**
- **“higher-than-anticipated costs”**
- a prior **“negative past experience with dental billing”**
- weighing treatment against **“other expenses and financial priorities”**[3]

Glidewell's implant-specific article says potential implant patients are more concerned about **“complexity, discomfort, time and expense.”** It argues that presenting financing only after other payment methods fail is a critical mistake; patients should see all options upfront.[4]

Cherry, a financing vendor, describes implant costs as ranging from $3,000 to $50,000+ across single-tooth through full-mouth treatment and lists insurance limits, credit eligibility, interest, and monthly affordability as major constraints.[8] Treat these figures and product claims as vendor-provided, not neutral benchmarks.

### What this means for the acquisition funnel

- Do not hide price behind “book now” with no affordability context.
- Do not advertise a universal price when case complexity and geography vary.
- Do introduce **payment-path transparency** early: financing available, estimated monthly range only when the practice can substantiate it, insurance/benefits review, and no-judgment discussion.
- Let patients self-identify the barrier: total price, monthly payment, insurance uncertainty, credit concern, time off work, fear, or not knowing whether they qualify clinically.

**Inference — high confidence:** “Can I afford this?” is not a low-quality-lead signal by itself. It is a normal part of a high-consideration implant decision. Lead quality should distinguish genuine treatment intent from affordability uncertainty rather than rejecting all cost-sensitive prospects.

---

## 5. Consultation quality and treatment acceptance

### Evidence

Dentrix Ascend defines accepted treatment as treatment actually **scheduled or completed**, warning that a positive conversation or status field can overstate acceptance. Its 2026 Catalyst Index reports average acceptance of 42% for 1–7 locations and 45% for 8+ locations/DSOs, with 75% for the top decile in both groups.[5] These are publisher/vendor benchmarks across dental treatment, not implant-only neutral benchmarks.

The same source identifies four recurring barriers:

1. confusion about the problem, risk, or urgency;
2. fear of pain, outcomes, or the unknown;
3. uncertainty about cost today and over time;
4. mixed messages from different team members.[5]

Glidewell's implant-specific guidance says a high-fee implant plan should be a **conversation**, not a presentation. It recommends learning the patient's motive (function, appearance, or health), letting the patient speak at least half the time, asking for commitment, and reviewing all financial options.[4]

Dental Economics similarly argues that trust and personal relationship can increase willingness to spend on recommended treatment.[7] This is expert guidance, not a controlled trial.

### Consultation-quality checklist for the audit

- Is the patient's primary motive captured in the CRM?
- Are clinical findings made visual and understandable?
- Are complexity, discomfort, time, and expense addressed directly?
- Is the coordinator—not the clinician alone—responsible for estimates, financing, and next steps?
- Is “accepted” counted only when scheduled/completed?
- Does every unscheduled plan get a documented reason and next follow-up date?
- Can performance be segmented by provider, coordinator, procedure, location, source, and campaign?[5]

**Inference — high confidence:** More top-of-funnel leads can worsen economics when the consultation and follow-up workflow is already leaking. PulpSense should identify the bottleneck before prescribing more volume.

---

## 6. Lead quality, speed-to-lead, and follow-up

### Lead quality

A useful implant lead is not merely a phone number. The minimum qualification model should distinguish:

- treatment interest: single tooth, multiple teeth, denture stabilization, full arch/full mouth, unsure;
- clinical fit signals: missing/failing teeth, current dentures, prior recommendation, timing;
- geographic fit and ability to attend;
- affordability pathway: cash, financing interest, insurance questions, unsure;
- urgency and motivation: function, appearance, health, pain, upcoming life event;
- readiness: researching, wants consultation, comparing providers, ready to schedule;
- contactability and preferred channel/time.

**Inference — high confidence:** Optimize Meta toward **qualified consultations and scheduled cases**, not form fills. Report lead-source cohorts through contacted → booked → showed → accepted → scheduled/collected.

### Speed-to-lead

The recovered archive contains **no controlled dental-implant speed-to-lead benchmark**. It would be irresponsible to invent a “five-minute” or similar threshold.

**Hypothesis — medium confidence:** Faster human response should improve contact and booking because implant shoppers can compare multiple providers and because uncertainty is high. Validate this using PulpSense timestamp data rather than marketing folklore.

Recommended experiment:

- timestamp lead creation, first automated acknowledgment, first human attempt, first two-way contact, booking, show, and acceptance;
- compare cohorts: under 5 minutes, 5–15, 15–60, 1–4 hours, same day, next day+;
- control/report by channel, daypart, market, case interest, and contact method;
- use median and 80th-percentile response time, contact rate, booked rate, show rate, and accepted-case CAC.

### Follow-up

Dentrix recommends a same-day summary, follow-up within a few days, and continued outreach based on urgency.[5] Swiss Monkey recommends structured 24-hour, weekly, and monthly follow-up, but its acceptance and ROI figures are vendor claims and should not be copied as guarantees.[6]

**Recommendation:** Make the audit show how many inquiries and unscheduled treatment plans lack an owner, status, next action, or follow-up date.

---

## 7. Demand, capacity, competition, and medical tourism

### Demand and capacity evidence

ADA HPI's Q2 2025 data estimated 27% of dentists were not busy enough and 13% were too busy; average new-patient wait was just over 13 days.[1] In Q4 2025, one-third reported not being busy enough, while new-patient wait times remained stable. Dentists' leading stated 2026 concerns included insurance (55.3%), staffing (54.2%), overhead (41.5%), maintaining/increasing patient volume (31.8%), and patient treatment refusal/delay due to inability to pay (8.8%).[1]

**Inference — high confidence:** Capacity cannot be assumed. A practice that is too busy or understaffed should be sold better-fit demand, schedule smoothing, or conversion recovery—not simply more calls.

### Local competition

The implant-pricing study found meaningful regional and provider-type variation.[2] Patients also have alternatives such as dental school clinics, promotions/bundles, savings plans, and multiple financing routes.[8]

**Inference — medium confidence:** Competitive messaging should not default to “beat the other dentist.” It should help the practice communicate fit: credentials, procedure scope, technology, continuity of care, financing pathway, time-to-teeth/treatment timeline where supportable, reviews, before/after evidence with consent, and what happens after surgery.

### Medical tourism

**Evidence gap:** The recovered archive contains no reliable study of U.S. implant patients choosing treatment abroad, no prevalence figure, and no direct patient quote about medical tourism. Do not manufacture one.

**Hypothesis to test — medium confidence:** Some high-fee full-arch prospects compare local care with lower sticker prices abroad. Test a neutral reassurance block about continuity, pre-operative assessment, follow-up access, complication management, transparent inclusions, and total trip/time costs—but do not use fearmongering, imply foreign care is unsafe, or make superiority claims without evidence.

---

## 8. Patient triggers and motivations

### Supported triggers

Glidewell identifies three broad motivations: **function, esthetics, and overall health**; the consultation should find the patient's main objective and stay centered on it.[4] Swiss Monkey's patient-centered language translates implant benefits into eating confidently, smiling without worry, and speaking clearly.[6]

### Language bank for creative tests

These are **derived messages, not verbatim patient interviews**:

- “Eat the foods you miss.”
- “Smile without planning how to hide your teeth.”
- “Speak without worrying about movement or slipping.”
- “Understand the timeline, comfort options, and payment paths before deciding.”
- “See whether implants fit your situation—without pressure.”

### Additional hypotheses to validate in first-party interviews/data

- failing bridge, loose dentures, repeated repair cycles, or a recent extraction recommendation;
- pain or inability to chew;
- wedding, reunion, career change, or photo-heavy event;
- health scare or desire to stop deterioration;
- frustration after being told “you are not a candidate” without a complete workup;
- caregiver/family influence.

Do not present these as prevalence findings until PulpSense captures them in form fields, call notes, or interviews.

---

## 9. Buyer VOC and patient VOC

### Buyer/practice language recovered

Direct ADA respondent language illustrates the split in the market:

> “I am so busy I may have to turn patients away.” — dentist respondent in ADA HPI Q2 2025.[1]

Meanwhile, ADA data show a growing share of dentists reporting that they are not busy enough.[1] The buyer market therefore contains at least two distinct jobs-to-be-done: **create qualified demand** and **improve fit/conversion without overloading capacity**.

Practice-management language that likely resonates with owners/managers includes:

- “Are more patients scheduling needed care?”
- “Are fewer treatment plans sitting unscheduled?”
- “Are follow-ups happening on time?”
- “Are patients hearing the same message from every team member?”[5]

A practice owner testimonial in Dentrix's article says visual information helps patients feel more confident in the diagnosis and accept treatment at a higher rate.[5] This is a named customer testimonial, not an independent outcome study.

### Patient language recovered

There are no direct patient interviews in the archive. The closest source-grounded friction language comes from provider guidance:

- **“I need to think about it”** / “let me think about it” as an unscheduled state requiring helpful follow-up.[5][6]
- worry about **pain, outcomes, or the unknown**.[5]
- uncertainty about what treatment costs **today and over time**.[5]
- concern about implant **complexity, discomfort, time and expense**.[4]
- fear of unexpected or higher-than-anticipated bills.[3]

**Research priority:** Interview 5–8 recent accepted implant patients, 5–8 non-acceptors/no-shows, and 5–8 practice buyers. Capture exact wording around the first trigger, provider shortlist, financing, fear, response experience, consultation, and why they chose/did not choose the practice.

---

## 10. Practice-model differences

| Practice model | Likely commercial job | Funnel qualification needed | Evidence status |
|---|---|---|---|
| General dentist placing/restoring single implants | Fill selected chair capacity; retain cases that might otherwise refer out; communicate full pathway | Placement vs restoration only, monthly capacity, average collected case value, referral relationships | Provider-type fee differences supported by survey.[2]; job is inference |
| Oral surgeon / periodontist | Generate surgery-ready referrals and direct patients; coordinate restorative handoff | Referral mix, direct-to-patient appetite, geography, procedure types, downstream restorative partner | Model logic is inference; specialist pricing difference supported.[2] |
| Prosthodontist / full-arch center | Fewer, higher-value consults; finance and close complex cases | Full-arch capacity, coordinator, financing, consult length, records required, case value | High-cost/complexity friction supported.[4][8]; economics need first-party inputs |
| Multi-location / DSO | Standardize source tracking, scripts, speed, handoffs, and acceptance by location | Location routing, central call center, PMS/CRM, attribution, provider capacity | Acceptance varies by location/model; Dentrix provides DSO benchmarks.[5] |
| Growth-stage 1–3 doctor practice | Avoid front-office overload while improving follow-up and case conversion | Staffing, missed calls, owner/operator, coordinator hours, follow-up ownership | Staffing challenge supported by ADA and vendor workflow evidence.[1][6] |
| Referral-dominant specialty practice | Protect referral relationships while selectively building direct demand | Referral/direct mix, co-marketing rules, patient communication, referring-doctor attribution | Inference; not directly measured in archive |

**Recommendation:** Route prospects to different audit narratives based on model. A single “45 calls” promise obscures the operating constraint that determines value.

---

## 11. Agency distrust and desired proof

### What is actually evidenced

The archive contains **no direct buyer quote about dental marketing agencies**, retainers, bad leads, attribution disputes, exclusivity, or prior vendor failure. Agency-distrust messaging must therefore be treated as a hypothesis, not VOC.

### Likely objections to test (not claims)

- “We already tried an agency; the leads were price shoppers or unreachable.”
- “The dashboard showed leads, but the schedule did not change.”
- “We could not tell which cases came from which source.”
- “They blamed our front desk; our team blamed lead quality.”
- “Ranking reports did not translate into accepted cases.”
- “The promise ignored our market, capacity, and procedure mix.”

### Proof buyers should see

1. **Local evidence:** dated screenshots/query logs for Maps, organic results, and AI answers across relevant locations and queries—not a single cherry-picked search.
2. **Attribution:** source → call/form → two-way contact → booked consult → show → accepted/scheduled treatment → collected production.
3. **Case-level economics:** qualified-consult cost and accepted-case acquisition cost, not CPL alone.
4. **Operational evidence:** response-time distribution, missed-call handling, follow-up completion, and reasons for loss.
5. **Comparable proof:** anonymized case study with baseline, geography, practice model, procedure mix, spend, timeframe, operational changes, and outcome definition.
6. **Claim boundaries:** what PulpSense controls, what the practice controls, assumptions, exclusions, and how measurement works.
7. **No lock-in theater:** clear deliverables, access/ownership of ad accounts and data, cancellation terms, and data export.

**Inference — high confidence:** Transparency about attribution and constraints is a stronger distrust antidote than a bigger numerical guarantee.

---

## 12. Recommended landing-page structure

### 1. Hero: diagnose the leak, not promise calls

**Headline option A**
**See Where Your Next Implant Case Is Being Lost**

**Subhead**
Get a local implant-demand audit across Google, AI search, lead response, consultation booking, and follow-up—then see which fix could have the highest case value for your practice.

**CTA:** **Map My Implant-Case Leaks**

### 2. Split-path problem selector

> Which sounds most like your practice?

- We need more qualified implant consultations.
- We get inquiries, but too few book or show.
- Consults happen, but too few cases schedule.
- We have unscheduled treatment and inconsistent follow-up.
- One or more locations/providers have unused implant capacity.
- We cannot tell which marketing produces accepted cases.

### 3. “One case, many leaks” visual

Show the chain:

`Search visibility → inquiry → contacted → booked → showed → accepted → financed → scheduled/collected`

Under each stage, show the metric the audit will calculate.

### 4. Practice-model module

Adapt proof and questions for general dentist, surgical specialist, prosthodontic/full-arch center, and multi-location/DSO.

### 5. Patient-friction module

Use four cards grounded in the evidence:

- “Is this right for me?” — clarity/qualification
- “What will it feel like?” — pain/unknown
- “How long will it take?” — complexity/time
- “How can I pay for it?” — total cost/financing[3][4][5]

### 6. Calculator

Inputs:

- implant inquiries/month;
- contact, booking, show, acceptance, and collection/financing rates;
- single/multiple/full-arch mix;
- average collected production per case;
- monthly case capacity;
- marketing spend.

Outputs:

- expected scheduled cases and collected production;
- value lost at each stage;
- allowable inquiry/consult acquisition cost;
- “capacity-limited” warning when projected cases exceed available slots.

Label all results **estimates based on user-entered data**, exclude profit unless costs are entered, and avoid default conversion rates that look like benchmarks.

### 7. Proof section

Use only substantiated proof. Preferred case-study card:

- baseline period and metric definition;
- practice type and market;
- media spend and service scope;
- operational changes beyond ads/SEO;
- qualified consults, shows, accepted/scheduled cases, and collected production;
- timeframe and caveats.

### 8. Audit deliverables

Promise outputs PulpSense can directly deliver:

- local visibility/query snapshot;
- competitive/message gap;
- call/form routing and response audit;
- funnel conversion map;
- tracking/attribution gap list;
- prioritized 90-day experiment plan;
- range-based opportunity model.

### 9. CTA and risk reversal

**Primary CTA:** **Book My Implant Growth Diagnostic**
**Secondary CTA:** **See a Sample Case-Leak Map**

Risk reversal should be process-based: “Leave with the findings and priorities whether or not we work together.” Do not guarantee rankings, calls, or cases unless legal review and robust substantiation exist.

---

## 13. Recommended form questions

Keep the first step short; progressively disclose detailed questions after intent is established.

### Step 1: fit

1. Which implant treatments do you want more of? (single, multiple, overdenture, full arch/full mouth, grafting, other)
2. What best describes the practice? (general dentist, oral surgery, periodontics, prosthodontics, implant center, DSO/multi-location)
3. How many locations and implant providers?
4. ZIP/markets served.
5. What is the main constraint? (not enough inquiries, lead quality, response, booking/show, acceptance/financing, follow-up, attribution, capacity imbalance)

### Step 2: economics and capacity

6. Implant consultations per month (range).
7. Implant cases currently scheduled per month (range).
8. Additional cases the practice could start per month without compromising care.
9. Typical collected production bands by target case type (optional).
10. Approximate monthly marketing spend and channels.

### Step 3: operations

11. Who responds to new implant inquiries?
12. Coverage: business hours only, evenings/weekends, call center, automated acknowledgment.
13. Typical first-human-response time (unknown is an option).
14. PMS/CRM and call-tracking tools.
15. Do you track contacted, booked, showed, accepted, scheduled, and collected by source?
16. Is there a dedicated treatment/implant coordinator?
17. Which financing/payment options are presented, and at what point?
18. What happens after “I need to think about it”?
19. Previous agency/marketing experience and what did not work? (open text)

**Qualification principle:** Do not disqualify solely for lower lead volume. A practice with meaningful unscheduled treatment or conversion leakage may be an excellent fit even if it does not need more raw inquiries.

---

## 14. Claims to avoid or tightly qualify

1. **“45 more implant calls in 90 days.”** Avoid unless based on comparable, documented PulpSense results with definitions, assumptions, and typical-results disclosure.
2. **Guaranteed calls, patients, consults, cases, rankings, or revenue.** Outcomes depend on market, spend, offer, capacity, response, clinical suitability, consultation, financing, and patient choice.
3. **“Google/ChatGPT recommends you first.”** Avoid implying control over or permanence of third-party ranking/answer systems.
4. **“Every implant patient is worth $X.”** Distinguish single-tooth from full-arch, fee from collected production, and revenue from profit.[2]
5. **Universal case-acceptance rates.** Dentrix and Swiss Monkey figures are publisher/vendor benchmarks and may not apply to implants, market, source, or practice model.[5][6]
6. **Financing approval or 0% claims without exact lender disclosures.** Eligibility, APR, term, amount, and credit effects vary.[8]
7. **“Pain-free,” “same-day teeth,” “permanent,” “lifetime,” or universal candidacy.** These are clinical claims requiring practice-specific substantiation and review.
8. **Unsubstantiated superiority over local competitors or overseas providers.** No recovered evidence supports it.
9. **Medical-tourism fear claims.** No reliable tourism evidence was recovered.
10. **CPL as proof of success.** Report downstream qualified consult and accepted/scheduled-case economics.

---

## 15. Messaging tests (prioritized)

Each test should keep audience, spend, placement, and conversion event as comparable as possible. Optimize initially to qualified consultation, then evaluate scheduled-case CAC with lag.

| # | Test | Variant A | Variant B | Why test / success metric |
|---|---|---|---|---|
| 1 | Outcome unit | “More implant calls” | “More qualified implant consultations” | Tests quantity vs quality; qualified-consult rate and cost |
| 2 | Diagnostic frame | “See who outranks you” | “See where implant cases leak from search to schedule” | Tests competitor fear vs operational value; booked-audit rate and sales qualification |
| 3 | Revenue frame | “45 calls in 90 days” | “What would one more accepted implant case per month be worth?” | Tests big-volume promise vs credible economics; audit completion and close rate |
| 4 | Bottleneck self-selection | Generic implant growth | Six-path selector: demand, response, show, acceptance, follow-up, attribution | Tests relevance; landing completion and segment-level close rate |
| 5 | Proof format | Ranking screenshots | Full source-to-scheduled-case attribution example | Tests surface proof vs commercial proof; CTA rate and objection rate |
| 6 | Patient insight | “High-value implant patients” | “Patients need clarity on fit, comfort, timeline, and payment” | Tests value label vs empathy/understanding; lead quality and consult show rate |
| 7 | Capacity-aware | “Get more leads” | “Fill the implant capacity you actually want—without flooding the front desk” | Tests operational empathy; qualified opportunity rate |
| 8 | Distrust antidote | Outcome promise | Transparent audit deliverables + “keep the findings” | Tests guarantee vs control/transparency; booked-call show and proposal close |
| 9 | Visibility scope | Google + ChatGPT | Google Maps + local organic + AI-answer visibility, shown by query and location | Tests vague AI novelty vs concrete audit; credibility feedback and CTA rate |
| 10 | CTA | “Book a call” | “Map my implant-case leaks” | Tests generic meeting vs artifact-based value; CTA click-to-book rate |

### Measurement guardrails

- Predefine “qualified consultation,” “show,” and “accepted/scheduled case.”
- Keep source and campaign IDs through the PMS/CRM handoff.
- Report both median lead-response time and downstream conversion.
- Allow enough lag for high-consideration treatment decisions.
- Segment by practice model and case type; do not aggregate single implants and full arch into one value metric.
- Do not declare a winner on CPL if accepted-case CAC or quality deteriorates.

---

## 16. Recommended first-party research and analytics plan

The evidence gaps are commercially important. Close them before turning hypotheses into headline claims.

### Buyer interviews (5–8 per model)

Ask owners/managers/coordinators:

- What made implant growth urgent now?
- Where do cases stall, in their own words?
- What counts as a “good lead” and a “bad lead”?
- How quickly can the team actually respond?
- What happened with previous agencies/vendors?
- Which proof would make them trust an audit?
- What capacity, staffing, referral, and financing constraints exist?
- Which metric does the owner review weekly?

### Patient interviews

Interview recent accepts, non-accepts, and no-shows:

- first trigger and first search phrase;
- providers considered and why;
- fear, cost, financing, time, travel, and family influence;
- first-contact experience and response speed;
- what built or broke trust;
- what “I need to think about it” meant;
- decisive proof or unresolved question.

### CRM/data audit

Export at least 90–180 days of:

- lead timestamp/source/campaign;
- first automated and human response;
- contact outcome and reason;
- booking, show/no-show, case type;
- accepted/scheduled date and value;
- financing application/approval where lawful and appropriate;
- loss reason and follow-up touches.

Use this to replace generic promises with a defensible local model.

---

## 17. Final recommendation

Build the implant funnel around a **case-leak diagnostic**:

1. attract with local Google/AI visibility evidence;
2. qualify by procedure mix, capacity, and bottleneck;
3. quantify opportunity using the practice's own economics;
4. expose response, booking, show, acceptance, financing, and follow-up leakage;
5. prove work at the accepted/scheduled-case level;
6. position PulpSense as the transparent partner that connects discovery to revenue without pretending it controls every stage.

This preserves the appealing search-visibility mechanism while replacing the least credible part of the current offer—the fixed call guarantee—with a more implant-specific, operationally aware, and measurable promise.

## Sources

[1] https://www.ada.org/resources/research/health-policy-institute/economic-outlook-and-emerging-issues — ADA HPI: Economic Outlook and Emerging Issues in Dentistry
    > "Appointment wait times for new patients have been stable throughout 2025."
[2] https://www.dentaleconomics.com/practice/article/55343557/a-comparative-analysis-of-dental-implant-costs-across-major-us-markets — Dental Economics: 2025 implant costs across major U.S. markets
    > "The nationwide median cost for a complete dental implant in 2025 is $4,000, with significant regional and provider-based variations."
[3] https://www.carecredit.com/providers/insights/support-patients-dental-anxiety-about-cost-care — CareCredit: Support patients with dental cost anxiety
    > "Dental cost anxiety is a barrier that may prevent patients from pursuing necessary dental care, often due to worry about unexpected expenses or concerns about high-cost procedures."
[4] https://glidewelldental.com/education/chairside-magazine/volume-17-issue-2/new-approach-to-increasing-implant-case-acceptance — Glidewell: A new approach to increasing implant case acceptance
    > "Potential implant patients are more concerned about the complex­ity, discomfort, time and expense."
[5] https://www.dentrixascend.com/insights/blogs/improve-case-acceptance-dental-practice — Dentrix Ascend: How to improve dental case acceptance
    > "Improving case acceptance in dentistry isn’t a sales problem. It’s almost always a clarity problem."
[6] https://www.swissmonkey.io/articles/staffing-solutions/improve-dental-implant-case-acceptance — Swiss Monkey: How to improve dental implant case acceptance
    > "Current staffing shortages magnify these gaps and make consistent patient communication difficult."
[7] https://www.dentaleconomics.com/practice/article/14301274/practice-production-prioritized-one-simple-technique-to-increase-case-acceptance — Dental Economics: One technique to increase case acceptance
    > "The reason is that as patients feel they are developing more of a personal relationship than a professional relationship, they tend to trust the doctor and team more."
[8] https://withcherry.com/blog/dental-implants-financing — Cherry: Dental implant financing options
    > "Whether your patients need a single tooth or full mouth dental implants, the cost can be a major hurdle — often ranging from $3,000 to $50,000+."
