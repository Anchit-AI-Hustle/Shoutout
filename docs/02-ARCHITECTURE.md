# 02 — Architecture

## Monorepo

```
apps/web              Next.js 15 App Router. All user surfaces.
apps/admin            Internal HITL queues.
apps/workers          Python FastAPI, Dockerised. Audio, ML, transcode.

packages/shout-types  THE TYPE REGISTRY. All 12 types as config.
packages/intent       GENERATION_INTENT semantic engine (ported from MusicGenAI).
packages/studio-core  Nine-stage generation pipeline (ported from Third Eye).
packages/match        One scoring engine. Consumes registry config.
packages/money        Settlement abstraction. PA-agnostic. Double-entry ledger.
packages/db           Supabase client, generated types, RLS test suite.
packages/ui           Design system.

workflows/            Inngest functions.
supabase/migrations/  001 creates org_id + RLS.
```

**Rule:** business logic never lives in a route handler. Route handlers validate, call a package, and serialise.

## Request flow

```
Browser
  └─> Next.js route handler (apps/web/app/api/**)
        ├─ Zod validate the body
        ├─ Resolve org from SESSION (never from a client parameter)
        ├─ Call packages/*
        └─ Supabase with the USER's JWT — RLS enforces isolation
              └─ service-role key only in workflows/ and admin/, never in a user path
```

## Multi-tenancy

**RLS is the isolation boundary. Application checks are defence in depth, never the primary control.**

```sql
-- the pattern every table follows
create policy "org_read" on <table> for select
  using (org_id = current_org_id());

create policy "org_write" on <table> for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
```

`current_org_id()` reads the active org from JWT claims, set at login and on org switch. A user in three orgs has three memberships and one active org per session.

**Why this and not middleware:** a route someone forgets to guard still returns nothing. Competing managers share this database and it holds payout data.

## AI layer

| Job | Model | Volume | Note |
|---|---|---|---|
| Brief parsing (WhatsApp/PDF → structured) | Sonnet 5 | High | Highest-leverage AI job in the product |
| Quote drafting | Sonnet 5 | High | Grounded on index percentiles. Never invents a price. |
| EPK / release copy | Sonnet 5 | High | HITL review before publish |
| Audition scoring rationale | Opus 5 | Low | Advisory only. A human always confirms. |
| Index anomaly review | Opus 5 | Low | Flags suspicious fees before they enter the index |
| Extraction / classification | Haiku 4.5 | High | Cheapest model that clears the bar |
| Semantic match | Embeddings → pgvector | High | Hybrid with Postgres FTS. No search cluster. |
| BPM / key / genre | Essentia or librosa | Medium | **Deterministic, not an LLM job** |

**Guardrails**
- Every structured output is Zod-validated. Reject and retry; never persist malformed output.
- Prompt caching on everything repetitive. Batch API for audition scoring — it is not time-sensitive.
- Model output on scoring is advisory. A human confirms before anything is final.
- Provenance travels with every generated asset: model, intent object, timestamp, commissioning human.

## Two queues, never merged

| System | Purpose | Why |
|---|---|---|
| **Inngest** | Lifecycle sequences | Long-lived, stateful, human-in-the-loop, spanning months. `step.sleepUntil` for hold expiry, payout SLA, T+11-month re-book. Durable execution with replay. |
| **BullMQ** | Studio generation pipeline | Short-lived, compute-bound, retryable, high-throughput. |

## Decisions

**ADR-001 — Polymorphic Shout over per-type tables.** Twelve request kinds share a lifecycle, a matching model and a settlement path. Separate tables would triple the surface area and guarantee divergence. Cost: `slots.attributes` is `jsonb`, validated per type by the registry rather than by column constraints. Accepted.

**ADR-002 — RLS over application authorisation.** Competing tenants, payout data, and a small team shipping fast. Postgres is the only place a forgotten check still fails safe.

**ADR-003 — PA split-settlement over own escrow.** RBI payment-aggregator rules mean we cannot legally hold customer funds. Provider-agnostic interface because we will need one PA per market at international expansion.

**ADR-004 — Phone OTP only.** India is phone-first, and the audition funnel cannot ask 45,000 people to create a password. Removes an entire class of credential-stuffing risk.

**ADR-005 — Money as `bigint` paise.** Float arithmetic on money is a correctness bug waiting for scale.
