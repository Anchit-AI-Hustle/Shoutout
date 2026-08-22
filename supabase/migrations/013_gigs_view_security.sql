-- 013 — Fix settled_bookings_view running as SECURITY DEFINER
-- Caught by Supabase's security advisor immediately after 012 applied,
-- not by design. A plain `create view` in Postgres executes with the
-- view OWNER's privileges unless `security_invoker = true` is set (PG15+)
-- — the owner here is the migration role, which is not subject to the
-- org-scoped RLS on `bookings`/`briefs`. Left as the default, any
-- authenticated caller could `select * from settled_bookings_view` and see
-- every org's raw per-booking fee, not just their own — the exact leak
-- RLS exists to prevent (docs/02-ARCHITECTURE.md ADR-003).
--
-- Two layers, not one: security_invoker makes the view respect RLS if it's
-- ever queried directly, AND access is revoked outright — this view is an
-- implementation detail of refreshing `benchmark_index`, not a product
-- surface. Only `benchmark_index` (aggregated, sample_n >= 5, no org_id)
-- is meant to be queried, and only by authenticated managers — public/anon
-- access is revoked there too, since GET /api/gigs/index (docs/12-API.md)
-- is an authenticated Gigs endpoint, not a public one.

-- benchmark_index (the materialized view) depends on this view, so a plain
-- DROP fails; CASCADE takes it down too — rebuilt below in the same
-- migration, so there's no window where the index doesn't exist.
drop view settled_bookings_view cascade;

create view settled_bookings_view
with (security_invoker = true)
as
select
  b.id as booking_id,
  unnest(coalesce(br.genres, '{}')) as genre,
  b.fee_paise,
  br.city,
  br.event_type,
  case
    when br.crowd_size is null then 'unknown'
    when br.crowd_size < 100 then 'under_100'
    when br.crowd_size < 500 then '100_to_500'
    when br.crowd_size < 2000 then '500_to_2000'
    else 'over_2000'
  end as crowd_band,
  'Q' || extract(quarter from b.event_date)::text as season
from bookings b
join briefs br on br.id = b.brief_id
where b.status = 'settled';

create materialized view benchmark_index as
select genre, city, event_type, crowd_band, season,
       percentile_cont(0.25) within group (order by fee_paise) as p25,
       percentile_cont(0.50) within group (order by fee_paise) as p50,
       percentile_cont(0.75) within group (order by fee_paise) as p75,
       count(*) as sample_n
from settled_bookings_view
group by 1,2,3,4,5
having count(*) >= 5;

create unique index benchmark_index_key
  on benchmark_index (genre, city, event_type, crowd_band, season);

revoke select on settled_bookings_view from anon, authenticated;
revoke select on benchmark_index from anon;
