-- 012 — Gigs
-- docs/03-DATA-MODEL.md §004, docs/05-GIGS.md, docs/12-API.md §Gigs.
-- Flow: brief intake → shortlist → quote → hold → contract → advance →
-- rider → performed → settled → index → re-book. This migration covers
-- everything through "hold confirms into a booking" and "rider" — contract,
-- advance and settlement are docs/09-PAYMENTS.md's job (M5, not built yet).

create table organisers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  phone text,
  company text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  name text not null,
  city text not null,
  capacity int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- requested_artist_id: not in the doc's literal SQL, added for the public
-- "Book this artist" path (docs/05-GIGS.md's brief intake has no public
-- endpoint spec beyond "web form" — see create_public_brief below for the
-- reasoning). A general roster-wide brief leaves this null; shortlisting
-- still runs across the whole roster either way.
create table briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  organiser_id uuid references organisers(id),
  venue_id uuid references venues(id),
  requested_artist_id uuid references artists(id),
  event_date date,
  date_flexible_until date,
  city text not null,
  event_type text not null
    check (event_type in ('wedding','corporate','festival','club','college',
                          'private','government','temple','other')),
  genres text[] not null default '{}',
  budget_min_paise bigint,
  budget_max_paise bigint,
  budget_inferred boolean not null default false,
  crowd_size int,
  notes text,
  source text not null default 'web'
    check (source in ('web','whatsapp','pdf','concierge')),
  brief_json jsonb,
  status text not null default 'open'
    check (status in ('open','shortlisted','quoted','held','confirmed','closed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per scored candidate per shortlist run (docs/12-API.md: "Always
-- return score_components — an unexplained ranking is not trusted"), kept
-- so a shortlist is auditable after the fact, not just a transient response.
create table shortlists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  brief_id uuid not null references briefs(id) on delete cascade,
  artist_id uuid not null references artists(id),
  score numeric(6,4) not null,
  components jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (brief_id, artist_id)
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  brief_id uuid not null references briefs(id) on delete cascade,
  artist_id uuid not null references artists(id),
  fee_paise bigint not null check (fee_paise > 0),
  valid_until timestamptz,
  status text not null default 'sent' check (status in ('sent','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  brief_id uuid references briefs(id),
  quote_id uuid references quotes(id),
  event_date date not null,
  state text not null default 'enquiry'
    check (state in ('enquiry','soft_1','soft_2','soft_3','confirmed','contracted',
                     'advance_paid','performed','settled','closed',
                     'released','cancelled','disputed','expired')),
  priority int not null default 1,
  expires_at timestamptz not null,
  challenged_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One confirmed booking per artist per date. Enforced, not hoped for
-- (docs/03-DATA-MODEL.md, verbatim column set).
create unique index holds_one_confirmed_per_date
  on holds (artist_id, event_date)
  where state in ('confirmed','contracted','advance_paid','performed','settled');

create index holds_artist_date_idx on holds (artist_id, event_date);
create index holds_org_state_idx on holds (org_id, state);

-- A booking is the durable record of a confirmed engagement; a hold is the
-- calendar-blocking mechanism that gets it there. Not in the doc's literal
-- 004 SQL (only listed in the migration-order table's "Creates" column) —
-- shaped to hold the one fact the benchmark index needs later
-- (docs/03-DATA-MODEL.md §010's settled_bookings_view): a settled fee tied
-- to genre/city/event_type/crowd_size via brief_id.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  hold_id uuid not null references holds(id),
  brief_id uuid references briefs(id),
  quote_id uuid references quotes(id),
  artist_id uuid not null references artists(id),
  organiser_id uuid references organisers(id),
  event_date date not null,
  fee_paise bigint not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','performed','settled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hold_id)
);

-- Templates-per-artist (docs/05-GIGS.md) are not modelled yet — flagged,
-- not silently dropped. confirm_token is the organiser's possession-of-link
-- credential, same pattern as migration 007's contributor signature_ref.
create table riders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  booking_id uuid not null references bookings(id) on delete cascade,
  backline jsonb not null default '{}',
  travel jsonb not null default '{}',
  hospitality jsonb not null default '{}',
  artist_confirmed_at timestamptz,
  organiser_confirmed_at timestamptz,
  confirm_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);

-- Standard org-scoped RLS template (docs/02-ARCHITECTURE.md), one pass per
-- table. RLS is the isolation boundary; every write also carries a
-- WITH CHECK so a row can't be re-parented to another org after creation.
alter table organisers enable row level security;
create policy organisers_read  on organisers for select using (org_id = current_org_id());
create policy organisers_write on organisers for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table venues enable row level security;
create policy venues_read  on venues for select using (org_id = current_org_id());
create policy venues_write on venues for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table briefs enable row level security;
create policy briefs_read  on briefs for select using (org_id = current_org_id());
create policy briefs_write on briefs for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table shortlists enable row level security;
create policy shortlists_read  on shortlists for select using (org_id = current_org_id());
create policy shortlists_write on shortlists for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table quotes enable row level security;
create policy quotes_read  on quotes for select using (org_id = current_org_id());
create policy quotes_write on quotes for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table holds enable row level security;
create policy holds_read  on holds for select using (org_id = current_org_id());
create policy holds_write on holds for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table bookings enable row level security;
create policy bookings_read  on bookings for select using (org_id = current_org_id());
create policy bookings_write on bookings for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table riders enable row level security;
create policy riders_read  on riders for select using (org_id = current_org_id());
create policy riders_write on riders for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Defence in depth beyond RLS (docs/02-ARCHITECTURE.md: "application checks
-- are defence in depth, never the primary control"): RLS alone would let an
-- org hold a date against an artist_id it doesn't own, as long as it wrote
-- its own org_id on the row — the FK to artists doesn't check ownership.
-- "A date cannot be double-confirmed across a roster" only means something
-- if a roster's own manager is the only one who can hold its artists' dates.
create function assert_hold_artist_owned_by_org() returns trigger
language plpgsql as $$
declare artist_org uuid;
begin
  select org_id into artist_org from artists where id = new.artist_id;
  if artist_org is distinct from new.org_id then
    raise exception 'FORBIDDEN: artist does not belong to this org';
  end if;
  return new;
end $$;

create trigger holds_artist_org_guard before insert or update on holds
  for each row execute function assert_hold_artist_owned_by_org();

-- confirm_hold: the one multi-table transition in this migration (hold →
-- confirmed, plus the booking row that becomes its durable record), same
-- atomicity reasoning as migration 007's create_work_with_contributors.
-- security invoker deliberately — it must run as the calling user so both
-- writes still pass the RLS policies above; there is no privilege being
-- escalated here; org_id round-trips from the existing hold row.
create function confirm_hold(p_hold_id uuid, p_fee_paise bigint default null)
returns bookings
language plpgsql security invoker as $$
declare
  v_hold holds;
  v_fee bigint;
  v_organiser_id uuid;
  v_booking bookings;
begin
  select * into v_hold from holds where id = p_hold_id;
  if v_hold.id is null then
    raise exception 'NOT_FOUND: hold not found';
  end if;
  if v_hold.state in ('confirmed','contracted','advance_paid','performed','settled',
                      'closed','released','cancelled','expired') then
    raise exception 'INVALID_TRANSITION: hold is already %', v_hold.state;
  end if;
  if v_hold.expires_at < now() then
    -- Deliberately not writing state = 'expired' here: an exception raised
    -- later in this same function call would roll this write back too
    -- (one function invocation is one statement/subtransaction). Real
    -- auto-release is the deferred Inngest job (docs/02-ARCHITECTURE.md);
    -- this is the read-time rejection half only — it stops a stale hold
    -- from confirming, it does not (yet) rewrite the row to say so.
    raise exception 'HOLD_EXPIRED: this hold expired at %', v_hold.expires_at;
  end if;

  v_fee := coalesce(p_fee_paise, (select fee_paise from quotes where id = v_hold.quote_id));
  if v_fee is null then
    raise exception 'VALIDATION_FAILED: a fee is required to confirm — link a quote or pass a fee';
  end if;

  -- Fires holds_one_confirmed_per_date on a genuine double-booking attempt;
  -- the caller translates the resulting unique_violation (23505) into the
  -- documented DATE_ALREADY_CONFIRMED (docs/12-API.md), not this function.
  update holds set state = 'confirmed', updated_at = now() where id = p_hold_id;

  select organiser_id into v_organiser_id from briefs where id = v_hold.brief_id;

  insert into bookings (org_id, hold_id, brief_id, quote_id, artist_id, organiser_id,
                         event_date, fee_paise)
  values (v_hold.org_id, v_hold.id, v_hold.brief_id, v_hold.quote_id, v_hold.artist_id,
          v_organiser_id, v_hold.event_date, v_fee)
  returning * into v_booking;

  return v_booking;
end $$;

grant execute on function confirm_hold(uuid, bigint) to authenticated;

-- create_public_brief — the public brief-intake path (docs/05-GIGS.md:
-- "Web form" is one of three intake paths; the other two need WhatsApp/PDF
-- parsing, not built — see modules/gigs). Routed through a specific
-- artist's public page ("Book this artist" on /a/[slug]) rather than a
-- generic inbound inbox: there's no public per-org booking page built yet,
-- and this reuses infrastructure that already exists and is genuinely
-- useful (the brief still runs through the full shortlist against that
-- artist's whole roster, it's just seeded with one requested artist).
-- SECURITY DEFINER because the caller has no session — org_id is resolved
-- from the artist being booked, never accepted from the client, same
-- "narrow, audited exception" reasoning as migration 007's get_work_public.
create function create_public_brief(
  p_artist_id uuid,
  p_event_date date,
  p_city text,
  p_event_type text,
  p_genres text[],
  p_budget_min_paise bigint,
  p_budget_max_paise bigint,
  p_crowd_size int,
  p_notes text,
  p_organiser_name text,
  p_organiser_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_organiser_id uuid;
  v_brief_id uuid;
begin
  select org_id into v_org_id from artists where id = p_artist_id;
  if v_org_id is null then
    raise exception 'NOT_FOUND: artist not found';
  end if;

  select id into v_organiser_id from organisers
  where org_id = v_org_id and phone = p_organiser_phone
  limit 1;

  if v_organiser_id is null then
    insert into organisers (org_id, name, phone, city)
    values (v_org_id, p_organiser_name, p_organiser_phone, p_city)
    returning id into v_organiser_id;
  end if;

  insert into briefs (org_id, organiser_id, requested_artist_id, event_date, city,
                       event_type, genres, budget_min_paise, budget_max_paise, crowd_size,
                       notes, source)
  values (v_org_id, v_organiser_id, p_artist_id, p_event_date, p_city, p_event_type,
          coalesce(p_genres, '{}'), p_budget_min_paise, p_budget_max_paise, p_crowd_size,
          p_notes, 'web')
  returning id into v_brief_id;

  return v_brief_id;
end $$;

grant execute on function create_public_brief(
  uuid, date, text, text, text[], bigint, bigint, int, text, text, text
) to anon, authenticated;

-- Rider — organiser side has no account (same category as a Credits
-- contributor signing from a phone). get_rider_public + confirm_rider_public
-- are the possession-of-link pair, same shape as migration 007's
-- get_work_public / sign_as_contributor.
create function get_rider_public(p_booking_id uuid, p_token text)
returns table (
  id uuid, backline jsonb, travel jsonb, hospitality jsonb,
  artist_confirmed_at timestamptz, organiser_confirmed_at timestamptz,
  event_date date
)
language sql security definer set search_path = public stable as $$
  select r.id, r.backline, r.travel, r.hospitality,
         r.artist_confirmed_at, r.organiser_confirmed_at, b.event_date
  from riders r join bookings b on b.id = r.booking_id
  where r.booking_id = p_booking_id and r.confirm_token = p_token;
$$;

grant execute on function get_rider_public(uuid, text) to anon, authenticated;

create function confirm_rider_public(p_booking_id uuid, p_token text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update riders set organiser_confirmed_at = now(), updated_at = now()
  where booking_id = p_booking_id and confirm_token = p_token and organiser_confirmed_at is null;
  return found;
end $$;

grant execute on function confirm_rider_public(uuid, text) to anon, authenticated;

-- Benchmark index (docs/03-DATA-MODEL.md §010). Sourced from this
-- migration's own `bookings` rather than deferring to Payments — a
-- settled booking's fee is already known here; Payments (M5, not built)
-- will decide what "settled" formally requires, but the shape a settled
-- booking needs to expose to the index doesn't change once that lands.
-- One row per (booking, genre) via unnest — a multi-genre booking
-- contributes its fee to every genre band it fits, matching "genres text[]"
-- on briefs.
--
-- crowd_band and season are simplifications, flagged: crowd_band is a fixed
-- four-bucket ladder rather than a tuned one (no real settlement data exists
-- yet to tune it against), and season is the event's calendar quarter, not
-- a wedding-industry season calendar (peak/off-peak by region isn't modelled
-- yet). Both are cheap to change later; sample_n < 5 hides them either way.
create view settled_bookings_view as
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

-- No settled bookings exist yet — this view is legitimately empty until
-- Payments (M5) exists and deals actually close. GET /api/gigs/index will
-- correctly return INSUFFICIENT_INDEX_DATA for everything until then; that
-- is the documented, correct behaviour (docs/03-DATA-MODEL.md: "never
-- invent a price"), not a bug to work around.
