# ShoutOut — Product Requirements Document

**Version 1.0 · August 2026 · Anchit Tandon**

The single source of truth for what gets built and why. Module docs (04–11) carry the detail; this document carries the decisions.

---

## 1. Summary

**ShoutOut is an all-in-one platform for the independent music industry in India.**

One account, eight modules, one payment rail — the way Shopify is Products, Orders, Customers, Payments and Marketing rather than five separate products.

| Field         | Value                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Market        | India first; portable to any market that runs on managers and WhatsApp                                          |
| Primary buyer | Artist managers carrying 3–15 artists                                                                           |
| Launch date   | 9 September 2026 — Credits + concierge Gigs                                                                     |
| Revenue model | SaaS subscription (largest line) + 6% take rate + data + sponsorship                                            |
| Status        | **Pre-validation.** No customer has been interviewed. Every number below is an estimate unless marked verified. |

---

## 2. The problem

Indian live music is growing fast and none of the infrastructure exists.

| Problem                                                                | Who feels it                       | Severity                        |
| ---------------------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| Fees delayed 30–90 days, part-paid, or never paid                      | Artists, managers                  | Acute                           |
| Session players paid last, least, or not at all                        | Sidemen                            | Acute, and morally indefensible |
| Splits agreed verbally, discovered years later when there's money      | Everyone who has ever collaborated | Universal                       |
| Managers run careers on WhatsApp and Sheets — no pipeline, no calendar | Managers                           | Chronic                         |
| Producers find vocalists through Instagram DMs, or not at all          | Producers, vocalists               | Chronic                         |
| Nobody knows what to charge — no price reference exists                | Artists, managers, organisers      | Chronic                         |
| Verbal date holds cause routine double-bookings                        | Managers, promoters                | Acute                           |
| Talent shows sign 15 people and discard 45,000                         | Emerging artists                   | Overlooked                      |

Each maps to a module in §4.

---

## 3. Goals and non-goals

### Goals

| #   | Goal                                                  | Measure                                                |
| --- | ----------------------------------------------------- | ------------------------------------------------------ |
| G1  | Artists and everyone they work with get paid on time  | Payout SLA met at T+2, >97%                            |
| G2  | No collaboration closes without documented splits     | 100% of closed collabs produce a locked work           |
| G3  | Managers run their whole roster in one place          | Inbound message → sent quote in <90 seconds on a phone |
| G4  | Acquire artists at a fraction of paid-social cost     | Rejection → profile completion >60%; CAC <₹120         |
| G5  | Build a price reference nobody else in the market has | Index at n≥5 across 8 genres × 12 cities               |

### Non-goals

Streaming distribution · ticketing · label services · publishing administration · a social feed · a general-purpose AI music generator.

Each is a different company. **Say no.**

---

## 4. The eight modules

### 4.1 Profiles — _be findable_

One account holds many roles simultaneously. A person is an artist _and_ a producer _and_ a mix engineer — not one chosen at signup. **Matching happens per role, never per person.**

| Requirement                                                                      | Priority |
| -------------------------------------------------------------------------------- | -------- |
| One account, many roles, `unique(artist_id, role)`                               | **Must** |
| Structured attributes per role — vocal range, BPM comfort, languages, instrument | **Must** |
| Attribute pre-fill from an uploaded track — user confirms rather than authors    | **Must** |
| Auto-generated EPK, public, ISR-rendered, indexable                              | **Must** |
| Fee band hidden by default, opt-in only                                          | **Must** |
| Three verification tiers: phone → PAN → penny-drop                               | **Must** |
| Reliability score held per role, decaying with inactivity                        | Should   |

Detail: `04-PROFILES.md`

### 4.2 Gigs — _get booked, book acts_

All circuits: weddings, corporate, college fests, clubs, festivals, folk and devotional, classical, government.

| Requirement                                                                            | Priority |
| -------------------------------------------------------------------------------------- | -------- |
| Brief intake — web form, **forwarded WhatsApp auto-parsed**, PDF auto-parsed           | **Must** |
| Ranked shortlist with visible score components                                         | **Must** |
| Quote priced off the benchmark index; **`insufficient_data` below n=5, never a guess** | **Must** |
| Holds ledger with mandatory expiry, 48h challenge window, auto-release                 | **Must** |
| **No double-confirm on one artist per date — enforced by index**                       | **Must** |
| Rider checklist travelling with the booking, T-7 and T-2 reminders                     | **Must** |
| Manager OS: roster, pipeline board, shared calendar, commission splits                 | **Must** |
| Re-book sequence at T+11 months                                                        | Should   |

Detail: `05-GIGS.md`

### 4.3 Collabs — _find people to make music with_

Seven kinds: track, band, crew, engineer, visual, session, mentor.

| Requirement                                                                                          | Priority |
| ---------------------------------------------------------------------------------------------------- | -------- |
| **Independent slots** — one request, songwriter on points _and_ vocalist on a fee, closed separately | **Must** |
| `comp_model = 'credit'` explicitly chosen, never defaulted                                           | **Must** |
| **Split sheet signed before any full-quality file moves**                                            | **Must** |
| Rooms with versioned immutable stems, chat, presence                                                 | **Must** |
| Watermarked previews both directions — beats out and takes back                                      | **Must** |
| Demo-to-request: voice note → analysed → pre-filled composer                                         | Should   |
| Reliability per role; new users get a provisional band, never zero                                   | Should   |

Detail: `06-COLLABS.md`

### 4.4 Studio — _describe the sound you want_

**Never marketed as an AI music generator.** It is a communication tool: the hardest problem in collaboration is describing a sound in words.

| Requirement                                                                    | Priority |
| ------------------------------------------------------------------------------ | -------- |
| **Audio analysis on every upload everywhere** — BPM, key, genre, mood          | **Must** |
| Reference generator — 30s clip to attach to a collab request, three options    | **Must** |
| Generation asynchronous; a failure never blocks the request from posting       | **Must** |
| Provenance on every generated asset; never licensable without human authorship | **Must** |
| Scratch preview — instant, in-browser, no queue                                | Should   |
| Stem separation, sync-length variants, album mode                              | Should   |

Assembled from **two existing assets**: the MusicGenAI semantic engine (front half) and the Third Eye nine-stage pipeline (back half). Stage 3 is where they join.

Detail: `07-STUDIO.md`

### 4.5 Stage — _compete and get discovered_

Not a vertical. **The artist-acquisition engine for the whole platform.**

| Requirement                                                                  | Priority |
| ---------------------------------------------------------------------------- | -------- |
| Phone-OTP intake, no password, no app install                                | **Must** |
| Sub-90s video, signed direct upload, resumable, cap enforced both sides      | **Must** |
| Genre brackets so hip-hop volume doesn't crowd out folk and classical        | **Must** |
| Auto-score + **human review queue — the model never decides alone**          | **Must** |
| **Rejection-to-onboarding: scorecard + free EPK + local gigs + role invite** | **Must** |
| Burst capacity: 5,000 uploads in one hour                                    | **Must** |
| Standings pages, alumni track                                                | Should   |

Detail: `08-STAGE.md`

### 4.6 Payments — _get paid, pay everyone_

| Requirement                                                                   | Priority |
| ----------------------------------------------------------------------------- | -------- |
| **ShoutOut never holds funds** — PA split-settlement, provider-agnostic       | **Must** |
| Double-entry ledger; **settlement cannot close unless splits sum to zero**    | **Must** |
| **Session players paid on the same rail, same day, as everyone else**         | **Must** |
| TDS 194J and GST computed and shown **before** signature                      | **Must** |
| Contracts with Aadhaar eSign and per-state stamping, both parties countersign | **Must** |
| Penny-drop + PAN verification before first payout                             | **Must** |
| Daily reconciliation against PA reports; zero-tolerance on errors             | **Must** |
| Dispute path freezing settlement with a resolution SLA                        | Should   |

Detail: `09-PAYMENTS.md`

### 4.7 Promotion — _grow an audience_

| Requirement                                                                      | Priority |
| -------------------------------------------------------------------------------- | -------- |
| Three separate funnels — manager, artist, organiser                              | **Must** |
| ISR artist profiles as the SEO engine                                            | **Must** |
| Programmatic `/book/[genre]-in-[city]`; **never publish a cell under 3 artists** | Should   |
| Lifecycle sequences in Inngest, WhatsApp primary                                 | **Must** |
| Fan capture with **consent to the artist**, ShoutOut as processor                | **Must** |
| Full fan export available always — **build the export before the import**        | **Must** |
| Release campaign automation from booking confirm                                 | Should   |

Detail: `10-PROMOTION.md`

### 4.8 Credits — _own your work_

**The launch product**, and the only asset that compounds from user one.

| Requirement                                                               | Priority |
| ------------------------------------------------------------------------- | -------- |
| **Writer % and master % as separate columns**, each totalling exactly 100 | **Must** |
| Every contributor signs before lock — enforced by Postgres trigger        | **Must** |
| Locked work is immutable; amendments create a new version                 | **Must** |
| Each signer sees the **full** split, not only their own share             | **Must** |
| Public `/w/[id]` page, no account needed, looks like a real document      | **Must** |
| Written automatically from Collabs — no separate data entry               | **Must** |
| PRO registration export                                                   | Should   |

Detail: `11-CREDITS.md`

---

## 5. Personas

| Persona                      | Job to be done                                       | Pays?               |
| ---------------------------- | ---------------------------------------------------- | ------------------- |
| **Artist manager**           | Keep 3–15 artists booked, priced right, paid on time | **Yes — the buyer** |
| Independent artist           | Get found, get booked, own the audience              | No — via the rail   |
| Producer / writer / engineer | Find collaborators, agree splits, get paid           | No — via the rail   |
| Organiser / promoter         | Find the right act, be certain they turn up          | Take rate           |
| Wedding / corporate planner  | Vetted talent, a contract, recourse                  | Take rate           |
| Venue                        | Fill the calendar with acts that draw                | Take rate           |
| Session player               | Get paid at the same time as everyone else           | No                  |
| Brand / sponsor              | Reach a music audience with provable numbers         | 15% of sponsorship  |
| Label A&R                    | Signal, not vibes                                    | Data seat           |

**A self-managed artist is an org with a roster of one and commission zero.** Serve `n=1` as first-class; the path from one artist to five needs no migration.

---

## 6. Why one platform

The modules feed each other. Separately, none of them wins.

```
Stage auditions   →  Profiles fill
Profiles          →  Collabs and Gigs have supply
Collabs           →  Credits populate automatically
Gigs settled      →  price index sharpens  →  better quotes
Studio            →  better collab briefs, sync-ready catalogue
Payments          →  the data that underwrites financing later
Promotion         →  fan lists that price sponsorship
```

A competitor copies one module easily. Copying the platform means building all eight and wiring them together — **and the wiring is what compounds.**

Enforced structurally: `packages/discovery` serves both Gigs and Collabs, and `pnpm test:boundaries` fails CI if a module grows its own search.

---

## 7. Non-functional requirements

| Requirement             | Target                                     | Why it matters here                                               |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Tenant isolation        | RLS on every table, proven by test         | Competing managers share one database holding payout data         |
| Settlement accuracy     | 100%, zero tolerance                       | One mis-split commission destroys manager trust permanently       |
| Payout SLA              | T+2 business days, >97%                    | Faster money is the entire value proposition                      |
| Hold-expiry reliability | 99.99%                                     | A miss causes a double-booking — a reputational event, not a bug  |
| Mobile performance      | LCP <2.5s on 4G                            | Managers work backstage, in venues, in cars                       |
| WhatsApp delivery       | >97%                                       | It is the primary rail; email is secondary in this market         |
| Audition burst          | 5,000 uploads/hour                         | A season opens and everyone submits at once                       |
| Data residency          | India primary                              | DPDP compliance                                                   |
| Audit trail             | Immutable on contracts, holds, settlements | Disputes are routine; the log is the referee                      |
| Accessibility           | WCAG 2.2 AA                                | Quality floor, and a government/corporate procurement requirement |

---

## 8. Business model

### Revenue lines, Year 5, descending

| Line                       | Mechanic                    | INR          | USD         |
| -------------------------- | --------------------------- | ------------ | ----------- |
| Manager OS SaaS            | 4,000 orgs × ₹4,999 × 12    | ₹24.0 cr     | $2.82 M     |
| Artist financing           | ₹180cr originated × 9% net  | ₹16.2 cr     | $1.91 M     |
| Stage sponsorship + format | Sponsorship + OTT licensing | ₹14.0 cr     | $1.65 M     |
| **Gig take rate**          | ₹213cr GMV × **6%**         | ₹12.8 cr     | $1.51 M     |
| A&R data seats             | 90 seats × ₹9L              | ₹8.1 cr      | $0.95 M     |
| Sponsorship marketplace    | ₹40cr GMV × 15%             | ₹6.0 cr      | $0.71 M     |
| Sync licensing             | ₹12cr × 30% share           | ₹3.6 cr      | $0.42 M     |
| **Total**                  |                             | **₹84.7 cr** | **$9.96 M** |

**SaaS is the largest line, not the take rate.**

### Unit economics — verified August 2026

```
average booking            ₹75,000     ($882)
take rate                  6%
revenue                    ₹4,500      ($53)
  − PA fee  2% of gross    ₹1,500
  − messaging + infra      ₹120
  − ops (semi-manual)      ₹1,000
contribution               ₹1,880      ($22)
margin                     41.8%
```

**Benchmark:** GigSalad published 25,235 music bookings generating $12,843,000 in 2025 — an average of **$509 (₹43,257)**, take rate 5% falling to 2.5%. The Bash charges no commission at all.

**Nobody in this category charges 10%.** Expect 6% to fall toward 4%.

---

## 9. Success metrics

North star: **settled money on the rail** — money that actually moved and reconciled to zero.

| Branch      | Metric                            | Target                                     |
| ----------- | --------------------------------- | ------------------------------------------ |
| **Supply**  | Rejection → profile complete      | **>60%** — the number the company lives on |
| Supply      | Paying manager orgs, Y1           | 300                                        |
| **Demand**  | Brief → shortlist opened          | >75%                                       |
| Demand      | Shortlist → hold placed           | >35%                                       |
| **Money**   | Payout SLA met                    | >97%                                       |
| Money       | Reconciliation errors             | **0**                                      |
| Money       | Off-platform leakage              | <20%                                       |
| **Credits** | Closed collabs with a locked work | 100%                                       |
| **Asset**   | Index coverage at n≥5             | 8 genres × 12 cities                       |

---

## 10. Release plan

| Milestone             | Weeks | Ships                                           | Exit criterion                                                           |
| --------------------- | ----- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **M0** Foundation     | 1     | Monorepo, migration 001, auth, RLS gate         | Two orgs provably isolated by a test that fails for any unpolicied table |
| **M1** Credits        | 2–3   | Split sheets, signing, lock, PDF, share page    | Three people sign from three phones; the work locks; no edit path exists |
| **M2** Concierge Gigs | 3–4   | `/book` intake, hand-brokered bookings          | 25 deals recorded — **these define the schema**                          |
| **M3** Profiles       | 4–5   | Roles, attributes, EPK                          | One user, five roles, matched independently on each                      |
| **M4** Gigs           | 5–8   | Brief parsing, discovery, holds, quotes, riders | No double-confirm, proven by test; >90% parse accuracy                   |
| **M5** Payments       | 7–10  | Ledger, contracts, splits, payouts              | Three-way split settles to zero, every UTR tracked                       |
| **M6** Collabs        | 9–12  | Requests, slots, Rooms                          | Independent slot closure; 100% produce a locked work                     |
| **M7** Studio         | 11–14 | Merge of both assets, analysis everywhere       | Every upload auto-tagged; failures never block                           |
| **M8** Promotion      | 13–16 | Funnels, programmatic SEO, lifecycle            | Rejection sequence live and instrumented                                 |
| **M9** Stage          | 15–20 | Auditions, scoring, seasons                     | Burst capacity proven; rejection conversion tracked                      |

### Launch scope — 9 September

**M0 + M1 + M2 only.** Credits and concierge Gigs.

Three dependencies cannot be compressed, each with a documented workaround:

| Blocker                           | Workaround                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| WhatsApp API — 2–3 weeks approval | Free WhatsApp Business app; 256-contact broadcast is plenty for 50 users. **Submit the API application day one anyway.** |
| Escrow — PA onboarding            | Don't hold money. Organiser pays the artist directly; invoice your fee separately.                                       |
| Pvt Ltd — 10–20 working days      | Operate as an individual, invoice personally. **Start incorporation day one.**                                           |

**Launch means:** 50 works with signed splits · 5 bookings brokered by hand · 1 person asking when the paid version arrives.

### Why Credits ships before Gigs

Credits is valuable with two users. Gigs needs a marketplace. Credits spreads by itself — using it means inviting your collaborators. It compounds from user one, while every other module needs liquidity first. And it is small enough for a solo founder to ship _properly_ in three weeks rather than shipping four modules badly.

---

## 11. Risks

| Risk                                                              | Severity     | Mitigation                                                                                |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| **No customer validation**                                        | **Critical** | 20 interviews in parallel with the build. Every number here is a guess until then.        |
| **No market access** — founder doesn't know managers or promoters | **Critical** | Co-founder from the industry, 30%. Caps the business until it happens.                    |
| Disintermediation after first match                               | Critical     | Escrow, index access, sidemen splits, re-book automation — all only fire on-rail          |
| Wedding circuit runs on cash                                      | High         | Enter via corporate, festivals, clubs, government first                                   |
| Take rate above what the market bears                             | High         | Modelled at 6%; expect 4%. SaaS is the larger line by design.                             |
| Regulatory — PA, lending, IPRS/PPL, DPDP                          | High         | PA product not own escrow; NBFC partner for financing; licensee position per booking type |
| Stage production cost                                             | Medium       | Clip-first, ₹18L cap; if CAC >₹120 the format is wrong, not underfunded                   |
| Solo founder, eight modules                                       | Medium       | Sequenced release; only three modules by launch                                           |

---

## 12. Open questions

| #   | Question                                                                                    | Blocks                                     | Owner         |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| 1   | Is late payment the manager's biggest problem, or is it deal flow?                          | Whether the whole wedge is right           | Interviews    |
| 2   | Will a manager accept a 6% cut?                                                             | The GMV revenue line                       | Interviews    |
| 3   | Is ₹4,999/month acceptable to an Indian manager?                                            | The largest revenue line                   | Interviews    |
| 4   | Do 8 of 100 Indian weddings hire live music at ₹1.8L?                                       | 43% of market size                         | Planner calls |
| 5   | Which repo holds the Third Eye nine-stage pipeline, and is the ML stage real or scaffolded? | M7 estimate, by weeks                      | Founder       |
| 6   | Is 9 September a real deadline or self-imposed?                                             | Whether to compress or take two more weeks | Founder       |

**Questions 1–4 are answerable in three weeks for about ₹40,000.** Nothing in this document is trustworthy until they are.

---

## 13. Appendix — document map

| Doc                    | Contains                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `01-PRODUCT.md`        | Product overview and roadmap                                                         |
| `02-ARCHITECTURE.md`   | Modules, services, ADRs                                                              |
| `03-DATA-MODEL.md`     | Schema, RLS, triggers, migration order                                               |
| `04`–`11`              | One per module: Profiles, Gigs, Collabs, Studio, Stage, Payments, Promotion, Credits |
| `12-API.md`            | Endpoints, contracts, error codes                                                    |
| `13-DESIGN-SYSTEM.md`  | Tokens, components, mobile rules                                                     |
| `14-BUILD-SEQUENCE.md` | Milestones with definitions of done                                                  |
| `15-TESTING.md`        | Three blocking CI gates                                                              |
| `16-MASTER-PROMPT.md`  | Paste-in context and task blocks                                                     |
