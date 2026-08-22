# shoutout-platform

All-in-one platform for the independent music industry in India.

**Eight modules on shared services.** Profiles · Gigs · Collabs · Studio · Stage · Payments · Promotion · Credits.

## Quickstart

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm db:types
pnpm test:rls          # MUST pass before writing features
pnpm dev
```

## Structure

```
apps/
  web/                Next.js 15 — all user surfaces
  admin/              internal review queues
  workers/            Python FastAPI — audio, ML, transcode

modules/              one folder per product module
  profiles/  gigs/  collabs/  studio/  stage/
  payments/  promotion/  credits/

packages/             shared services — exactly one of each
  identity/           accounts, roles, org scoping
  discovery/          search + ranking, used by Gigs and Collabs
  money/              settlement, ledger, splits, payouts
  messaging/          WhatsApp + email
  media/              upload, watermark, gate, transcode
  calendar/           availability and holds
  trust/              reliability scores
  intent/             MUSIC_BRIEF schema (ported from MusicGenAI)
  studio-core/        nine-stage generation pipeline (ported from Third Eye)
  db/                 Supabase client, types, RLS test suite
  ui/                 design system

workflows/            Inngest lifecycle functions
supabase/migrations/  001 creates org_id + RLS
docs/                 read before building
```

## Blocking CI gates

`pnpm test:rls` · `pnpm test:money` · `pnpm test:e2e --grep @critical`
