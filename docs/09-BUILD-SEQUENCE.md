# 09 — Build Sequence

Ordered by leverage per week. Each milestone has a definition of done. **Do not start the next until the current one is done.**

## Launch scope — by 9 September

Two types live: **`collab`** and **`gig`**. The object, the identity, the graph. Rail stubbed.

Everything else is a registry flag flipped later. **One product does not mean one launch date.**

---

## M0 — Foundation · W1

**Scope**
- Monorepo scaffold, CI, preview deploys
- New Supabase project. Migration 001: `org_id` + RLS + `current_org_id()`
- Auth: phone OTP, PKCE **server-side** code exchange
- `packages/ui` base
- RLS test suite wired as a blocking CI gate

**Parallel, non-code — start day one**
- WhatsApp BSP application + all templates submitted (2–3 week lead time)
- Pvt Ltd incorporation begun
- PA account opened (~2 day activation)

**Done when:** two seeded orgs provably cannot see each other's rows, by a test that runs on every commit and fails automatically for any table missing a policy.

---

## M1 — The Shout object · W2–3

**The highest-leverage build in the company.** Every other module is a specialisation of this.

**Scope**
- `packages/shout-types` registry with `collab` + `gig` configured
- Migration 003: `shouts`, `shout_slots`, `answers`
- State machine enforced by database trigger, not application code
- `packages/match` — one scorer reading `registry.matchWeights`
- Port `packages/intent` from MusicGenAI, with parity tests
- pgvector embeddings over intent objects

**Done when:** a Shout with a songwriter slot on points and a vocalist slot on a flat fee can be posted, matched and closed **independently**, with no `if (type === ...)` anywhere in `packages/match`.

---

## M2 — Split sheets · W3–4

**The launch product.**

**Scope**
- Migration 004: `works`, `contributors`, lock trigger
- Create work → add contributors → writer % and master % as separate columns
- Live running total, red until exactly 100
- WhatsApp signature dispatch, OTP signing, timestamped
- Lock on final signature — immutable thereafter
- PDF generation + public `/w/:id` share page
- Media gate: full quality only after splits signed

**Done when:** three people sign a split sheet from three different phones, the work locks, the PDF generates, and no path exists to edit it afterwards.

---

## M3 — Concierge + gig Shouts · W4–5

**Scope**
- Public `/book` brief intake → WhatsApp notification
- Gig-type Shouts reusing the existing engine — configuration only
- Migration 005: `holds` with the partial unique index
- Auto-release via `pg_cron` + Inngest
- Quote generator reading the index, returning `INSUFFICIENT_INDEX_DATA` below `sample_n` 5

**Prerequisite:** 25 bookings brokered by hand first. Those deals define the schema and seed the index. **Do not build this before doing that.**

**Done when:** a date cannot be double-confirmed across a roster, proven by a test.

---

## M4 — Settle rail · W6–8

**Scope**
- `packages/money` provider-agnostic interface
- Double-entry ledger with the balance trigger
- Contract generation + Aadhaar eSign + per-state stamping
- TDS 194J and GST computed and shown **pre-signature**
- Split execution, payout tracking with UTR
- Daily reconciliation job

**Gate:** PA agreement signed before build starts. Verify hold-period mechanics, refund and chargeback flow **against the live API, not the docs.**

**Done when:** a three-way split settles to zero automatically, every payee's UTR tracked, and the ledger balances.

---

## M5 — Studio · W7–9

Merge of two existing assets, not a port of one.

- **From MusicGenAI:** `@shoutout/intent`, AI-suggest, Web Audio scratch preview, album mode
- **From Third Eye:** the nine-stage pipeline, BullMQ queue, Python ML workers, FFmpeg post-processing, video worker

**Stage 3 of the pipeline is the Music Intent Object — which *is* `GENERATION_INTENT`.** Both projects were already built around the same object without being connected. That is what makes this merge cheap.

**Blocker:** confirm which repo the nine-stage pipeline actually lives in, and whether the Python ML stage is real inference or scaffolded. That answer moves this estimate by weeks.

---

## M6 — Manager OS · W9–12

Roster pipeline, holds calendar, quote generator, commission splits, artist read-only portals.

**Acceptance:** inbound WhatsApp message to sent quote in under 90 seconds, on a phone, at 3G.

---

## M7+ — Waves 2, 3, 4

Flip registry flags. `band`, `crew`, `venue`, `rehearsal` need no new tables. `open` needs the audition intake. `sync` needs `responder: 'work'` resolution. `mentor`, `label_pitch`, `gear` are configuration.

---

## The sequencing logic

**Collab before gigs, even though gigs carry the GMV.**

Collaboration needs no organisers, no season, no sales team. Two producers and one vocalist is already a working network. It is the cheapest possible proof that the primitive works, it creates daily habit that gig booking never will, and every split sheet signed populates the credits graph for free.

Gig booking is transactional — a manager returns when there is a date to fill. Collaboration is daily.
