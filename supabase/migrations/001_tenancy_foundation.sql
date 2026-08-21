-- 001 — Tenancy foundation
-- Before any domain table. No exceptions.
-- See docs/03-DATA-MODEL.md and docs/02-ARCHITECTURE.md (ADR-002).

create extension if not exists pgcrypto;

create table orgs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('manager','agency','self','organiser','venue','brand')),
  name text not null,
  gst text, pan text,
  kyc_status text not null default 'pending'
    check (kyc_status in ('pending','submitted','verified','rejected')),
  plan_tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- active org comes from the JWT, set at login and on org switch
create function current_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'org_id','')::uuid
$$;

alter table orgs enable row level security;
alter table org_members enable row level security;

create policy org_self on orgs for select
  using (id = current_org_id());
create policy member_self on org_members for select
  using (user_id = auth.uid());
