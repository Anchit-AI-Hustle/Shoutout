# 14 — Build Sequence

Ordered by leverage per week. Each milestone has a definition of done. **Do not start the next until the current one is done.**

---

## M0 — Foundation · Week 1

**Scope**

- Monorepo scaffold per `02-ARCHITECTURE.md`, CI, preview deploys
- New Supabase project. Migration 001: `org_id` + RLS + `current_org_id()`
- Auth: phone OTP, PKCE **server-side** code exchange
- `packages/ui` base
- **RLS test suite wired as a blocking CI gate**

**Parallel, non-code — start day one**

- WhatsApp BSP application + every template submitted (**2–3 week lead time**)
- Pvt Ltd incorporation begun — register at ₹1 lakh authorised capital, MCA filing is nil up to ₹15 lakh
- PA account opened (~2 day activation)

**Done when:** two seeded orgs provably cannot see each other's rows, by a test that runs on every commit and **fails automatically for any table missing a policy.**

---

## M1 — Credits · Weeks 2–3

**The launch product.** Smallest thing that is independently valuable, and it compounds from user one.

- Migration 003: `works`, `contributors`, lock trigger
- Create work → add contributors by name and phone
- **Writer % and master % as separate columns**, live running total, red until exactly 100
- WhatsApp signature dispatch, OTP signing, timestamped
- Lock on final signature — immutable thereafter
- PDF generation + public `/w/:id` share page
- Media gate: full quality only after lock

**Done when:** three people sign from three different phones, the work locks, the PDF generates, and no path exists to edit it afterwards — including admin.

---

## M2 — Concierge Gigs · Weeks 3–4

Revenue and validation in the same fortnight. **No product needed on day one.**

- Public `/book` brief intake → WhatsApp notification to you
- Broker bookings by hand, record every field of every deal
- Migration 004 written from what those deals actually contain

**Those 25 hand-brokered deals define the schema and seed the price index. Do not build M4 before doing this.**

---

## M3 — Profiles · Weeks 4–5

- Migration 002: `artists`, `artist_roles`, `roster`
- One account, many roles, matched independently per role
- Attribute pre-fill from an uploaded track via `apps/workers`
- EPK generation + public ISR page

**Done when:** one user holds five roles and is matched independently on each; a profile pre-fills from one track in under 60 seconds.

---

## M4 — Gigs · Weeks 5–8

- Brief intake with WhatsApp and PDF parsing
- `packages/discovery` — one engine, gig weights
- `packages/calendar` — holds with the partial unique index, auto-release via Inngest
- Quote generator reading the index, `INSUFFICIENT_INDEX_DATA` below `sample_n` 5
- Riders with T-7 and T-2 reminders

**Done when:** a date cannot be double-confirmed across a roster, proven by test; a forwarded WhatsApp brief parses at >90% accuracy.

---

## M5 — Payments · Weeks 7–10

- `packages/money` provider-agnostic interface
- Double-entry ledger with the balance trigger
- Contracts + Aadhaar eSign + per-state stamping
- TDS 194J and GST computed and shown **pre-signature**
- Split execution, payout tracking with UTR, daily reconciliation

**Gate:** PA agreement signed before build starts. Verify hold-period mechanics, refund and chargeback flow **against the live API, not the docs.**

**Done when:** a three-way split settles to zero automatically, every payee's UTR tracked, ledger balances.

---

## M6 — Collabs · Weeks 9–12

- Migration 006: `collab_requests`, `collab_slots`, `applications`, `rooms`
- Independent slots with different comp models
- Rooms with versioned stems, chat, presence
- Split sheets auto-drafted from slots, feeding M1
- `packages/discovery` with collab weights
- Demo-to-request

**Done when:** a request with a songwriter slot on points and a vocalist slot on a fee closes each independently; 100% of closed collabs produce a locked work.

---

## M7 — Studio · Weeks 11–14

A **merge** of two assets, not a port of one.

- **From MusicGenAI:** `packages/intent`, AI-suggest, Web Audio scratch preview, album mode
- **From Third Eye:** nine-stage pipeline, BullMQ queue, Python ML workers, FFmpeg, video worker
- Audio analysis on **every** upload across the product

**Blocker to clear first:** confirm which repo the nine-stage pipeline lives in, and whether the Python ML stage is real inference or scaffolded. That answer moves this by weeks.

---

## M8 — Promotion · Weeks 13–16

- Three funnels, page inventory, programmatic `/book/[genre]-in-[city]`
- Lifecycle sequences in Inngest
- Fan capture with consent to the artist
- Release campaign automation

---

## M9 — Stage · Weeks 15–20

- Multi-language intake, phone OTP, 90-second cap, resumable upload
- Auto-scoring + HITL review queue, genre brackets
- **Rejection-to-onboarding sequence** — the number the company lives on
- Seasons, standings, alumni track

**Budget cap ₹18L.** If CAC per activated artist exceeds ₹120, the format is wrong, not underfunded.

---

## Launch scope — 9 September

**Credits + concierge Gigs.** M0, M1, M2 only.

Everything else has a real dependency that cannot be compressed:

- WhatsApp API: 2–3 weeks approval → use the **free WhatsApp Business app**, 256-contact broadcast is plenty for 50 users
- Escrow: PA onboarding → **don't hold money.** Organiser pays the artist directly; invoice your fee separately
- Pvt Ltd: 10–20 working days → operate as an individual, invoice personally

**Launch means:** 50 works with signed splits · 5 bookings brokered by hand · 1 person asking when the paid version arrives.

---

## Why Credits before Gigs

Credits needs two users to be valuable. Gigs needs a marketplace.

Credits spreads by itself — using it means inviting the people you're working with. It compounds from user one, while every other module needs liquidity first. And it is small enough that a solo founder can ship it properly in three weeks instead of shipping four modules badly.
