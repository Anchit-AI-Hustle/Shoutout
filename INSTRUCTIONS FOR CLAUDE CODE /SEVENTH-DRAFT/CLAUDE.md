# ShoutOut — Project Context

Read this before any task. Everything below is a rule, not a suggestion.

---

## What this is

**ShoutOut** is an all-in-one platform for the independent music industry in India. ShoutOut is the brand name — it is not a data model, an object type, or a metaphor to build around.

The product is **eight modules on shared platform services**, the way Shopify is Products, Orders, Customers, Payments and Marketing on one account and one payment rail.

## The eight modules

| Module        | What a user does                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Profiles**  | Be findable. Artist, manager, organiser, venue, producer, engineer — one account, roles held simultaneously. Auto-generated EPK. |
| **Gigs**      | Get booked and book acts. Weddings, corporate, college fests, clubs, festivals, folk, classical, government.                     |
| **Collabs**   | Find people to make music with. A producer needs a vocalist. A guitarist needs a drummer. An artist needs a tour manager.        |
| **Studio**    | Make music. Generation, references, stems, BPM/key detection, sync variants.                                                     |
| **Stage**     | Compete and be discovered. Season shows and city leagues across all genres.                                                      |
| **Payments**  | Get paid. Contracts, splits, settlements, payouts — including session players.                                                   |
| **Promotion** | Grow an audience. Release campaigns, fan lists, website funnels, lifecycle messaging.                                            |
| **Credits**   | Own your work. Split sheets signed before files move; a verified record of who made what.                                        |

## Shared platform services

Every module uses these. There is exactly one of each — never build a second.

| Service              | Package                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| Identity & tenancy   | `packages/identity` — one account, many roles, `org_id` on every row                    |
| Discovery & matching | `packages/discovery` — one search and ranking engine, used by Gigs and Collabs          |
| Money rail           | `packages/money` — one settlement path for gig fees, collab fees, sponsorship, licences |
| Messaging            | `packages/messaging` — WhatsApp-first, email secondary                                  |
| Media                | `packages/media` — upload, watermark, gate, transcode                                   |
| Calendar             | `packages/calendar` — availability and holds, shared by Gigs, Rehearsal and Crew        |
| Trust                | `packages/trust` — reliability score, held **per role**                                 |
| Music intelligence   | `packages/intent` — `MUSIC_BRIEF` schema, used by Studio, Collabs, Gigs and Sync        |

---

## Non-negotiable rules

1. **Every table carries `org_id NOT NULL` and has RLS policies.** Migration 001 establishes this before any domain table exists. No exceptions, no retrofitting.
2. **A settlement cannot close until its splits sum to zero.** Database trigger, not application code.
3. **No full-quality stems or masters are released until every split on the work is signed.** Watermarked previews only before that. No override, no admin bypass.
4. **A date cannot be double-confirmed for one artist.** Partial unique index, not UI logic.
5. **ShoutOut never holds customer funds.** RBI payment-aggregator rules. Use a PA's split-settlement product. `packages/money` is provider-agnostic behind an interface.
6. **Never call a model synchronously in a user-facing request path.** Queue it, return a job id, poll or stream.
7. **Phone OTP is the only auth path.** No passwords anywhere in the product.
8. **Never invent a price.** If a benchmark cell has `sample_n < 5`, return `insufficient_data`. Do not interpolate.
9. **Modules share services, they do not duplicate them.** If Gigs needs search, it calls `packages/discovery`. A second search implementation is a failed review.
10. **Mobile first.** LCP < 2.5s on 4G. 44px tap targets. Dense tables become stacked cards below 760px, never horizontal scroll.

---

## Stack

- **Web:** Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Vercel
- **Data:** Supabase Postgres + pgvector + RLS
- **Auth:** Supabase Auth, phone OTP, PKCE with **server-side** code exchange
- **Workflows:** Inngest — lifecycle sequences, `step.sleepUntil`
- **Queue:** BullMQ on Redis — Studio generation pipeline only. Two queues, different jobs, never merged.
- **Workers:** Python FastAPI, Dockerised — audio analysis, ML inference
- **Storage:** Cloudflare R2, signed direct upload. Never proxy media through the API.
- **Messaging:** WhatsApp Business API via BSP. Email secondary.
- **Payments:** Indian PA split-settlement (Cashfree Easy Split or Razorpay Route)
- **AI:** Claude — Haiku 4.5 extraction, Sonnet 5 parsing/copy, Opus 5 scoring rationale only

---

## Commands

```bash
pnpm dev                  # all apps
pnpm test:rls             # cross-tenant isolation — BLOCKING GATE
pnpm test:money           # settlement invariants — BLOCKING GATE
pnpm test:e2e             # Playwright
pnpm db:migrate           # apply migrations in order
pnpm db:types             # regenerate Supabase types
```

---

## Conventions

- Server Components by default. `'use client'` only where interaction requires it.
- Route handlers in `apps/web/app/api/<module>/**`. Business logic lives in `packages/*` and `modules/*`, never in a handler.
- Zod schema at every API boundary and for every AI structured output. Reject and retry malformed output; never persist it.
- Money is `bigint` paise. Never float. Never store rupees.
- All timestamps `timestamptz`, UTC.
- Errors: `{ error: { code, message, details? } }`, codes `SCREAMING_SNAKE`.
- Never log PII, tokens, or full phone numbers. Mask to last 4.

---

## Working style

- **One step at a time.** One instruction, wait for the result, then the next.
- Read the relevant `docs/*.md` before writing code for that area.
- If a rule above conflicts with the request, **say so and stop.** Do not silently work around it.
- Prefer deleting code to adding abstraction.

---

## Documentation map

| File                        | Read before                                         |
| --------------------------- | --------------------------------------------------- |
| `docs/00-PRD.md`            | **Start here — the complete requirements document** |
| `docs/01-PRODUCT.md`        | Any product decision                                |
| `docs/02-ARCHITECTURE.md`   | Any structural change                               |
| `docs/03-DATA-MODEL.md`     | Any migration                                       |
| `docs/04-PROFILES.md`       | Identity, roles, EPKs                               |
| `docs/05-GIGS.md`           | Booking, holds, quotes, riders                      |
| `docs/06-COLLABS.md`        | Finding people, rooms, split sheets                 |
| `docs/07-STUDIO.md`         | Music creation, audio pipeline                      |
| `docs/08-STAGE.md`          | Shows, leagues, auditions                           |
| `docs/09-PAYMENTS.md`       | Anything touching money                             |
| `docs/10-PROMOTION.md`      | Marketing automation, website, fan CRM              |
| `docs/11-CREDITS.md`        | Split sheets, works, the registry                   |
| `docs/12-API.md`            | Any route handler                                   |
| `docs/13-DESIGN-SYSTEM.md`  | Any UI                                              |
| `docs/14-BUILD-SEQUENCE.md` | Starting a milestone                                |
| `docs/15-TESTING.md`        | Tests or CI                                         |
| `docs/16-MASTER-PROMPT.md`  | Working outside the repo                            |
