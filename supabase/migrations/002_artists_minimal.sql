-- 002 — Artists (minimal)
--
-- docs/03-DATA-MODEL.md names this migration ("artists, roster, profiles") but,
-- unlike 001/003/004/005/010, never gives its SQL. roster and profiles need a
-- real design pass (how self-managed vs. agency-managed artists differ, what
-- an EPK/profile actually holds, how reliability_scores-per-role attaches) —
-- inventing that here would be guessing at product decisions, not implementing
-- a spec.
--
-- This migration creates only the minimal `artists` table needed to satisfy
-- the foreign keys that migrations 003, 004 and 005 already declare
-- (shout_slots.filled_by, answers.responder_artist_id, contributors.shoutout_id,
-- holds.artist_id). `roster` and `profiles` are NOT created here and must be
-- designed properly before M6 (Manager OS).

create table artists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  user_id uuid references auth.users(id),
  name text not null,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table artists enable row level security;
create policy artists_read on artists for select using (org_id = current_org_id());
create policy artists_write on artists for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
