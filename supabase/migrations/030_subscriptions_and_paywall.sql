-- 030 — Tiered subscriptions with real enforcement.
--
-- Supersedes the earlier "label as Pro but leave it free" arrangement. The
-- two core actions now require a paid plan: listing yourself as an artist,
-- and searching/booking artists as an organiser.
--
-- What stays free is deliberate, not generosity: public artist and organiser
-- pages, and the /book landing pages. Those are the SEO engine
-- (docs/04-PROFILES.md) and gating them would wall off the only distribution
-- channel the product has. You can always *see* the market; you pay to *act*
-- in it.
--
-- Entitlements are keyed strings rather than booleans per tier, so adding a
-- capability is a row, not a migration and a deploy — the same
-- configuration-over-branching rule CLAUDE.md applies to Shout types.
--
-- Enforcement lives in the database for the same reason the settlement
-- balance does: a check that lives in one of forty-five route files is a
-- check that will eventually be forgotten in the forty-sixth.
--
-- Tables: plans (basic/plus/pro/max, seeded), plan_entitlements,
-- subscriptions (one per org, so an upgrade mutates rather than stacks).
-- Functions: has_entitlement(), my_entitlements(),
-- booking_requests_this_month().
-- Gates: create_authenticated_brief_for_artist() requires
-- 'send_booking_requests' and respects the monthly cap;
-- artists.listed is guarded by assert_can_list_artist().
--
-- Ordering note: the `listed` backfill must run BEFORE the trigger is
-- created. Creating it first makes the backfill trip the very gate it is
-- meant to exempt — which is exactly what happened on the first attempt.
--
-- 'past_due' deliberately does not grant access: a lapsed card should stop
-- entitlement, and enqueue_invoice_reminders() chases it separately.

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

-- [applied as: subscription_plans_and_entitlements]
-- 030 — Tiered subscriptions with real enforcement.
--
-- Supersedes the earlier "label as Pro but leave it free" arrangement. The
-- two core actions now require a paid plan: listing yourself as an artist,
-- and searching/booking artists as an organiser.
--
-- What stays free is deliberate, not generosity: public artist and
-- organiser pages, and the /book landing pages. Those are the SEO engine
-- (docs/04-PROFILES.md) and gating them would wall off the only
-- distribution channel the product has. You can always *see* the market;
-- you pay to *act* in it.
--
-- Entitlements are keyed strings rather than booleans per tier, so adding a
-- capability is a row, not a migration and a deploy — the same
-- configuration-over-branching rule CLAUDE.md applies to Shout types.

create table plans (
  tier text primary key,
  name text not null,
  price_paise bigint not null check (price_paise >= 0),
  -- Annual is offered at ten months' price; a column rather than a computed
  -- discount so it can be tuned without a code change.
  annual_price_paise bigint not null check (annual_price_paise >= 0),
  blurb text not null,
  sort_order int not null,
  -- Numeric caps. NULL means unlimited.
  max_artist_profiles int,
  max_booking_requests_per_month int,
  max_team_members int
);

insert into plans (tier, name, price_paise, annual_price_paise, blurb, sort_order,
                   max_artist_profiles, max_booking_requests_per_month, max_team_members) values
 ('basic','Basic',   49900,   499000,
  'For a solo artist or a first event. One profile, ten requests a month.', 1, 1, 10, 1),
 ('plus','Plus',    149900,  1499000,
  'For a working act or a small event company. Price benchmarks and reliability scores.', 2, 3, 50, 3),
 ('pro','Pro',      499900,  4999000,
  'For managers with a roster and promoters running a season. Unlimited requests.', 3, 15, null, 10),
 ('max','Max',     1499900, 14999000,
  'For agencies and venues. Unlimited everything, multiple teams, priority support.', 4, null, null, null);

create table plan_entitlements (
  tier text not null references plans(tier) on delete cascade,
  entitlement text not null,
  primary key (tier, entitlement)
);

insert into plan_entitlements (tier, entitlement) values
 -- Basic: the two gated core actions, nothing else.
 ('basic','list_artist_profile'), ('basic','send_booking_requests'),
 -- Plus adds the analytical surfaces.
 ('plus','list_artist_profile'), ('plus','send_booking_requests'),
 ('plus','price_benchmarks'), ('plus','reliability_scores'), ('plus','organiser_profile'),
 -- Pro adds roster and collaboration tooling.
 ('pro','list_artist_profile'), ('pro','send_booking_requests'),
 ('pro','price_benchmarks'), ('pro','reliability_scores'), ('pro','organiser_profile'),
 ('pro','roster_calendar'), ('pro','collabs'), ('pro','credits_registry'), ('pro','settlements'),
 -- Max adds everything plus scale features.
 ('max','list_artist_profile'), ('max','send_booking_requests'),
 ('max','price_benchmarks'), ('max','reliability_scores'), ('max','organiser_profile'),
 ('max','roster_calendar'), ('max','collabs'), ('max','credits_registry'), ('max','settlements'),
 ('max','api_access'), ('max','multi_team'), ('max','priority_support');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  tier text not null references plans(tier),
  status text not null default 'pending'
    check (status in ('pending','trialing','active','past_due','cancelled','expired')),
  billing_period text not null default 'monthly' check (billing_period in ('monthly','annual')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '30 days',
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One live subscription per org. Upgrades mutate this row rather than
  -- stacking, so "which plan am I on" is never ambiguous.
  unique (org_id)
);
create index subscriptions_status_idx on subscriptions (status, current_period_end);

alter table plans enable row level security;
alter table plan_entitlements enable row level security;
alter table subscriptions enable row level security;

-- The price list is public: a paywall nobody can read the terms of is a
-- dark pattern, and the pricing page must render for logged-out visitors.
create policy plans_public_read on plans for select to anon, authenticated using (true);
create policy plan_entitlements_public_read on plan_entitlements for select to anon, authenticated using (true);
create policy subscriptions_own on subscriptions for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- [applied as: entitlement_enforcement]
-- The gate itself.
--
-- Enforced in the database rather than in route handlers, for the same
-- reason the settlement balance is: a check that lives in one of forty-five
-- route files is a check that will eventually be forgotten in the
-- forty-sixth. Every paid path calls has_entitlement().

create or replace function has_entitlement(p_entitlement text, p_org_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from subscriptions s
    join plan_entitlements pe on pe.tier = s.tier
    where s.org_id = coalesce(p_org_id, current_org_id())
      and pe.entitlement = p_entitlement
      -- 'trialing' counts; 'past_due' deliberately does not — a lapsed card
      -- should stop access, and the dunning job chases it separately.
      and s.status in ('active','trialing')
      and s.current_period_end > now()
  );
$$;
grant execute on function has_entitlement(text, uuid) to authenticated;

-- What the current org can do, for rendering the UI without guessing.
create or replace function my_entitlements()
returns table (entitlement text, tier text, status text, current_period_end timestamptz)
language sql security definer set search_path = public stable as $$
  select pe.entitlement, s.tier, s.status, s.current_period_end
  from subscriptions s
  join plan_entitlements pe on pe.tier = s.tier
  where s.org_id = current_org_id()
    and s.status in ('active','trialing')
    and s.current_period_end > now();
$$;
grant execute on function my_entitlements() to authenticated;

-- Usage counting, for the per-plan caps.
create or replace function booking_requests_this_month(p_org_id uuid default null)
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from briefs
  where requesting_org_id = coalesce(p_org_id, current_org_id())
    and created_at >= date_trunc('month', now());
$$;
grant execute on function booking_requests_this_month(uuid) to authenticated;

-- --------------------------------------------------------- gate: booking
-- Organisers must hold send_booking_requests, and stay within their cap.

create or replace function create_authenticated_brief_for_artist(
  p_artist_id uuid, p_event_date date, p_city text, p_event_type text, p_genres text[],
  p_budget_min_paise bigint, p_budget_max_paise bigint, p_crowd_size int, p_notes text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_artist_org_id uuid; v_requesting_org_id uuid; v_organiser_id uuid;
  v_organiser_name text; v_organiser_phone text; v_brief_id uuid;
  v_cap int; v_used int;
begin
  v_requesting_org_id := current_org_id();
  if v_requesting_org_id is null then raise exception 'UNAUTHENTICATED'; end if;

  if not has_entitlement('send_booking_requests', v_requesting_org_id) then
    raise exception 'SUBSCRIPTION_REQUIRED: sending booking requests needs an active plan';
  end if;

  select p.max_booking_requests_per_month into v_cap
  from subscriptions s join plans p on p.tier = s.tier
  where s.org_id = v_requesting_org_id;

  if v_cap is not null then
    v_used := booking_requests_this_month(v_requesting_org_id);
    if v_used >= v_cap then
      raise exception 'PLAN_LIMIT_REACHED: % booking requests used of % this month', v_used, v_cap;
    end if;
  end if;

  select org_id into v_artist_org_id from artists where id = p_artist_id;
  if v_artist_org_id is null then raise exception 'NOT_FOUND: artist not found'; end if;

  select name into v_organiser_name from orgs where id = v_requesting_org_id;
  select au.phone into v_organiser_phone from org_members om join auth.users au on au.id = om.user_id
    where om.org_id = v_requesting_org_id and au.phone is not null limit 1;

  select id into v_organiser_id from organisers
    where org_id = v_artist_org_id and phone = coalesce(v_organiser_phone, '') limit 1;
  if v_organiser_id is null then
    insert into organisers (org_id, name, phone, city)
    values (v_artist_org_id, coalesce(v_organiser_name,'Organiser'), coalesce(v_organiser_phone,''), p_city)
    returning id into v_organiser_id;
  end if;

  insert into briefs (org_id, organiser_id, requesting_org_id, requested_artist_id, event_date, city,
                      event_type, genres, budget_min_paise, budget_max_paise, crowd_size, notes, source)
  values (v_artist_org_id, v_organiser_id, v_requesting_org_id, p_artist_id, p_event_date, p_city,
          p_event_type, coalesce(p_genres,'{}'), p_budget_min_paise, p_budget_max_paise, p_crowd_size,
          p_notes, 'web')
  returning id into v_brief_id;
  return v_brief_id;
end $$;
revoke execute on function create_authenticated_brief_for_artist(
  uuid, date, text, text, text[], bigint, bigint, int, text) from public, anon;
grant execute on function create_authenticated_brief_for_artist(
  uuid, date, text, text, text[], bigint, bigint, int, text) to authenticated;

-- ---------------------------------------------------- gate: listing yourself
-- A profile may exist as a draft on any plan; it becomes publicly listed
-- only with an entitlement. Draft-then-pay is a far better funnel than
-- refusing to let someone type their own name in.

alter table artists add column if not exists listed boolean not null default false;
create index if not exists artists_listed_idx on artists (listed) where listed;

create or replace function assert_can_list_artist()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.listed and not coalesce(old.listed, false) then
    if not has_entitlement('list_artist_profile', new.org_id) then
      raise exception 'SUBSCRIPTION_REQUIRED: listing a profile publicly needs an active plan';
    end if;
    if (select count(*) from artists a
        where a.org_id = new.org_id and a.listed and a.id <> new.id)
       >= coalesce((select p.max_artist_profiles from subscriptions s
                    join plans p on p.tier = s.tier where s.org_id = new.org_id), 2147483647)
    then
      raise exception 'PLAN_LIMIT_REACHED: your plan does not allow another listed profile';
    end if;
  end if;
  return new;
end $$;

create trigger artists_listing_requires_plan
  before insert or update of listed on artists
  for each row execute function assert_can_list_artist();

-- Existing seeded profiles predate the gate; grandfather them so the
-- homepage and SEO pages do not empty out on deploy.
update artists set listed = true where listed = false;

-- [applied as: entitlement_enforcement]
create or replace function has_entitlement(p_entitlement text, p_org_id uuid default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from subscriptions s
    join plan_entitlements pe on pe.tier = s.tier
    where s.org_id = coalesce(p_org_id, current_org_id())
      and pe.entitlement = p_entitlement
      and s.status in ('active','trialing')
      and s.current_period_end > now()
  );
$$;
grant execute on function has_entitlement(text, uuid) to authenticated;

create or replace function my_entitlements()
returns table (entitlement text, tier text, status text, current_period_end timestamptz)
language sql security definer set search_path = public stable as $$
  select pe.entitlement, s.tier, s.status, s.current_period_end
  from subscriptions s join plan_entitlements pe on pe.tier = s.tier
  where s.org_id = current_org_id()
    and s.status in ('active','trialing') and s.current_period_end > now();
$$;
grant execute on function my_entitlements() to authenticated;

create or replace function booking_requests_this_month(p_org_id uuid default null)
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from briefs
  where requesting_org_id = coalesce(p_org_id, current_org_id())
    and created_at >= date_trunc('month', now());
$$;
grant execute on function booking_requests_this_month(uuid) to authenticated;

create or replace function create_authenticated_brief_for_artist(
  p_artist_id uuid, p_event_date date, p_city text, p_event_type text, p_genres text[],
  p_budget_min_paise bigint, p_budget_max_paise bigint, p_crowd_size int, p_notes text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_artist_org_id uuid; v_requesting_org_id uuid; v_organiser_id uuid;
  v_organiser_name text; v_organiser_phone text; v_brief_id uuid; v_cap int; v_used int;
begin
  v_requesting_org_id := current_org_id();
  if v_requesting_org_id is null then raise exception 'UNAUTHENTICATED'; end if;

  if not has_entitlement('send_booking_requests', v_requesting_org_id) then
    raise exception 'SUBSCRIPTION_REQUIRED: sending booking requests needs an active plan';
  end if;

  select p.max_booking_requests_per_month into v_cap
  from subscriptions s join plans p on p.tier = s.tier where s.org_id = v_requesting_org_id;

  if v_cap is not null then
    v_used := booking_requests_this_month(v_requesting_org_id);
    if v_used >= v_cap then
      raise exception 'PLAN_LIMIT_REACHED: % booking requests used of % this month', v_used, v_cap;
    end if;
  end if;

  select org_id into v_artist_org_id from artists where id = p_artist_id;
  if v_artist_org_id is null then raise exception 'NOT_FOUND: artist not found'; end if;
  select name into v_organiser_name from orgs where id = v_requesting_org_id;
  select au.phone into v_organiser_phone from org_members om join auth.users au on au.id = om.user_id
    where om.org_id = v_requesting_org_id and au.phone is not null limit 1;
  select id into v_organiser_id from organisers
    where org_id = v_artist_org_id and phone = coalesce(v_organiser_phone,'') limit 1;
  if v_organiser_id is null then
    insert into organisers (org_id, name, phone, city)
    values (v_artist_org_id, coalesce(v_organiser_name,'Organiser'), coalesce(v_organiser_phone,''), p_city)
    returning id into v_organiser_id;
  end if;
  insert into briefs (org_id, organiser_id, requesting_org_id, requested_artist_id, event_date, city,
                      event_type, genres, budget_min_paise, budget_max_paise, crowd_size, notes, source)
  values (v_artist_org_id, v_organiser_id, v_requesting_org_id, p_artist_id, p_event_date, p_city,
          p_event_type, coalesce(p_genres,'{}'), p_budget_min_paise, p_budget_max_paise, p_crowd_size,
          p_notes, 'web')
  returning id into v_brief_id;
  return v_brief_id;
end $$;
revoke execute on function create_authenticated_brief_for_artist(
  uuid, date, text, text, text[], bigint, bigint, int, text) from public, anon;
grant execute on function create_authenticated_brief_for_artist(
  uuid, date, text, text, text[], bigint, bigint, int, text) to authenticated;

-- Column and grandfathering FIRST, trigger afterwards. Creating the trigger
-- before backfilling made the backfill trip the very gate it was exempting.
alter table artists add column if not exists listed boolean not null default false;
update artists set listed = true where listed = false;
create index if not exists artists_listed_idx on artists (listed) where listed;

create or replace function assert_can_list_artist()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.listed and not coalesce(old.listed, false) then
    if not has_entitlement('list_artist_profile', new.org_id) then
      raise exception 'SUBSCRIPTION_REQUIRED: listing a profile publicly needs an active plan';
    end if;
    if (select count(*) from artists a where a.org_id = new.org_id and a.listed and a.id <> new.id)
       >= coalesce((select p.max_artist_profiles from subscriptions s join plans p on p.tier = s.tier
                    where s.org_id = new.org_id), 2147483647)
    then
      raise exception 'PLAN_LIMIT_REACHED: your plan does not allow another listed profile';
    end if;
  end if;
  return new;
end $$;

create trigger artists_listing_requires_plan
  before insert or update of listed on artists
  for each row execute function assert_can_list_artist();
