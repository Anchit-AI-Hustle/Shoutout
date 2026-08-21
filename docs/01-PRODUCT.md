# 01 — Product

## Thesis

One platform. Every request in the music industry is the same object.

> **A Shout is a call that someone answers.**

A producer needs a vocalist. An organiser needs a headliner. A guitarist needs a drummer. A brand needs an artist. A creator needs a cleared track. These are not five products — they are five values of `shouts.type`.

## Why this is one product and not a suite

| Layer | One of | Consequence |
|---|---|---|
| Identity | `SHOUTOUT ID` | A person is an artist, a manager and an organiser at once. Roles are held, not chosen at signup. |
| Object | `Shout` + `shout_slots` + `answers` | A new request kind is config, not a table |
| Match | `packages/match` | Improving matching improves all twelve types simultaneously |
| Brief | `GENERATION_INTENT` | Studio generates from it, match reads it, sync tags with it |
| Money | `packages/money` | Collab fee, gig fee, sponsorship, licence — one path, one reconciliation |
| Credits | `works` + `credits` | Every collab writes to one graph automatically |
| Trust | `reliability_scores` | Held **per role** — a great producer can be an unreliable mix engineer |

**The test:** if adding a request type requires a new table or a new branch in the engine, the architecture has failed. See `04-SHOUT-TYPES.md`.

## Personas

| Persona | Primary job | Pays? |
|---|---|---|
| **Artist manager** | Keep 3–15 artists booked, priced right, paid on time | **Yes — the paying customer** |
| Independent artist | Get found, get booked, own the audience | No — monetised via the rail |
| Producer / writer / engineer | Find collaborators, agree splits, get paid | No — monetised via the rail |
| Organiser / promoter | Find the right act, be certain they turn up | Take rate on booking |
| Wedding / corporate planner | Vetted talent, contract, recourse | Take rate on booking |
| Venue | Fill the calendar with acts that draw | Take rate |
| Brand / sponsor | Reach a music audience with provable numbers | 15% of sponsorship |
| Label A&R | Signal, not vibes | Data seat |
| Fan | Access first | No — the artist's asset, our processed data |

**Design consequence:** a self-managed artist is an org with a roster of one and commission zero. Serve `n=1` as first-class, never as a degraded case. The upgrade path from one artist to five must require no migration.

## Jobs to be done

- *"I need a vocalist for this beat, and a writer, on different terms."*
- *"I need to know who owns what before I send the file."*
- *"I need an act for the 14th in Pune, under ₹80,000."*
- *"I need to know I'll actually get paid, and so will my drummer."*
- *"I need to know what to charge."*
- *"I need my dates in one place so I stop double-booking."*

## Twelve types, four waves

| Wave | Types | Proves |
|---|---|---|
| **Launch** | Collab, Gig | The object generalises across two genuinely different request shapes |
| **2** | Band, Crew, Venue, Rehearsal | Supply density — all artist-to-artist or artist-to-service, no new buyer to acquire |
| **3** | Open (auditions), Brand | Acquisition at scale, first brand revenue |
| **4** | Sync, Label pitch, Mentor, Gear | Monetising the graph the first three waves built |

**One product does not mean one launch date.** Every wave is a config flag, not a rebuild.

## Success metrics

North star: **settled GMV on rail** — money that actually moved and reconciled to zero.

| Branch | Metric | Target |
|---|---|---|
| Supply | Rejection → profile complete | **>60%** (the number the company lives on) |
| Demand | Brief → shortlist opened | >75% |
| Demand | Shortlist → hold placed | >35% |
| Money | Payout SLA met (T+2) | >97% |
| Money | Settlement reconciliation errors | **0** |
| Money | Off-platform leakage | <20% |
| Asset | Index coverage at n≥5 | 8 genres × 12 cities |

## Out of scope at launch

Streaming distribution · ticketing · label services · publishing administration · social feed. Each is a different company. Say no.
