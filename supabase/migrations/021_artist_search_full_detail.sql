-- Artist search returned four fields and dropped the one that matters.
--
-- docs/04-PROFILES.md is explicit: "One account holds many roles at once...
-- Matching happens **per role**, never per person." The search RPC returned
-- stage_name / city / genres / verified and no roles at all, so the
-- organiser-facing discovery surface — the only place someone looks for a
-- person to hire — could not express the product's central idea. The
-- p_role filter existed but nothing surfaced what it filtered on.
--
-- Return type changes, so this drops and recreates rather than
-- CREATE OR REPLACE.

drop function if exists search_artists_public(text, text, text, int, int);

create function search_artists_public(
  p_genre text default null,
  p_city text default null,
  p_role text default null,
  p_limit int default 24,
  p_offset int default 0
) returns table (
  id uuid,
  stage_name text,
  slug text,
  home_city text,
  genres text[],
  bio text,
  verified boolean,
  fee_band_visible boolean,
  roles text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.stage_name,
    a.slug,
    a.home_city,
    a.genres,
    a.bio,
    a.verified,
    a.fee_band_visible,
    -- Only active roles. An artist who has stopped taking mix work should
    -- not surface for a mix search just because the row still exists.
    coalesce(
      (
        select array_agg(ar.role order by ar.role)
        from artist_roles ar
        where ar.artist_id = a.id and ar.active
      ),
      '{}'::text[]
    ) as roles
  from artists a
  where (p_genre is null or p_genre = any(a.genres))
    and (p_city is null or a.home_city ilike p_city)
    and (
      p_role is null
      or exists (
        select 1 from artist_roles ar
        where ar.artist_id = a.id and ar.active and ar.role = p_role
      )
    )
  order by a.verified desc, a.created_at desc
  limit least(coalesce(p_limit, 24), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Deliberately anon-callable: browsing artists is public (docs/04-PROFILES.md
-- treats public artist pages as the SEO engine). Booking still requires a
-- session — see create_authenticated_brief_for_artist.
grant execute on function search_artists_public(text, text, text, int, int) to anon, authenticated;
