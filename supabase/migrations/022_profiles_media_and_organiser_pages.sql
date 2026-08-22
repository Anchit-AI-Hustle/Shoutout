-- 022 — Real profile depth for both sides of the marketplace.
--
-- Until now an artist was a name, a city, some genres and a bio, and an
-- organiser had no public presence at all (public.organisers is a private
-- per-org contact row — it carries a phone number and is scoped by RLS to
-- the artist-side org that created it, so it can never be a public page).
--
-- docs/04-PROFILES.md asks for proof media per role, an EPK built from
-- "best three tracks, photos, verified credits" and "past venues from
-- settled bookings". None of that had anywhere to live. This adds it, for
-- artists AND organisers, so a visitor can judge someone before booking.
--
-- Past performances are a separate table rather than a view over bookings
-- on purpose: bookings are RLS-scoped private commercial records, and an
-- artist's public gig history should be theirs to curate (and can predate
-- ever using this product). Same reasoning for organiser event portfolios.

-- ---------------------------------------------------------------- artists

create table artist_media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  kind text not null check (kind in ('image', 'audio', 'video')),
  url text not null,
  title text,
  -- The one image used as the profile photo / the one track played first.
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index artist_media_artist_idx on artist_media (artist_id, kind, sort_order);

create table albums (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  release_year int,
  cover_url text,
  track_count int,
  label text,
  created_at timestamptz not null default now()
);
create index albums_artist_idx on albums (artist_id, release_year desc);

create table artist_performances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  event_name text not null,
  venue text,
  city text,
  performed_on date,
  crowd_size int,
  image_url text,
  created_at timestamptz not null default now()
);
create index artist_performances_artist_idx on artist_performances (artist_id, performed_on desc);

-- ------------------------------------------------------------- organisers

create table organiser_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  home_city text,
  bio text,
  logo_url text,
  founded_year int,
  event_types text[] not null default '{}',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organiser_profiles_city_idx on organiser_profiles (home_city);

create table organiser_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  organiser_profile_id uuid not null references organiser_profiles(id) on delete cascade,
  title text not null,
  venue text,
  city text,
  held_on date,
  attendance int,
  image_url text,
  headliners text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index organiser_events_profile_idx on organiser_events (organiser_profile_id, held_on desc);

-- ------------------------------------------------------------------- RLS
-- CLAUDE.md rule 2: every table carries org_id NOT NULL and has policies.
-- Writes are owner-only. Public reading goes through the SECURITY DEFINER
-- functions below, never a blanket anon SELECT policy.

alter table artist_media enable row level security;
alter table albums enable row level security;
alter table artist_performances enable row level security;
alter table organiser_profiles enable row level security;
alter table organiser_events enable row level security;

create policy artist_media_own on artist_media
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy albums_own on albums
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy artist_performances_own on artist_performances
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy organiser_profiles_own on organiser_profiles
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy organiser_events_own on organiser_events
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- --------------------------------------------------- public read functions
-- Narrow, parameter-keyed reads (the pattern established by
-- get_artist_public / search_artists_public) rather than opening the tables
-- to anon. Each REVOKEs from PUBLIC first: Postgres grants EXECUTE to the
-- PUBLIC pseudo-role by default, so an explicit GRANT is not enough to
-- describe who can actually call these.

create function get_artist_media_public(p_artist_id uuid)
returns table (kind text, url text, title text, is_primary boolean)
language sql security definer set search_path = public stable as $$
  select m.kind, m.url, m.title, m.is_primary
  from artist_media m
  where m.artist_id = p_artist_id
  order by m.is_primary desc, m.sort_order, m.created_at
  limit 50;
$$;

create function get_artist_albums_public(p_artist_id uuid)
returns table (title text, release_year int, cover_url text, track_count int, label text)
language sql security definer set search_path = public stable as $$
  select a.title, a.release_year, a.cover_url, a.track_count, a.label
  from albums a
  where a.artist_id = p_artist_id
  order by a.release_year desc nulls last
  limit 50;
$$;

create function get_artist_performances_public(p_artist_id uuid)
returns table (event_name text, venue text, city text, performed_on date, crowd_size int, image_url text)
language sql security definer set search_path = public stable as $$
  select p.event_name, p.venue, p.city, p.performed_on, p.crowd_size, p.image_url
  from artist_performances p
  where p.artist_id = p_artist_id
  order by p.performed_on desc nulls last
  limit 50;
$$;

create function search_organisers_public(
  p_city text default null,
  p_event_type text default null,
  p_limit int default 24,
  p_offset int default 0
) returns table (
  id uuid, slug text, display_name text, home_city text, bio text,
  logo_url text, founded_year int, event_types text[], verified boolean,
  event_count bigint
)
language sql security definer set search_path = public stable as $$
  select o.id, o.slug, o.display_name, o.home_city, o.bio, o.logo_url,
         o.founded_year, o.event_types, o.verified,
         (select count(*) from organiser_events e where e.organiser_profile_id = o.id) as event_count
  from organiser_profiles o
  where (p_city is null or o.home_city ilike p_city)
    and (p_event_type is null or p_event_type = any(o.event_types))
  order by o.verified desc, o.created_at desc
  limit least(coalesce(p_limit, 24), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create function get_organiser_public(p_slug text)
returns table (
  id uuid, slug text, display_name text, home_city text, bio text,
  logo_url text, founded_year int, event_types text[], verified boolean
)
language sql security definer set search_path = public stable as $$
  select o.id, o.slug, o.display_name, o.home_city, o.bio, o.logo_url,
         o.founded_year, o.event_types, o.verified
  from organiser_profiles o
  where o.slug = p_slug
  limit 1;
$$;

create function get_organiser_events_public(p_organiser_id uuid)
returns table (title text, venue text, city text, held_on date, attendance int, image_url text, headliners text[])
language sql security definer set search_path = public stable as $$
  select e.title, e.venue, e.city, e.held_on, e.attendance, e.image_url, e.headliners
  from organiser_events e
  where e.organiser_profile_id = p_organiser_id
  order by e.held_on desc nulls last
  limit 50;
$$;

revoke execute on function get_artist_media_public(uuid) from public;
revoke execute on function get_artist_albums_public(uuid) from public;
revoke execute on function get_artist_performances_public(uuid) from public;
revoke execute on function search_organisers_public(text, text, int, int) from public;
revoke execute on function get_organiser_public(text) from public;
revoke execute on function get_organiser_events_public(uuid) from public;

grant execute on function get_artist_media_public(uuid) to anon, authenticated;
grant execute on function get_artist_albums_public(uuid) to anon, authenticated;
grant execute on function get_artist_performances_public(uuid) to anon, authenticated;
grant execute on function search_organisers_public(text, text, int, int) to anon, authenticated;
grant execute on function get_organiser_public(text) to anon, authenticated;
grant execute on function get_organiser_events_public(uuid) to anon, authenticated;
