-- 028 — Programmatic landing pages: /book/<role>-in-<city>.
--
-- docs/10-PROMOTION.md names this as the acquisition engine, and it is the
-- only distribution channel that can be built rather than negotiated —
-- which matters when go-to-market access is honestly a 1/10.
--
-- Only combinations with actual supply are returned. Generating a page for
-- the full role x city product would create thousands of empty pages, which
-- search engines treat as thin content and penalise sitewide. A page earns
-- its existence by having at least one artist behind it.

create or replace function list_book_combinations()
returns table (role text, city text, artist_count bigint)
language sql security definer set search_path = public stable as $$
  select ar.role, a.home_city, count(distinct a.id)
  from artist_roles ar join artists a on a.id = ar.artist_id
  where ar.active and a.home_city is not null and a.home_city <> ''
  group by ar.role, a.home_city
  having count(distinct a.id) >= 1
  order by count(distinct a.id) desc, ar.role, a.home_city;
$$;
revoke execute on function list_book_combinations() from public;
grant execute on function list_book_combinations() to anon, authenticated;

create or replace function list_supply_cities()
returns table (city text, artist_count bigint)
language sql security definer set search_path = public stable as $$
  select a.home_city, count(*) from artists a
  where a.home_city is not null and a.home_city <> ''
  group by a.home_city order by count(*) desc;
$$;
revoke execute on function list_supply_cities() from public;
grant execute on function list_supply_cities() to anon, authenticated;
