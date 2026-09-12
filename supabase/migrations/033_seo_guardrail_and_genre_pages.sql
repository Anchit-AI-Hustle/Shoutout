-- 033 - Enforce the programmatic SEO guardrail, and add genre pages.
--
-- 00-PRD.md, Programmatic SEO: "never publish a cell with fewer than 3 live
-- artists, or a fee band below n=5. A thin page ranks for nothing and
-- dilutes the whole domain."
--
-- list_book_combinations() shipped with `having count(distinct a.id) >= 1`,
-- publishing single-artist pages. A direct violation of an explicit rule:
-- at 32 artists it generated 85 pages, nearly all thin, and thin pages do
-- not merely fail to rank, they drag the domain down with them. Raised to 3,
-- which cut 85 pages to 8 real ones.
--
-- The PRD specifies /book/[genre]-in-[city]; only role x city existed. Both
-- are real search intents ("a wedding singer in Jaipur" is a role, "a sufi
-- band in Delhi" is a genre), so both are generated and the route resolves
-- the token against roles first, then genres.
--
-- get_book_fee_band() enforces 00-PRD.md 5.1: "never expose raw rows;
-- percentile bands only; minimum sample_n 5 so individual deals cannot be
-- reverse-engineered." Below the threshold it returns nothing, which is the
-- same discipline rule 8 applies to quotes, enforced here so no caller can
-- forget it.
--
-- Also adds search_artists_by_genre_city() to back the genre pages.
-- Return type of list_book_combinations changes, so it is dropped first.

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

-- [applied as: seo_guardrail_and_genre_pages]
-- 033 - Enforce the programmatic SEO guardrail, and add genre pages.
--
-- 00-PRD.md, Programmatic SEO: "never publish a cell with fewer than 3 live
-- artists, or a fee band below n=5. A thin page ranks for nothing and
-- dilutes the whole domain."
--
-- list_book_combinations() shipped with `having count(distinct a.id) >= 1`,
-- which publishes single-artist pages. That is a direct violation of an
-- explicit rule: at 32 artists it generated 85 pages, most of them thin,
-- and thin pages do not merely fail to rank - they drag the domain down
-- with them. Raised to 3.
--
-- The PRD also specifies /book/[genre]-in-[city]; only role x city was
-- built. Both are real search intents ("book a wedding singer in Jaipur" is
-- a role, "book a sufi band in Delhi" is a genre), so both are generated,
-- and the route resolves the token against roles first, then genres.

create or replace function list_book_combinations()
returns table (kind text, slug_token text, label text, city text, artist_count bigint)
language sql security definer set search_path = public stable as $$
  -- Roles with enough supply to be worth a page.
  select 'role', ar.role, ar.role, a.home_city, count(distinct a.id)
  from artist_roles ar
  join artists a on a.id = ar.artist_id
  where ar.active and a.listed and a.home_city is not null and a.home_city <> ''
  group by ar.role, a.home_city
  having count(distinct a.id) >= 3

  union all

  -- Genres, per the PRD's /book/[genre]-in-[city].
  select 'genre', g.genre, g.genre, a.home_city, count(distinct a.id)
  from artists a
  cross join lateral unnest(a.genres) as g(genre)
  where a.listed and a.home_city is not null and a.home_city <> ''
  group by g.genre, a.home_city
  having count(distinct a.id) >= 3

  order by 5 desc, 2, 4;
$$;
revoke execute on function list_book_combinations() from public;
grant execute on function list_book_combinations() to anon, authenticated;

-- The fee band a /book page is allowed to show.
--
-- 00-PRD.md 5.1: "never expose raw rows; percentile bands only; minimum
-- sample_n 5 so individual deals cannot be reverse-engineered". Returning
-- nothing below the threshold is the same discipline rule 8 applies to
-- quotes, and it is enforced here rather than in the page so no caller can
-- forget it.
create or replace function get_book_fee_band(p_city text, p_genre text default null)
returns table (p25 bigint, p50 bigint, p75 bigint, sample_n bigint)
language sql security definer set search_path = public stable as $$
  select round(b.p25)::bigint, round(b.p50)::bigint, round(b.p75)::bigint, b.sample_n
  from benchmark_index b
  where b.city ilike p_city
    and (p_genre is null or b.genre = p_genre)
    and b.sample_n >= 5
  order by b.sample_n desc
  limit 1;
$$;
revoke execute on function get_book_fee_band(text, text) from public;
grant execute on function get_book_fee_band(text, text) to anon, authenticated;

-- [applied as: seo_guardrail_and_genre_pages]
-- 033 - Enforce the programmatic SEO guardrail, and add genre pages.
--
-- 00-PRD.md, Programmatic SEO: "never publish a cell with fewer than 3 live
-- artists, or a fee band below n=5. A thin page ranks for nothing and
-- dilutes the whole domain."
--
-- list_book_combinations() shipped with `having count(distinct a.id) >= 1`,
-- publishing single-artist pages. A direct violation of an explicit rule:
-- at 32 artists it generated 85 pages, most of them thin, and thin pages do
-- not merely fail to rank, they drag the domain down with them. Raised to 3.
--
-- The PRD also specifies /book/[genre]-in-[city]; only role x city existed.
-- Both are real search intents, so both are generated and the route
-- resolves the token against roles first, then genres.
--
-- Return type changes, so drop and recreate.

drop function if exists list_book_combinations();

create function list_book_combinations()
returns table (kind text, slug_token text, city text, artist_count bigint)
language sql security definer set search_path = public stable as $$
  select 'role'::text, ar.role, a.home_city, count(distinct a.id)
  from artist_roles ar
  join artists a on a.id = ar.artist_id
  where ar.active and a.listed and a.home_city is not null and a.home_city <> ''
  group by ar.role, a.home_city
  having count(distinct a.id) >= 3

  union all

  select 'genre'::text, g.genre, a.home_city, count(distinct a.id)
  from artists a
  cross join lateral unnest(a.genres) as g(genre)
  where a.listed and a.home_city is not null and a.home_city <> ''
  group by g.genre, a.home_city
  having count(distinct a.id) >= 3;
$$;
revoke execute on function list_book_combinations() from public;
grant execute on function list_book_combinations() to anon, authenticated;

-- The fee band a /book page may show.
--
-- 00-PRD.md 5.1: "never expose raw rows; percentile bands only; minimum
-- sample_n 5 so individual deals cannot be reverse-engineered." Returning
-- nothing below the threshold is the discipline rule 8 applies to quotes,
-- enforced here rather than in the page so no caller can forget it.
create or replace function get_book_fee_band(p_city text, p_genre text default null)
returns table (p25 bigint, p50 bigint, p75 bigint, sample_n bigint)
language sql security definer set search_path = public stable as $$
  select round(b.p25)::bigint, round(b.p50)::bigint, round(b.p75)::bigint, b.sample_n
  from benchmark_index b
  where b.city ilike p_city
    and (p_genre is null or b.genre = p_genre)
    and b.sample_n >= 5
  order by b.sample_n desc
  limit 1;
$$;
revoke execute on function get_book_fee_band(text, text) from public;
grant execute on function get_book_fee_band(text, text) to anon, authenticated;

-- Genre search, to back the genre pages.
create or replace function search_artists_by_genre_city(
  p_genre text, p_city text, p_limit int default 24
) returns table (
  id uuid, stage_name text, slug text, home_city text, genres text[],
  bio text, verified boolean, image_url text, roles text[]
)
language sql security definer set search_path = public stable as $$
  select a.id, a.stage_name, a.slug, a.home_city, a.genres, a.bio, a.verified,
         (select m.url from artist_media m where m.artist_id = a.id and m.kind = 'image'
          order by m.is_primary desc, m.sort_order limit 1),
         coalesce((select array_agg(ar.role order by ar.role) from artist_roles ar
                   where ar.artist_id = a.id and ar.active), '{}'::text[])
  from artists a
  where a.listed and p_genre = any(a.genres) and a.home_city ilike p_city
  order by a.verified desc, a.created_at desc
  limit least(coalesce(p_limit, 24), 50);
$$;
revoke execute on function search_artists_by_genre_city(text, text, int) from public;
grant execute on function search_artists_by_genre_city(text, text, int) to anon, authenticated;
