-- 019 — Organiser dashboard: search artists, book as a signed-in organiser,
-- see your own requests and a calendar of your own confirmed events.
--
-- The gap this closes: briefs.org_id is always the ARTIST-side org (who
-- handles/owns the brief) — migration 012's create_public_brief resolves
-- it from the artist being booked, and an authenticated org logging its
-- own enquiry writes its own org_id there too. Neither path gives a
-- signed-in ORGANISER a way to see briefs they themselves submitted,
-- across however many different artists' orgs they've contacted. This
-- adds that second, independent link.

alter table briefs add column requesting_org_id uuid references orgs(id);

-- "Composite (org_id, created_at desc) on anything paginated"
-- (docs/03-DATA-MODEL.md) — same pattern, applied to the new column.
create index briefs_requesting_org_idx on briefs (requesting_org_id, created_at desc);

-- Two-sided read, same shape as migration 014's applications_read: an org
-- can see a brief because it OWNS it (org_id, the artist side) or because
-- it REQUESTED it (requesting_org_id, the organiser side). Write access is
-- untouched — org_id = current_org_id() only; an organiser never writes
-- briefs directly, always through create_authenticated_brief_for_artist
-- below, same "narrow SECURITY DEFINER exception" reasoning as
-- create_public_brief.
drop policy briefs_read on briefs;
create policy briefs_read on briefs for select using (
  org_id = current_org_id() or requesting_org_id = current_org_id()
);

-- An organiser needs to see the quote sent against their own brief (the
-- whole point of tracking a request) even though quotes.org_id is the
-- artist side.
drop policy quotes_read on quotes;
create policy quotes_read on quotes for select using (
  org_id = current_org_id()
  or exists (
    select 1 from briefs b where b.id = quotes.brief_id and b.requesting_org_id = current_org_id()
  )
);

-- Same for bookings — this is what the organiser's calendar reads from.
drop policy bookings_read on bookings;
create policy bookings_read on bookings for select using (
  org_id = current_org_id()
  or exists (
    select 1 from briefs b where b.id = bookings.brief_id and b.requesting_org_id = current_org_id()
  )
);

-- search_artists_public — browsing, not a single lookup by known slug/id
-- (migration 011's get_artist_public), so this is a genuinely different
-- shape of "narrow exception": bounded (limit capped at 50, default 24),
-- only ever returns the same public fields get_artist_public already
-- exposes one row at a time, ordered so verified/recently-active artists
-- surface first rather than an arbitrary table scan order. Every filter
-- is optional (null = no constraint on that field) — an organiser with no
-- strong preference yet should still see something.
create function search_artists_public(
  p_genre text default null,
  p_city text default null,
  p_role text default null,
  p_limit int default 24,
  p_offset int default 0
) returns table (
  id uuid, stage_name text, slug text, home_city text, genres text[],
  bio text, verified boolean
)
language sql security definer set search_path = public stable as $$
  select a.id, a.stage_name, a.slug, a.home_city, a.genres, a.bio, a.verified
  from artists a
  where (p_genre is null or p_genre = any(a.genres))
    and (p_city is null or a.home_city ilike p_city)
    and (
      p_role is null
      or exists (
        select 1 from artist_roles ar where ar.artist_id = a.id and ar.active and ar.role = p_role
      )
    )
  order by a.verified desc, a.created_at desc
  limit least(coalesce(p_limit, 24), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function search_artists_public(text, text, text, int, int) to anon, authenticated;

-- create_authenticated_brief_for_artist — the organiser-dashboard sibling
-- of migration 012's create_public_brief. Same core logic (resolve the
-- artist's org, upsert an organiser contact record under it, insert the
-- brief) plus the one thing an anonymous caller can't have: a real
-- requesting_org_id, and a real name/phone pulled from the caller's own
-- account (auth.users.phone, same lookup migration 014's
-- accept_application already uses) rather than accepted as free-text
-- params — an authenticated organiser doesn't need to retype who they are.
create function create_authenticated_brief_for_artist(
  p_artist_id uuid,
  p_event_date date,
  p_city text,
  p_event_type text,
  p_genres text[],
  p_budget_min_paise bigint,
  p_budget_max_paise bigint,
  p_crowd_size int,
  p_notes text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_artist_org_id uuid;
  v_requesting_org_id uuid;
  v_organiser_id uuid;
  v_organiser_name text;
  v_organiser_phone text;
  v_brief_id uuid;
begin
  v_requesting_org_id := current_org_id();
  if v_requesting_org_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select org_id into v_artist_org_id from artists where id = p_artist_id;
  if v_artist_org_id is null then
    raise exception 'NOT_FOUND: artist not found';
  end if;

  select name into v_organiser_name from orgs where id = v_requesting_org_id;
  select au.phone into v_organiser_phone
  from org_members om join auth.users au on au.id = om.user_id
  where om.org_id = v_requesting_org_id and au.phone is not null
  limit 1;

  select id into v_organiser_id from organisers
  where org_id = v_artist_org_id and phone = coalesce(v_organiser_phone, '')
  limit 1;

  if v_organiser_id is null then
    insert into organisers (org_id, name, phone, city)
    values (v_artist_org_id, coalesce(v_organiser_name, 'Organiser'), coalesce(v_organiser_phone, ''), p_city)
    returning id into v_organiser_id;
  end if;

  insert into briefs (
    org_id, organiser_id, requesting_org_id, requested_artist_id, event_date, city,
    event_type, genres, budget_min_paise, budget_max_paise, crowd_size, notes, source
  )
  values (
    v_artist_org_id, v_organiser_id, v_requesting_org_id, p_artist_id, p_event_date, p_city,
    p_event_type, coalesce(p_genres, '{}'), p_budget_min_paise, p_budget_max_paise, p_crowd_size,
    p_notes, 'web'
  )
  returning id into v_brief_id;

  return v_brief_id;
end $$;

-- Guarded internally with an explicit IS NULL check on current_org_id()
-- (not the migration 014-era `<>` comparison that broke on NULL) — but
-- revoking PUBLIC's default execute grant anyway, same belt-and-suspenders
-- reasoning as migration 015: no reason to leave the surface open just
-- because the in-function check happens to be correct this time.
revoke execute on function create_authenticated_brief_for_artist(
  uuid, date, text, text, text[], bigint, bigint, int, text
) from public, anon;
grant execute on function create_authenticated_brief_for_artist(
  uuid, date, text, text, text[], bigint, bigint, int, text
) to authenticated;
