-- 011 — Profiles
-- docs/04-PROFILES.md, docs/03-DATA-MODEL.md section 002, docs/14-BUILD-SEQUENCE.md M3.
-- "One account holds many roles at once... matching happens per role, never
-- per person." artists is empty (verified before writing this) — safe to
-- restructure freely, no data migration needed.

alter table artists drop column name;
alter table artists drop column city;
alter table artists drop column user_id;

alter table artists add column stage_name text not null;
alter table artists add column slug text unique not null;
alter table artists add column home_city text;
alter table artists add column genres text[] not null default '{}';
alter table artists add column bio text;
alter table artists add column verified boolean not null default false;
alter table artists add column fee_band_visible boolean not null default false;

-- One person, many roles. THIS is what makes it one platform, not eight —
-- docs/04-PROFILES.md's own framing.
create table artist_roles (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  org_id uuid not null references orgs(id),
  role text not null,
  attributes jsonb not null default '{}',
  proof_media_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, role)
);

create table roster (
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  commission_pct numeric(5,2) not null default 0,
  exclusive boolean not null default false,
  start_date date, end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, artist_id)
);

alter table artist_roles enable row level security;
create policy artist_roles_read on artist_roles for select using (org_id = current_org_id());
create policy artist_roles_write on artist_roles for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table roster enable row level security;
create policy roster_read on roster for select using (org_id = current_org_id());
create policy roster_write on roster for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Public profile read (docs/12-API.md: "GET /api/profiles/:slug public",
-- docs/04-PROFILES.md: "/a/[slug] artist profile, ISR — the SEO engine").
-- Same reasoning as migration 007's get_work_public: a narrow, id/slug-keyed
-- SECURITY DEFINER function, not a blanket public RLS policy that would let
-- the anon key list every artist in the database. Only verified,
-- fee-band-visible-respecting fields are exposed; fee_band_visible itself
-- gates whether a future fee display shows anything.
create function get_artist_public(p_slug text)
returns table (
  id uuid, stage_name text, slug text, home_city text, genres text[], bio text,
  verified boolean, fee_band_visible boolean, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select id, stage_name, slug, home_city, genres, bio, verified, fee_band_visible, created_at
  from artists where slug = p_slug;
$$;

create function get_artist_roles_public(p_artist_id uuid)
returns table (role text, attributes jsonb)
language sql security definer set search_path = public stable as $$
  select role, attributes from artist_roles where artist_id = p_artist_id and active = true;
$$;

grant execute on function get_artist_public(text) to anon, authenticated;
grant execute on function get_artist_roles_public(uuid) to anon, authenticated;
