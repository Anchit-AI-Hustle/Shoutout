# SHOUTOUT — Project Context

You are building SHOUTOUT: **one platform** for the independent music economy. Read this file before any task. Everything below is a rule, not a suggestion.

---

## What this is

A single product where every request in the music industry is the same object: a **Shout** — a call that someone answers.

A producer needs a vocalist. An organiser needs a headliner. A guitarist needs a drummer. A brand needs an artist. All of these are one row in `shouts` with a different `type` and different slot roles.

**Twelve types today. Adding a thirteenth costs a row in a config file, never a new table or a new code path.**

---

## The seven singletons

There is exactly one of each. Never build a second.

| Layer | The one thing | Location |
|---|---|---|
| Identity | One account, many roles | `orgs` + `org_members` + `artists` |
| Object | One `Shout` with typed slots | `shouts` + `shout_slots` + `answers` |
| Match engine | One scorer for all types | `packages/match` |
| Brief schema | One `GENERATION_INTENT` | `packages/intent` |
| Money rail | One settlement path | `packages/money` |
| Credits graph | One registry | `works` + `credits` |
| Reliability | One score, held per role | `reliability_scores` |

---

## Non-negotiable rules

1. **Never branch on Shout type in the match engine or the settlement rail.** No `if (type === 'gig')`. Type-specific behaviour lives in `packages/shout-types/registry.ts` as configuration. If you feel the need to branch, the config is missing a field — add the field.
2. **Every table carries `org_id NOT NULL` and has RLS policies.** No exceptions. No retrofitting. Migration `001` establishes this before any domain table exists.
3. **A settlement cannot close until its splits sum to zero.** Enforced by a database trigger, not application code.
4. **No stems, masters or full-quality media are released until every split on the work is signed.** Watermarked previews only before that. There is no override path and no admin bypass.
5. **A date cannot be double-confirmed across a roster.** Enforced by a partial unique index, not by the UI.
6. **SHOUTOUT never holds customer funds.** Use the payment aggregator's split-settlement product. `packages/money` is provider-agnostic behind an interface.
7. **Never call a model synchronously in a user-facing request path.** Queue it, return a job id, stream or poll the result.
8. **Phone OTP is the only auth path.** No passwords anywhere in the product.
9. **Never invent a price.** If a benchmark index cell has `sample_n < 5`, return `insufficient_data`. Do not interpolate.
10. **Mobile first, always.** Target LCP < 2.5s on 4G. Minimum 44px tap targets. Dense tables degrade to stacked cards below 760px, never horizontal scroll.

---

## Stack

- **Web:** Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Vercel
- **Data:** Supabase Postgres + pgvector + RLS
- **Auth:** Supabase Auth, phone OTP, PKCE with **server-side** code exchange
- **Workflows:** Inngest (durable, `step.sleepUntil`) — lifecycle sequences
- **Queue:** BullMQ on Redis — Studio generation pipeline only. Two queues, different jobs, never merged.
- **Workers:** Python FastAPI, Dockerised — audio analysis, ML inference
- **Storage:** Cloudflare R2 (signed direct upload, never proxy media through the API)
- **Messaging:** WhatsApp Business API via BSP. Email secondary.
- **Payments:** Indian PA split-settlement (Razorpay Route or Cashfree Easy Split)
- **AI:** Claude — Haiku 4.5 for extraction, Sonnet 5 for parsing/quotes/copy, Opus 5 for scoring rationale only

---

## Commands

```bash
pnpm dev                  # all apps
pnpm dev --filter=web     # web only
pnpm test                 # unit
pnpm test:rls             # RLS cross-tenant suite — BLOCKING GATE
pnpm test:money           # settlement invariants — BLOCKING GATE
pnpm test:e2e             # Playwright
pnpm db:migrate           # apply migrations
pnpm db:types             # regenerate Supabase types
pnpm lint && pnpm typecheck
```

---

## Conventions

- Server Components by default. `'use client'` only where interaction requires it.
- Route handlers in `apps/web/app/api/**`. Business logic lives in `packages/*`, never in route handlers.
- Zod schema for every API boundary **and** every AI structured output. Reject and retry malformed model output; never persist it.
- Money is `bigint` paise. Never float. Never store rupees.
- All timestamps `timestamptz`, stored UTC.
- Errors: `{ error: { code, message, details? } }`. Codes are `SCREAMING_SNAKE`.
- Never log PII, tokens, or full phone numbers. Mask to last 4.

---

## Working style

- **One step at a time.** Give one instruction, wait for the result, then the next.
- Read the relevant `docs/*.md` before writing code for that area.
- When a rule above conflicts with a request, say so and stop. Do not silently work around it.
- Prefer deleting code to adding abstraction.

---

## Documentation map

| File | Read before |
|---|---|
| `docs/01-PRODUCT.md` | Any product decision |
| `docs/02-ARCHITECTURE.md` | Any structural change |
| `docs/03-DATA-MODEL.md` | Any migration |
| `docs/04-SHOUT-TYPES.md` | Anything touching Shouts |
| `docs/05-API.md` | Any route handler |
| `docs/06-DESIGN-SYSTEM.md` | Any UI |
| `docs/07-WORKFLOWS.md` | Any Inngest function or notification |
| `docs/08-MONEY.md` | Anything touching money |
| `docs/09-BUILD-SEQUENCE.md` | Starting a new milestone |
| `docs/10-TESTING.md` | Writing tests or CI |
