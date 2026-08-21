# Shoutout

One platform for the independent music economy. Every request is a **Shout** — a call that someone answers.

## Quickstart

```bash
pnpm install
cp .env.example .env.local        # fill in values
pnpm db:migrate                   # applies supabase/migrations in order
pnpm db:types                     # generate typed client
pnpm test:rls                     # MUST pass before you write features
pnpm dev
```

## Structure

```
apps/
  web/            Next.js 15 App Router — all user-facing surfaces
  admin/          internal HITL queues (audition review, disputes, index anomalies)
  workers/        Python FastAPI — audio analysis, ML inference, transcode hooks
packages/
  shout-types/    the type registry — all 12 types as configuration
  intent/         GENERATION_INTENT semantic engine (ported)
  studio-core/    nine-stage generation pipeline (ported)
  match/          one scoring engine, all Shout types
  money/          settlement abstraction, double-entry ledger, PA-agnostic
  db/             Supabase client, generated types, RLS test suite
  ui/             design system
workflows/        Inngest functions — every lifecycle sequence
supabase/
  migrations/     001 creates org_id + RLS. Non-negotiable.
docs/             read these before building
```

## Blocking CI gates

A deploy fails if any of these fail:

- `pnpm test:rls` — cross-tenant isolation
- `pnpm test:money` — settlement invariants
- `pnpm test:e2e -- --grep @critical` — the flow that must never break

See `docs/10-TESTING.md`.
