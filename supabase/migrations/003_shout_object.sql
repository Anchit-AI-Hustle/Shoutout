-- 003 — The Shout object
-- See docs/03-DATA-MODEL.md, docs/04-SHOUT-TYPES.md, docs/09-BUILD-SEQUENCE.md M1.
-- Requires migration 001 (current_org_id(), RLS defaults) and pgvector.

create extension if not exists vector;

create table shouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  type text not null,                       -- validated against packages/shout-types registry.
                                             -- No CHECK constraint here on purpose: adding a 13th
                                             -- type must cost a registry entry, never a migration.
  title text not null,
  body text,
  status text not null default 'draft'
    check (status in ('draft','open','partially_filled','filled','closed',
                      'cancelled','expired')),
  visibility text not null default 'open'
    check (visibility in ('open','invite','roster','verified')),
  city text, deadline timestamptz,
  intent jsonb,                             -- GENERATION_INTENT, see packages/intent
  intent_embedding vector(1536),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shout_slots (
  id uuid primary key default gen_random_uuid(),
  shout_id uuid not null references shouts(id) on delete cascade,
  org_id uuid not null references orgs(id),
  role text not null,                       -- from registry.slotRoles for this type
  attributes jsonb not null default '{}',   -- validated by registry.attributeSchema
  comp_model text not null
    check (comp_model in ('fee','points','hybrid','credit')),
  fee_paise bigint,
  writer_pct numeric(5,2), master_pct numeric(5,2),
  deadline timestamptz,
  status text not null default 'open'
    check (status in ('open','answered','shortlisted','accepted','contracted',
                      'delivered','settled','withdrawn','declined','expired')),
  filled_by uuid references artists(id),
  created_at timestamptz not null default now()
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references shout_slots(id) on delete cascade,
  org_id uuid not null references orgs(id),
  responder_org_id uuid not null references orgs(id),
  responder_artist_id uuid references artists(id),
  pitch text, media_url text,
  score numeric, score_components jsonb,
  status text not null default 'submitted'
    check (status in ('submitted','shortlisted','accepted','declined','withdrawn')),
  created_at timestamptz not null default now()
);

create index shouts_intent_idx on shouts using ivfflat (intent_embedding vector_cosine_ops);
create index shouts_open_idx on shouts (type, city, status) where status = 'open';
create index slots_open_idx on shout_slots (role, status) where status = 'open';

alter table shouts enable row level security;
create policy shouts_read on shouts for select using (org_id = current_org_id());
create policy shouts_write on shouts for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table shout_slots enable row level security;
create policy shout_slots_read on shout_slots for select using (org_id = current_org_id());
create policy shout_slots_write on shout_slots for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table answers enable row level security;
create policy answers_read on answers for select using (org_id = current_org_id());
create policy answers_write on answers for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- State machine, enforced by trigger — not application code (docs/09-BUILD-SEQUENCE.md M1).
-- A Shout can be partially_filled: slots fill independently, so shouts.status
-- transitions are driven by application logic recomputing fill state, but the
-- database still refuses any transition outside this table.

create function assert_valid_shout_transition() returns trigger
language plpgsql as $$
declare
  allowed boolean;
begin
  if new.status = old.status then
    return new;
  end if;
  allowed := (old.status, new.status) in (
    ('draft', 'open'),
    ('open', 'partially_filled'),
    ('open', 'filled'),
    ('open', 'cancelled'),
    ('open', 'expired'),
    ('partially_filled', 'filled'),
    ('partially_filled', 'cancelled'),
    ('partially_filled', 'expired'),
    ('filled', 'closed'),
    ('filled', 'cancelled')
  );
  if not allowed then
    raise exception 'INVALID_TRANSITION: shouts % -> %', old.status, new.status;
  end if;
  return new;
end $$;

create trigger shouts_transition_guard before update on shouts
  for each row execute function assert_valid_shout_transition();

create function assert_valid_slot_transition() returns trigger
language plpgsql as $$
declare
  allowed boolean;
begin
  if new.status = old.status then
    return new;
  end if;
  allowed := (old.status, new.status) in (
    ('open', 'answered'),
    ('open', 'withdrawn'),
    ('open', 'expired'),
    ('answered', 'shortlisted'),
    ('answered', 'declined'),
    ('answered', 'withdrawn'),
    ('shortlisted', 'accepted'),
    ('shortlisted', 'declined'),
    ('accepted', 'contracted'),
    ('contracted', 'delivered'),
    ('delivered', 'settled')
  );
  if not allowed then
    raise exception 'INVALID_TRANSITION: shout_slots % -> %', old.status, new.status;
  end if;
  return new;
end $$;

create trigger shout_slots_transition_guard before update on shout_slots
  for each row execute function assert_valid_slot_transition();
