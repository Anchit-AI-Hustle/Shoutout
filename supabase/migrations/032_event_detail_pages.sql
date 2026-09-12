-- 032 — A page per event.
--
-- Events existed only as cards inside an organiser's profile: nothing to
-- link to, nothing to index, and no surface connecting an artist to the
-- events they played. That last one matters most — an event page is the
-- natural join between the two sides of the marketplace, and unlike the
-- /book combinations it carries real content (venue, date, attendance,
-- line-up) rather than being a generated permutation.
--
-- Slugs rather than UUIDs, because a URL is read by people and by search
-- engines. Uniqueness is global, since the URL space is. The backfill runs
-- before the NOT NULL and the unique index so existing rows survive, and a
-- follow-up collapses "…-2024-2024" where a title already ended in its year.
--
-- get_event_lineup_public() resolves headliner names to listed profiles as
-- a best-effort LEFT JOIN. Name matching is imperfect, so an unmatched
-- headliner renders as plain text — the page never invents a profile link
-- it cannot stand behind.
--
-- get_organiser_events_public() was dropped and recreated to return slug,
-- since the organiser page now links each card through.
--
-- Functions: get_event_public, get_event_lineup_public,
-- get_related_events_public, list_event_slugs.

-- ---------------------------------------------------------------------------
-- Recovered 2026-09-13.
--
-- This file held only the header comment above and no SQL at all. The schema
-- it describes was applied straight to the live database and never written
-- down here, so `supabase/migrations` could not rebuild it - nine migrations
-- (029 to 036) were in that state, including the paywall and the whole credit
-- graph. The statements below are the exact SQL that was applied, recovered
-- verbatim from the session transcripts, in application order.
-- ---------------------------------------------------------------------------

-- [applied as: event_slugs_and_public_pages]
-- 032 — A page per event.
--
-- Events existed only as cards inside an organiser's profile, so there was
-- nothing to link to, nothing to index, and no surface connecting an
-- artist to the events they actually played. That last one matters most:
-- an event page is the natural join between the two sides of the
-- marketplace, and every one is an indexable page carrying real content
-- (venue, date, attendance, line-up) rather than a generated permutation.
--
-- Slugs rather than UUIDs, because a URL is read by people and by search
-- engines. Uniqueness is global, not per-org, since the URL space is.

alter table organiser_events add column if not exists slug text;

-- Backfill: title + year, deduped with a counter. Done before the NOT NULL
-- and the unique index so existing rows survive.
with numbered as (
  select id,
         regexp_replace(
           lower(trim(title || ' ' || coalesce(extract(year from held_on)::text, ''))),
           '[^a-z0-9]+', '-', 'g') as base,
         row_number() over (
           partition by regexp_replace(
             lower(trim(title || ' ' || coalesce(extract(year from held_on)::text, ''))),
             '[^a-z0-9]+', '-', 'g')
           order by created_at) as n
  from organiser_events
)
update organiser_events e
set slug = trim(both '-' from numbered.base) || case when numbered.n > 1 then '-' || numbered.n else '' end
from numbered
where numbered.id = e.id and e.slug is null;

alter table organiser_events alter column slug set not null;
create unique index organiser_events_slug_idx on organiser_events (slug);

-- One event, with the organiser who ran it.
create or replace function get_event_public(p_slug text)
returns table (
  id uuid, slug text, title text, venue text, city text, held_on date,
  attendance int, image_url text, headliners text[],
  organiser_slug text, organiser_name text, organiser_city text,
  organiser_logo_url text, organiser_verified boolean
)
language sql security definer set search_path = public stable as $$
  select e.id, e.slug, e.title, e.venue, e.city, e.held_on, e.attendance,
         e.image_url, e.headliners,
         o.slug, o.display_name, o.home_city, o.logo_url, o.verified
  from organiser_events e
  join organiser_profiles o on o.id = e.organiser_profile_id
  where e.slug = p_slug
  limit 1;
$$;
revoke execute on function get_event_public(text) from public;
grant execute on function get_event_public(text) to anon, authenticated;

-- Resolve the line-up to real profiles where a headliner name matches a
-- listed artist. Matching on name is imperfect, so it is done here as a
-- best-effort *link*, never as a claim of participation — the page shows
-- unmatched names as plain text rather than inventing a profile for them.
create or replace function get_event_lineup_public(p_slug text)
returns table (headliner text, artist_slug text, artist_id uuid, image_url text, verified boolean)
language sql security definer set search_path = public stable as $$
  select h.name,
         a.slug, a.id,
         (select m.url from artist_media m
          where m.artist_id = a.id and m.kind = 'image'
          order by m.is_primary desc, m.sort_order limit 1),
         a.verified
  from organiser_events e
  cross join lateral unnest(e.headliners) as h(name)
  left join artists a
    on lower(a.stage_name) = lower(h.name) and a.listed
  where e.slug = p_slug;
$$;
revoke execute on function get_event_lineup_public(text) from public;
grant execute on function get_event_lineup_public(text) to anon, authenticated;

-- Other events by the same organiser, for onward navigation.
create or replace function get_related_events_public(p_slug text, p_limit int default 6)
returns table (slug text, title text, venue text, city text, held_on date, image_url text)
language sql security definer set search_path = public stable as $$
  select e2.slug, e2.title, e2.venue, e2.city, e2.held_on, e2.image_url
  from organiser_events e1
  join organiser_events e2 on e2.organiser_profile_id = e1.organiser_profile_id and e2.id <> e1.id
  where e1.slug = p_slug
  order by e2.held_on desc nulls last
  limit least(coalesce(p_limit, 6), 20);
$$;
revoke execute on function get_related_events_public(text, int) from public;
grant execute on function get_related_events_public(text, int) to anon, authenticated;

-- For the sitemap.
create or replace function list_event_slugs()
returns table (slug text, held_on date)
language sql security definer set search_path = public stable as $$
  select slug, held_on from organiser_events order by held_on desc nulls last limit 1000;
$$;
revoke execute on function list_event_slugs() from public;
grant execute on function list_event_slugs() to anon, authenticated;

-- [applied as: organiser_events_include_slug]
-- The organiser page now links each event card to /e/<slug>, so the read
-- has to return the slug. Return type changes, hence drop-and-recreate.
drop function if exists get_organiser_events_public(uuid);

create function get_organiser_events_public(p_organiser_id uuid)
returns table (
  slug text, title text, venue text, city text, held_on date,
  attendance int, image_url text, headliners text[]
)
language sql security definer set search_path = public stable as $$
  select e.slug, e.title, e.venue, e.city, e.held_on, e.attendance, e.image_url, e.headliners
  from organiser_events e
  where e.organiser_profile_id = p_organiser_id
  order by e.held_on desc nulls last
  limit 50;
$$;
revoke execute on function get_organiser_events_public(uuid) from public;
grant execute on function get_organiser_events_public(uuid) to anon, authenticated;
