# 11 — Master Prompt

Two ways to use this.

**If you are in Claude Code inside the repo:** you don't need to paste anything. `CLAUDE.md` loads automatically. Just use a task block from Section B, and name the doc to read first.

**If you are in Claude chat, or a fresh session outside the repo:** paste Section A first, then one task block.

---

# SECTION A — Context

You are building **SHOUTOUT**: one platform for the independent music economy. India first, built to work in any market that runs on managers and WhatsApp.

## The thesis

Every request in the music industry is the same object.

> **A Shout is a call that someone answers.**

A producer needs a vocalist. An organiser needs a headliner. A guitarist needs a drummer. A brand needs an artist. A creator needs a cleared track.

These are not five products. They are five values of `shouts.type`.

**Twelve types today. A thirteenth costs a row in a config file — never a new table, never a new code path.**

## The seven singletons

There is exactly one of each. Never build a second.

| Layer | The one thing |
|---|---|
| Identity | One account, many roles held simultaneously |
| Object | One `Shout` with typed slots |
| Match engine | One scorer serving all twelve types |
| Brief schema | One `GENERATION_INTENT` |
| Money rail | One settlement path |
| Credits graph | One registry |
| Reliability | One score, held **per role** |

## The twelve types

| id | Wave | Poster | Responder | Closes with |
|---|---|---|---|---|
| `collab` | 1 | artist, manager | artist | split sheet |
| `gig` | 1 | organiser, venue, brand | artist | contract |
| `band` | 2 | artist | artist | none |
| `crew` | 2 | artist, manager | artist | contract |
| `venue` | 2 | artist or venue | both | contract |
| `rehearsal` | 2 | artist | venue | contract |
| `open` | 3 | platform | artist | scorecard |
| `brand` | 3 | brand | artist | contract |
| `sync` | 4 | brand, organiser | **a work** | licence |
| `label_pitch` | 4 | artist, manager | org | none |
| `mentor` | 4 | artist | artist | contract |
| `gear` | 4 | artist | org, artist | contract |

## Non-negotiable rules

1. **Never branch on Shout type** in the match engine or settlement rail. No `if (type === 'gig')`. Type behaviour is configuration in `packages/shout-types/registry.ts`. If you want to branch, the config is missing a field — add the field.
2. **Every table has `org_id NOT NULL` and RLS policies.** Migration 001 establishes this before any domain table. No retrofitting.
3. **A settlement cannot close until splits sum to zero.** Database trigger, not application code.
4. **No full-quality media until every split is signed.** Watermarked previews only. No override, no admin bypass.
5. **A date cannot be double-confirmed** across a roster. Partial unique index, not UI logic.
6. **SHOUTOUT never holds customer funds** — RBI payment-aggregator rules. Use a PA's split-settlement product. `packages/money` is provider-agnostic.
7. **Never call a model synchronously** in a user-facing request path. Queue it.
8. **Phone OTP only.** No passwords anywhere.
9. **Never invent a price.** Below `sample_n` 5, return `insufficient_data`.
10. **Mobile first.** LCP < 2.5s on 4G. 44px tap targets. Dense tables become stacked cards below 760px, never horizontal scroll.

## Stack

Next.js 15 App Router · TypeScript strict · Tailwind · shadcn/ui · Vercel · Supabase Postgres + pgvector + RLS · Supabase Auth phone OTP with server-side PKCE · Inngest for lifecycle workflows · BullMQ for the Studio pipeline only · Python FastAPI workers · Cloudflare R2 · WhatsApp Business API via BSP · Indian PA split-settlement · Claude (Haiku for extraction, Sonnet for parsing and copy, Opus for scoring rationale only)

## Verified economics — August 2026

- Average booking **₹75,000**, take rate **6%**, contribution **₹1,880** at 41.8% margin
- Benchmark: GigSalad published 25,235 music bookings at **$509 average** in 2025, take rate 5% falling to 2.5%. The Bash charges no commission at all.
- **Nobody in this category charges 10%.** Do not model it.
- Dual currency everywhere: USD and INR at ₹85/$1

## Working style

- **One step at a time.** One instruction, wait for the result, then the next.
- Read the relevant `docs/*.md` before writing code for that area.
- Execution-first. No preamble, no summarising the request back.
- Show formulas; never hardcode a computed result.
- Money is `bigint` paise. Never float.
- **If a rule above conflicts with the request, say so and stop.** Do not silently work around it.

---

# SECTION B — Task blocks

Pick one. Do not combine two.

## B1 — Foundation

```
Read docs/02-ARCHITECTURE.md and docs/03-DATA-MODEL.md.

Initialize the SHOUTOUT monorepo per the layout in 02. pnpm workspaces, turbo,
shared tsconfig, ESLint + Prettier, Husky pre-commit, .env.example per app.

Then write Supabase migration 001 exactly as specified in 03: orgs, org_members,
current_org_id(), RLS enabled, the policy template.

Give me migration 001 alone. I will run it and paste the output before you write 002.
```

## B2 — RLS gate

```
Read docs/10-TESTING.md.

Build the RLS cross-tenant test suite. It must enumerate tables from
information_schema so a new table with no policy FAILS automatically rather than
passing silently. Cover SELECT, INSERT, UPDATE, DELETE and org_id injection,
through PostgREST, Realtime and storage paths.

Wire it into CI as a blocking gate.
```

## B3 — The Shout object

```
Read docs/03-DATA-MODEL.md and docs/04-SHOUT-TYPES.md.

Build packages/shout-types with the registry contract from 04, configured for
`collab` and `gig` only. Then migration 003 for shouts, shout_slots and answers,
with the state machine enforced by trigger.

Requirement: slots fill INDEPENDENTLY. One Shout carries a songwriter slot on
points and a vocalist slot on a flat fee, closed separately.

Do not model this as separate tables per type. Resist that.
```

## B4 — Match engine

```
Read docs/04-SHOUT-TYPES.md.

Build packages/match. One scorer, all types. It reads registry[type].matchWeights
and must contain zero occurrences of `type === '`.

score = roleMatch × attributeFit × availability × priceBandFit
      × reliability × responsiveness

Semantic layer: embeddings over GENERATION_INTENT in pgvector, hybrid with
Postgres FTS. No search cluster.

Return score_components with every result — an unexplained ranking is not trusted.
Check availability live against the holds ledger.
```

## B5 — Split sheets

```
Read docs/03-DATA-MODEL.md section 004.

Build works and contributors with the lock trigger. Writer % and master % are
SEPARATE columns, each must total exactly 100 before a work can lock.

Flow: create work → add contributors by name and phone → live running total,
red until 100 → dispatch signature requests over WhatsApp → OTP signing →
lock on final signature → immutable thereafter, amendments create a new version.

Then the PDF and the public /w/:id share page.

The lock is the product. Make it feel final.
```

## B6 — Settle rail

```
Read docs/08-MONEY.md completely before writing anything.

Build packages/money: provider-agnostic SettlementProvider interface, double-entry
ledger with the balance trigger, split execution, payout tracking with UTR.

TDS 194J and GST computed and DISPLAYED BEFORE contract signature, never after.
The quote, the contract and the settlement must show the same net figure.

Sidemen are paid on the same rail at the same time as everyone else.

Before writing code, confirm hold-period mechanics, refund and chargeback flow
against the PA's live API — not the docs.
```

## B7 — Holds

```
Read docs/03-DATA-MODEL.md section 005 and docs/07-WORKFLOWS.md.

Build the holds ledger. Every soft hold has a mandatory release deadline. Hold 1
has right of first refusal; when challenged it has 48 hours to confirm or drop.

Enforce no-double-confirm with a partial unique index, not application code.

Auto-release fires from a scheduled Inngest function, never a user action.
99.99% reliability required — a missed release causes a double-booking, which is
a reputational event for the manager, not merely a bug.
```

## B8 — Lifecycle workflows

```
Read docs/07-WORKFLOWS.md.

Build the Inngest functions in the inventory table. Every function is idempotent
and keyed on entity id plus step name. Never send a notification outside a
step.run — a retry would send it twice.

payout.sla uses BUSINESS days with an Indian public holiday calendar in config.

Note the two dates: from 1 Oct 2026 service-window messages become chargeable,
and from 1 Aug 2026 AI replies carry a per-token charge.
```

## B9 — UI

```
Read docs/06-DESIGN-SYSTEM.md.

Build packages/ui. Two registers — warm for culture surfaces, precise for money
surfaces. Take a deliberate design position; this is not a default Tailwind theme.

Priority components: MoneyValue (dual currency, tabular numerals), SplitBar (live
total, red until exactly 100), ShoutComposer (registry-driven, one slot by default,
never render an empty second slot), ScoreBreakdown, HoldCalendar, DataList.

Mobile first. 44px tap targets. Dense tables become stacked cards below 760px.
WCAG 2.2 AA.
```

## B10 — Add a Shout type

```
Read docs/04-SHOUT-TYPES.md.

Add the `[TYPE]` type to packages/shout-types/registry.ts.

Requirements: no migration, no new table, no change to packages/match or
packages/money. Only a config object, its slotRoles added to the vocabulary,
its attributeSchema, and copy strings.

If it cannot be expressed this way, stop and tell me which registry field is
missing. Do not add a branch.
```

## B11 — API surface

```
Read docs/05-API.md.

Build the route handlers for [AREA]. Validate with Zod, resolve org from SESSION
never from a client parameter, call a package, serialise.

No business logic in a handler.

Every webhook verifies its signature before reading the body.
Idempotency-Key required on every POST that moves money.
```

## B12 — Studio

```
Read docs/09-BUILD-SEQUENCE.md M5.

This is a MERGE of two existing assets, not a port of one.

From MusicGenAI: the 19-field → GENERATION_INTENT semantic engine, AI-suggest
that enhances rather than replaces user input, Web Audio scratch preview, album mode.

From the Third Eye music studio: the nine-stage pipeline intact, BullMQ queue,
Python ML workers, FFmpeg post-processing, the separate video worker.

Stage 3 of the pipeline is the Music Intent Object — which IS GENERATION_INTENT.
That is the seam.

Before starting: confirm which repo the nine-stage pipeline lives in and whether
the Python ML stage is real inference or scaffolded.
```

---

# SECTION C — Using this well

- **Paste Section A every time** in a fresh chat session. Without it, the assistant invents architecture that contradicts the repo.
- **One task block per session.** These are large; combining them produces shallow output on all of them.
- **When something changes, update the doc, not just the conversation.** `docs/` is the source of truth, and `CLAUDE.md` is what the agent reads first.
- **Expect pushback.** If the assistant says a request conflicts with a rule in Section A, it is doing its job. Decide, then tell it the decision stands — but do not let it relitigate a settled call every session.
