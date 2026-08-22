# 03 — Data Model

Money is `bigint` paise. Timestamps `timestamptz` UTC. Every table has `org_id`, `created_at`, `updated_at`.

## Migration order

| #   | Module    | Creates                                                                                 |
| --- | --------- | --------------------------------------------------------------------------------------- |
| 001 | platform  | `orgs`, `org_members`, `current_org_id()`, RLS defaults                                 |
| 002 | Profiles  | `profiles`, `artists`, `roster`, `artist_roles`                                         |
| 003 | Credits   | `works`, `contributors` + lock trigger                                                  |
| 004 | Gigs      | `organisers`, `venues`, `briefs`, `shortlists`, `quotes`, `holds`, `bookings`, `riders` |
| 005 | Payments  | `contracts`, `settlements`, `splits`, `payouts`, `ledger_entries`                       |
| 006 | Collabs   | `collab_requests`, `collab_slots`, `applications`, `rooms`, `room_versions`             |
| 007 | Studio    | `tracks`, `analyses`, `generation_jobs`                                                 |
| 008 | Promotion | `fans`, `fan_events`, `campaigns`                                                       |
| 009 | Stage     | `seasons`, `submissions`, `scores`, `episodes`                                          |
| 010 | platform  | `benchmark_index` matview, `reliability_scores`                                         |

## 001 — Tenancy foundation

```sql
create table orgs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('manager','agency','self','organiser','venue','brand')),
  name text not null,
  gst text, pan text,
  kyc_status text not null default 'pending'
    check (kyc_status in ('pending','submitted','verified','rejected')),
  plan_tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create function current_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'org_id','')::uuid
$$;

alter table orgs enable row level security;
alter table org_members enable row level security;
create policy org_self    on orgs        for select using (id = current_org_id());
create policy member_self on org_members for select using (user_id = auth.uid());
```

**Every subsequent table follows the template. There is no table without it.**

## 002 — Profiles

```sql
create table artists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  stage_name text not null,
  slug text unique not null,          -- public URL
  home_city text,
  genres text[] default '{}',
  bio text,
  verified boolean not null default false,
  fee_band_visible boolean not null default false,
  created_at timestamptz not null default now()
);

-- one person, many roles. THIS is what makes it one platform.
create table artist_roles (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  org_id uuid not null references orgs(id),
  role text not null,                 -- vocalist | beat_producer | mix_engineer |
                                      -- session_drums | tour_manager | dj | ...
  attributes jsonb not null default '{}',
  -- vocalist: { range, timbre[], languages[], keyComfort }
  -- producer: { genres[], bpmRange, daw, turnaroundDays }
  -- engineer: { specialism[], stemCapacity, revisionPolicy }
  proof_media_url text,
  active boolean not null default true,
  unique (artist_id, role)
);

create table roster (
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  commission_pct numeric(5,2) not null default 0,
  exclusive boolean not null default false,
  start_date date, end_date date,
  primary key (org_id, artist_id)
);
```

A self-managed artist is an org with one roster row and `commission_pct = 0`.

## 003 — Credits

```sql
create table works (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  title text not null,
  iswc text, isrc text,
  status text not null default 'draft' check (status in ('draft','sent','locked')),
  locked_at timestamptz,
  room_id uuid,
  created_at timestamptz not null default now()
);

create table contributors (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works(id) on delete cascade,
  org_id uuid not null references orgs(id),
  artist_id uuid references artists(id),
  name text not null, phone text not null, role text not null,
  writer_pct numeric(5,2) not null default 0,
  master_pct numeric(5,2) not null default 0,
  work_for_hire boolean not null default false,
  pro_affiliation text,
  signed_at timestamptz, signature_ref text
);
```

**Invariant — enforced in Postgres:**

```sql
create function assert_splits_total() returns trigger
language plpgsql as $$
declare w numeric; m numeric;
begin
  select coalesce(sum(writer_pct),0), coalesce(sum(master_pct),0)
    into w, m from contributors where work_id = new.id;
  if w <> 100 or m <> 100 then
    raise exception 'SPLITS_MUST_TOTAL_100 (writer=%, master=%)', w, m;
  end if;
  if exists (select 1 from contributors where work_id = new.id and signed_at is null) then
    raise exception 'ALL_CONTRIBUTORS_MUST_SIGN';
  end if;
  return new;
end $$;

create trigger works_lock_guard before update on works
  for each row when (new.status = 'locked' and old.status <> 'locked')
  execute function assert_splits_total();
```

A locked work is immutable. Amendments create a new version row.

## 004 — Gigs

```sql
create table briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  organiser_id uuid references organisers(id),
  event_date date, date_flexible_until date,
  city text not null,
  event_type text not null
    check (event_type in ('wedding','corporate','festival','club','college',
                          'private','government','temple','other')),
  genres text[] default '{}',
  budget_min_paise bigint, budget_max_paise bigint,
  budget_inferred boolean not null default false,
  crowd_size int,
  source text not null default 'web'
    check (source in ('web','whatsapp','pdf','concierge')),
  brief_json jsonb,                   -- MUSIC_BRIEF, see packages/intent
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  brief_id uuid references briefs(id),
  event_date date not null,
  state text not null default 'enquiry'
    check (state in ('enquiry','soft_1','soft_2','soft_3','confirmed','contracted',
                     'advance_paid','performed','settled','closed',
                     'released','cancelled','disputed','expired')),
  priority int not null default 1,
  expires_at timestamptz not null,
  challenged_at timestamptz, released_at timestamptz
);

-- one confirmed booking per artist per date. Enforced, not hoped for.
create unique index holds_one_confirmed_per_date
  on holds (artist_id, event_date)
  where state in ('confirmed','contracted','advance_paid','performed','settled');
```

## 006 — Collabs

```sql
create table collab_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  kind text not null
    check (kind in ('track','band','crew','engineer','visual','mentor','session')),
  title text not null, body text,
  brief_json jsonb,                   -- MUSIC_BRIEF: bpm, key, mood, languages
  reference_url text,                 -- from Studio, or uploaded
  visibility text not null default 'open'
    check (visibility in ('open','invite','roster','verified')),
  status text not null default 'open'
    check (status in ('draft','open','partially_filled','filled','closed','expired')),
  deadline timestamptz
);

-- INDEPENDENT slots. A request can need a songwriter AND a vocalist
-- on completely different terms, closed separately.
create table collab_slots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references collab_requests(id) on delete cascade,
  org_id uuid not null references orgs(id),
  role text not null,
  requirements jsonb not null default '{}',
  comp_model text not null check (comp_model in ('fee','points','hybrid','credit')),
  fee_paise bigint,
  writer_pct numeric(5,2), master_pct numeric(5,2),
  revisions_included int,
  status text not null default 'open'
    check (status in ('open','applied','shortlisted','accepted','delivered','settled',
                      'withdrawn','expired')),
  filled_by uuid references artists(id)
);
```

**`comp_model = 'credit'` must be explicitly chosen. Never default to it.**

## 010 — Benchmark index

```sql
create materialized view benchmark_index as
select genre, city, event_type, crowd_band, season,
       percentile_cont(0.25) within group (order by fee_paise) as p25,
       percentile_cont(0.50) within group (order by fee_paise) as p50,
       percentile_cont(0.75) within group (order by fee_paise) as p75,
       count(*) as sample_n
from settled_bookings_view
group by 1,2,3,4,5
having count(*) >= 5;
```

Never expose raw rows. Percentile bands only. Minimum `sample_n` 5 so individual deals cannot be reverse-engineered. Anomaly review before a fee enters.

## Index checklist

Every FK indexed. Partial indexes on hot `status`/`state` filters. `ivfflat` on vector columns. Composite `(org_id, created_at desc)` on anything paginated.
