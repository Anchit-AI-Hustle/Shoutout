# 10 — Promotion

Grow an audience and sell to it. Website acquisition, release campaigns, fan lists, lifecycle messaging.

## The structural advantage nobody else has

**Every artist profile and every public brief is an indexable page.** A competitor with 30,000 artists and no SEO strategy has 30,000 wasted pages. Server-render them and the product becomes its own acquisition channel — you rank for _"book a wedding singer in Gurgaon"_ without buying the click.

## Three funnels, one site

A manager and a wedding planner want opposite things and share almost no vocabulary. **Do not merge these.**

| Funnel        | Entry                                                      | Conversion event                            | Then                          |
| ------------- | ---------------------------------------------------------- | ------------------------------------------- | ----------------------------- |
| **Manager**   | `/for-managers`, city pages, artist referral               | Org created + **second artist added**       | 14-day trial → paid           |
| **Artist**    | Stage auditions, Liner content, profile pages, communities | Profile complete + first collab application | Free — monetised via the rail |
| **Organiser** | `/book/[genre]-in-[city]`, artist profiles, direct search  | Brief posted                                | Shortlist → hold → contract   |

**The second artist is the real activation moment for a manager.** One artist is a note-taking app; two is a roster.

## Page inventory

| Page                        | Render                | Job                                                                         |
| --------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `/`                         | Static                | Explain in eight seconds, route to one of three funnels                     |
| `/for-managers`             | Static                | The paying-customer page. Pricing **inline**, not on a separate page.       |
| `/book-artists`             | Static                | Organiser page. Verified acts, real prices, money held.                     |
| `/a/[slug]`                 | **ISR**               | Public EPK — the SEO engine, one page per artist                            |
| `/book/[genre]-in-[city]`   | **ISR, programmatic** | Long-tail intent capture, auto-generated from live data                     |
| `/w/[id]`                   | ISR                   | Public split sheet. Artists send these to labels — it earns backlinks free. |
| `/split-sheet`              | Static                | The free tool as a landing page. Highest-intent top of funnel.              |
| `/pricing`                  | Static                | Say the take rate out loud. Hiding it costs more than it saves.             |
| `/stage/[season]/standings` | ISR                   | Drives return visits between episodes                                       |

## Programmatic SEO — the highest-leverage build

```
/book/hip-hop-in-gurgaon

H1          Book a hip-hop artist in Gurgaon
Above fold  live count of available acts
            real fee band from benchmark_index (p25–p75)
            three artist cards, ISR-refreshed
Body        what this booking typically includes
            typical fee by event type (wedding / corporate / club)
            what to check before booking
Schema      LocalBusiness + Service + FAQPage
CTA         Post your date → brief form, pre-filled with genre and city
```

12 genres × 20 cities = 240 potential pages.

**Guardrail: never publish a cell with fewer than 3 live artists, or a fee band below `sample_n` 5.** A thin page ranks for nothing and dilutes the whole domain. Publish only the cells with real supply.

## Lifecycle sequences

Every one is an Inngest function. **WhatsApp primary, email secondary.**

| Trigger                           | Sequence                                                            | Goal                          |
| --------------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| Signed up, no profile 24h         | One nudge with a preview of the EPK they'd get                      | Profile completion            |
| Profile complete, no activity 72h | Three open collabs or gigs they could answer today                  | First action                  |
| Request posted, no applicants 48h | Coaching: widen the brief, add a reference, adjust terms            | Fill rate                     |
| Applied, poster silent 72h        | Nudge the poster — **silence is the top churn cause on both sides** | Response rate                 |
| Split sheet unsigned 24h          | Remind each unsigned party individually                             | Signature completion          |
| **Audition rejected**             | Scorecard + free EPK + local gigs + role invite                     | **>60% profile completion**   |
| Hold expiring 48h                 | Both sides, escalating                                              | Hold conversion               |
| Booking settled                   | Receipt, then review request at +2 days                             | Reliability data              |
| Booking at T+11 months            | Re-book: "this time last year you booked X"                         | Cheapest revenue in the model |
| Trial day 11 of 14                | Usage summary — what they did, what it saved                        | Trial conversion              |
| Roster stuck at 1, 14 days        | CSV import prompt                                                   | Expansion                     |
| Payment failed                    | Dunning day 0, 3, 7 — **downgrade, never delete**                   | Involuntary churn             |

## WhatsApp cost rules

Meta charges by category and marketing is 7–8× utility.

- **Everything that can legitimately be a utility template must be one.** Only genuine promotion is marketing.
- **From 1 Oct 2026, service-window messages become chargeable.** Any flow relying on "the customer messaged first so it's free" needs re-costing before that date.
- **From 1 Aug 2026, AI-generated replies carry a per-token charge.**
- Track template delivery rate. **Alert below 97%.**

## Release campaigns

Booking confirmed → announce creative generated → city-targeted audience built from the artist's fan list → presale to top-tier fans → post-show content pack. **Zero manual work between booking and promotion.**

## Fan lists

QR capture at gigs → phone → consent → fan record **owned by the artist**. Segmentation by city, attendance, spend. Tiers from proof-of-attendance.

**Consent architecture:** fans consent to the **artist**; ShoutOut is the processor. DPDP requirement and the entire positioning. Full export available at any time — the promise is ownership, so exit must be frictionless. **Build the export before the import.**

## Conversion work

| Surface         | Problem                                     | Test                                                                   |
| --------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Collab composer | Multi-slot forms are where people quit      | One slot by default. Never render an empty second slot.                |
| Signup          | Password creation kills the audition funnel | Phone OTP only                                                         |
| Artist profile  | Empty profiles convert nothing              | Pre-fill from one uploaded track; user confirms rather than authors    |
| Pricing         | The take rate is the objection              | Show the arithmetic on a real booking                                  |
| Organiser brief | They don't know their budget                | Show the index band **before** asking. Anchoring beats an empty field. |
| Mobile          | Managers work backstage on 3G               | Every conversion path under 2.5s LCP on 4G                             |

## Measurement

```
NORTH STAR    settled money on the rail

ACQUISITION   organic → signup                3.5%
              programmatic page → brief       1.8%
              artist profile → quote request  2.2%

ACTIVATION    signup → profile complete       65%
              profile → first action          40%
              rejection → profile complete    60%   ← the one

REVENUE       trial → paid                    22%
              take-rate acceptance            measure, do not assume

RETENTION     week-4 return                   45%
              off-platform leakage            <20%
              repeat organiser rate           40%
```

PostHog for product funnels and session replay. Metabase on a read replica for anything involving money. GA4 + Search Console on the marketing surface only.
