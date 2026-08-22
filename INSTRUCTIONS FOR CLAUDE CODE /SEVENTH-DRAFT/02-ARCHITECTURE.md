# 02 — Architecture

## Modules and services

Two layers. **Modules are product surfaces. Packages are shared services.** A module never reimplements a service.

```
apps/web              Next.js 15 App Router — all user surfaces
apps/admin            internal review queues
apps/workers          Python FastAPI — audio, ML, transcode

modules/
  profiles/           roles, attributes, EPK
  gigs/               briefs, shortlists, quotes, holds, riders
  collabs/            requests, rooms, versioned stems
  studio/             generation, analysis, variants
  stage/              seasons, auditions, leagues, scoring
  payments/           contracts, settlements, splits, payouts
  promotion/          campaigns, funnels, fan lists
  credits/            works, contributors, split sheets

packages/             EXACTLY ONE OF EACH
  identity/           accounts, roles, org scoping
  discovery/          search + ranking — Gigs AND Collabs both call this
  money/              settlement, ledger, splits, PA-agnostic
  messaging/          WhatsApp + email
  media/              upload, watermark, gate, transcode
  calendar/           availability + holds — Gigs, Rehearsal, Crew
  trust/              reliability score, per role
  intent/             MUSIC_BRIEF schema (ported from MusicGenAI)
  studio-core/        nine-stage pipeline (ported from Third Eye)
  db/                 client, generated types, RLS suite
  ui/                 design system
```

**Rule:** business logic lives in `modules/*` and `packages/*`. Route handlers validate, resolve org from session, call a module, serialise. Never logic in a handler.

## Which service each module uses

|           | identity | discovery | money | messaging | media | calendar | trust | intent |
| --------- | :------: | :-------: | :---: | :-------: | :---: | :------: | :---: | :----: |
| Profiles  |    ●     |     ●     |       |     ●     |   ●   |          |   ●   |   ●    |
| Gigs      |    ●     |     ●     |   ●   |     ●     |       |    ●     |   ●   |   ●    |
| Collabs   |    ●     |     ●     |   ●   |     ●     |   ●   |          |   ●   |   ●    |
| Studio    |    ●     |           |       |           |   ●   |          |       |   ●    |
| Stage     |    ●     |     ●     |       |     ●     |   ●   |    ●     |       |   ●    |
| Payments  |    ●     |           |   ●   |     ●     |       |          |   ●   |        |
| Promotion |    ●     |     ●     |       |     ●     |   ●   |          |       |   ●    |
| Credits   |    ●     |           |   ●   |     ●     |   ●   |          |       |        |

**`discovery` is the one to protect.** Gigs matching an artist to a wedding brief and Collabs matching a vocalist to a beat are the same operation with different attribute weights. One engine, weights per use case. A second search implementation is a failed review.

## Request flow

```
Browser
  └─> route handler (apps/web/app/api/<module>/**)
        ├─ Zod validate
        ├─ resolve org from SESSION — never from a client parameter
        ├─ call modules/<module>
        │     └─ calls packages/* for shared work
        └─ Supabase with the USER's JWT — RLS enforces isolation
              service-role key only in workflows/ and admin/, never a user path
```

## Multi-tenancy

**RLS is the isolation boundary.** Application checks are defence in depth, never the primary control.

```sql
alter table <t> enable row level security;
create policy <t>_read  on <t> for select using (org_id = current_org_id());
create policy <t>_write on <t> for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
```

`current_org_id()` reads the active org from JWT claims, set at login and on org switch. A user in three orgs has three memberships and one active org per session.

**Why this and not middleware:** a route someone forgets to guard still returns nothing. Competing managers share this database and it holds payout data.

## AI layer

| Job                                       | Model                 | Volume                                     |
| ----------------------------------------- | --------------------- | ------------------------------------------ |
| Brief parsing — WhatsApp/PDF → structured | Sonnet 5              | High                                       |
| Quote drafting, grounded on the index     | Sonnet 5              | High                                       |
| EPK and campaign copy                     | Sonnet 5              | High                                       |
| Audition scoring rationale                | Opus 5                | Low — advisory only, a human confirms      |
| Index anomaly review                      | Opus 5                | Low                                        |
| Extraction, classification, tagging       | Haiku 4.5             | High                                       |
| Semantic matching                         | Embeddings → pgvector | High                                       |
| BPM / key / genre                         | Essentia or librosa   | Medium — **deterministic, not an LLM job** |

Guardrails: Zod-validate every structured output, reject and retry, never persist malformed output. Prompt caching on repetitive prompts. Batch API for audition scoring. Provenance on every generated asset.

## Two queues, never merged

| System      | Purpose                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inngest** | Lifecycle sequences — long-lived, stateful, human-in-the-loop, spanning months. `step.sleepUntil` for hold expiry, payout SLA, re-book at +11 months. |
| **BullMQ**  | Studio generation pipeline — short-lived, compute-bound, high-throughput.                                                                             |

## Decisions

**ADR-001 — Modules over a single generic object.** An earlier draft modelled everything as one polymorphic "request" object. Rejected: it optimised for schema elegance over product clarity, and made every module's real requirements — riders, split sheets, audition scoring, campaign scheduling — awkward special cases. Modules share _services_, not a forced common shape.

**ADR-002 — One discovery engine, weighted per use case.** Gigs and Collabs are the same matching operation. Two implementations would diverge within a quarter.

**ADR-003 — RLS over application authorisation.** Competing tenants, payout data, small team shipping fast.

**ADR-004 — PA split-settlement over own escrow.** RBI rules mean we cannot hold customer funds. Provider-agnostic because international expansion needs one PA per market.

**ADR-005 — Phone OTP only.** India is phone-first, and the audition funnel cannot ask 45,000 people to create a password.

**ADR-006 — Money as `bigint` paise.** Float arithmetic on money is a correctness bug waiting for scale.
