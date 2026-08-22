# 16 — Master Prompt

**In Claude Code inside the repo:** you don't paste anything. `CLAUDE.md` loads automatically. Pick a task block from Section B and name the doc to read first.

**In Claude chat, or a fresh session outside the repo:** paste Section A, then one task block.

---

# SECTION A — Context

You are building **ShoutOut**: an all-in-one platform for the independent music industry in India.

ShoutOut is the brand name. It is not a data model or a metaphor. **The product is eight modules on shared services** — the way Shopify is Products, Orders, Customers, Payments and Marketing on one account and one payment rail.

## The eight modules

| Module        | What a user does                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Profiles**  | Be findable. One account, many roles held at once. Auto-generated EPK.                                                    |
| **Gigs**      | Get booked and book acts. Weddings, corporate, college, clubs, festivals, folk, classical, government.                    |
| **Collabs**   | Find people to make music with. A producer needs a vocalist. A guitarist needs a drummer. An artist needs a tour manager. |
| **Studio**    | Make music and describe the sound you want. Generation, references, stems, BPM/key detection, sync variants.              |
| **Stage**     | Compete and be discovered. Season shows and city leagues, all genres.                                                     |
| **Payments**  | Get paid. Contracts, splits, settlements, payouts — including session players.                                            |
| **Promotion** | Grow an audience. Website funnels, release campaigns, fan lists, lifecycle messaging.                                     |
| **Credits**   | Own your work. Split sheets signed before files move.                                                                     |

## Shared services — exactly one of each

`identity` · `discovery` (search + ranking, used by **both** Gigs and Collabs) · `money` · `messaging` · `media` · `calendar` · `trust` · `intent` (the `MUSIC_BRIEF` schema)

**Modules share services. They never duplicate them.** If Gigs needs search, it calls `packages/discovery`. A second search implementation is a failed review.

## Non-negotiable rules

1. **Every table has `org_id NOT NULL` and RLS policies.** Migration 001 before any domain table. No retrofitting.
2. **A settlement cannot close until splits sum to zero.** Database trigger, not application code.
3. **No full-quality stems until every split is signed.** Watermarked previews only. No override, no admin bypass.
4. **A date cannot be double-confirmed** for one artist. Partial unique index, not UI logic.
5. **ShoutOut never holds customer funds** — RBI payment-aggregator rules. Use a PA's split-settlement product.
6. **Never call a model synchronously** in a user-facing request path. Queue it.
7. **Phone OTP only.** No passwords anywhere.
8. **Never invent a price.** Below `sample_n` 5, return `insufficient_data`.
9. **Modules share services, never duplicate them.**
10. **Mobile first.** LCP < 2.5s on 4G. 44px tap targets. Dense tables become stacked cards below 760px.

## Stack

Next.js 15 App Router · TypeScript strict · Tailwind · shadcn/ui · Vercel · Supabase Postgres + pgvector + RLS · phone OTP with server-side PKCE · Inngest for lifecycle · BullMQ for the Studio pipeline only · Python FastAPI workers · Cloudflare R2 · WhatsApp via BSP · Indian PA split-settlement · Claude (Haiku extraction, Sonnet parsing and copy, Opus scoring rationale only)

## Verified economics — August 2026

- Average booking **₹75,000**, take rate **6%**, contribution **₹1,880** at 41.8% margin
- Benchmark: GigSalad published 25,235 music bookings at **$509 average** in 2025, take rate 5% falling to 2.5%. The Bash charges no commission at all.
- **Nobody in this category charges 10%.** Do not model it.
- Dual currency everywhere, USD and INR at ₹85/$1

## Working style

- **One step at a time.** One instruction, wait for the result, then the next.
- Read the relevant `docs/*.md` before writing code for that area.
- Execution-first. No preamble, no restating the request.
- Money is `bigint` paise. Never float.
- **If a rule conflicts with the request, say so and stop.** Do not silently work around it.

---

# SECTION B — Task blocks

One per session. Do not combine.

## B1 — Foundation

```
Read docs/02-ARCHITECTURE.md and docs/03-DATA-MODEL.md.

Initialize the monorepo per the layout in 02 — apps/, modules/, packages/.
pnpm workspaces, turbo, shared tsconfig, ESLint + Prettier, Husky.

Then Supabase migration 001 exactly as specified in 03: orgs, org_members,
current_org_id(), RLS enabled, the policy template every later table follows.

Give me migration 001 alone. I will run it and paste the output before you
write 002.
```

## B2 — RLS gate

```
Read docs/15-TESTING.md.

Build the cross-tenant test suite. It must enumerate tables from
information_schema so a new table with no policy FAILS automatically rather
than passing silently. Cover SELECT, INSERT, UPDATE, DELETE, org_id injection,
and access via PostgREST, Realtime and storage paths.

Wire into CI as a blocking gate.
```

## B3 — Credits (the launch product)

```
Read docs/11-CREDITS.md and docs/03-DATA-MODEL.md section 003.

Build works and contributors with the lock trigger. Writer % and master % are
SEPARATE columns. Each must total exactly 100, and every contributor must have
signed, before status can become 'locked'. Enforce in Postgres.

Flow: create work → add contributors by name and phone → live running total,
red until 100 → dispatch signature requests over WhatsApp → OTP signing →
lock on final signature → immutable, amendments create a new version.

Each signer sees the FULL split, not just their own share.

The lock is the product. Make it feel final.
```

## B4 — Concierge Gigs

```
Read docs/05-GIGS.md.

Build a single public page at /book. Form: name, phone, city, date, event type,
budget band, genre, notes. On submit write to Supabase and send me a WhatsApp
notification. Confirmation says I'll reply within 4 hours.

No auth, no accounts. Mobile first. This ships on day 3 and generates revenue
before any product exists.
```

## B5 — Profiles

```
Read docs/04-PROFILES.md.

Build artists, artist_roles and roster. ONE ACCOUNT HOLDS MANY ROLES —
artist_roles is unique on (artist_id, role), and matching happens per role,
never per person.

Then attribute pre-fill: user uploads one track, apps/workers extracts BPM, key
and genre, the form opens pre-filled, the user CONFIRMS rather than authors.

Then EPK generation and the public ISR profile page.
```

## B6 — Discovery

```
Read docs/02-ARCHITECTURE.md and docs/06-COLLABS.md.

Build packages/discovery. ONE engine serving both Gigs and Collabs, with
different attribute weights per use case. Never two implementations.

score = roleMatch × attributeFit × availability × priceBandFit
      × reliability × responsiveness

Attribute fit is what wins: vocal range against the song's key, language against
lyric language, timbre against mood, BPM comfort, turnaround against deadline.

Semantic layer: embeddings over MUSIC_BRIEF in pgvector, hybrid with Postgres
FTS. No search cluster.

Always return score_components. An unexplained ranking is not trusted.
Check availability live against packages/calendar.
```

## B7 — Calendar and holds

```
Read docs/05-GIGS.md and docs/03-DATA-MODEL.md section 004.

Build packages/calendar. Every soft hold has a mandatory expiry. Hold 1 has
right of first refusal; when challenged it has 48 hours to confirm or drop.

Enforce no-double-confirm with a partial unique index, not application code.

Auto-release fires from a scheduled Inngest function, never a user action.
99.99% reliability — a missed release causes a double-booking, which is a
reputational event for the manager, not merely a bug.
```

## B8 — Payments

```
Read docs/09-PAYMENTS.md completely before writing anything.

Build packages/money: provider-agnostic SettlementProvider interface,
double-entry ledger with the balance trigger, split execution, payout tracking
with UTR.

TDS 194J and GST computed and DISPLAYED BEFORE contract signature, never after.
Quote, contract and settlement must show the same net figure.

Session players are paid on the same rail at the same time as everyone else.

Before coding, confirm hold-period mechanics, refund and chargeback flow against
the PA's live API — not the docs.
```

## B9 — Collabs

```
Read docs/06-COLLABS.md.

Build collab_requests, collab_slots, applications and rooms.

Slots fill INDEPENDENTLY. One request carries a songwriter slot on points and a
vocalist slot on a flat fee, closed at different times. comp_model 'credit'
must be explicitly chosen, never defaulted.

On acceptance: open a Room with versioned immutable stem uploads, and auto-draft
the split sheet from the slots.

No full-quality stems until every split is signed. Watermarked previews only.
```

## B10 — Studio

```
Read docs/07-STUDIO.md.

This is a MERGE of two existing assets, not a port of one.

From MusicGenAI: the 19-field → MUSIC_BRIEF semantic engine, AI-suggest that
ENHANCES existing input rather than replacing it, Web Audio scratch preview,
album mode.

From the Third Eye music studio: the nine-stage pipeline intact, BullMQ queue,
Python ML workers, FFmpeg post-processing, the separate video worker.

Stage 3 of the pipeline is the MUSIC BRIEF object — that is the seam where they
join.

Before starting: confirm which repo the nine-stage pipeline lives in and whether
the Python ML stage is real inference or scaffolded.

Start with audio analysis on every upload — it is the backbone that makes
matching work without manual metadata.
```

## B11 — Stage

```
Read docs/08-STAGE.md.

Build audition intake: multi-language landing pages per bracket and city, phone
OTP entry with no password, sub-90-second video with signed direct upload to R2,
90-second cap enforced client AND server side, resumable.

Then auto-scoring plus a HUMAN review queue. The model rationale is shown; the
model never decides alone.

Then the rejection-to-onboarding sequence: scorecard + free EPK + open gigs in
their city + role invite. Target above 60% profile completion. Instrument this
above everything else.

Load requirement: 5,000 uploads in one hour when a season opens.
```

## B12 — Promotion

```
Read docs/10-PROMOTION.md.

Build the three funnels and the page inventory. Then programmatic
/book/[genre]-in-[city] generated from live data.

GUARDRAIL: never publish a cell with fewer than 3 live artists or a fee band
below sample_n 5. A thin page ranks for nothing and dilutes the whole domain.

Then the lifecycle sequences in Inngest. WhatsApp primary, email secondary.
Everything that can be a utility template must be one — marketing is 7–8× the cost.
```

## B13 — UI

```
Read docs/13-DESIGN-SYSTEM.md.

Build packages/ui. Two registers — warm for culture surfaces (Collabs, Stage),
precise for money surfaces (Payments, Credits). Take a deliberate design
position; this is not a default Tailwind theme.

Priority: MoneyValue (dual currency, tabular numerals), SplitBar (live total,
red until exactly 100), CollabComposer (one slot by default, never render an
empty second slot), ScoreBreakdown, HoldCalendar, DataList.

Mobile first. 44px tap targets. Dense tables become stacked cards below 760px.
WCAG 2.2 AA.
```

## B14 — API surface

```
Read docs/12-API.md.

Build route handlers for the [MODULE] module. Validate with Zod, resolve org
from SESSION never from a client parameter, call the module, serialise.

No business logic in a handler.

Every webhook verifies its signature before reading the body.
Idempotency-Key required on every POST that moves money.
```

---

# SECTION C — Using this well

- **Paste Section A every time** in a fresh chat outside the repo. Without it the assistant invents architecture that contradicts what exists.
- **One task block per session.** Combining them produces shallow output on all of them.
- **When something changes, update the doc, not just the conversation.** `docs/` is the source of truth; `CLAUDE.md` is what the agent reads first.
- **Expect pushback.** If the assistant says a request conflicts with a rule in Section A, it is doing its job. Decide, then tell it the decision stands — but don't let it relitigate a settled call every session.
- **Start with B1, then B2.** Every feature after that depends on the RLS gate existing.
