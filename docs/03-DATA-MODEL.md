# 03 — Data Model

Money is `bigint` paise. Timestamps are `timestamptz` UTC. Every table has `org_id`, `created_at`, `updated_at`.

## Migration order

| # | Creates | Note |
|---|---|---|
| 001 | `orgs`, `org_members`, `current_org_id()`, RLS defaults | **Before any domain table. No exceptions.** |
| 002 | `artists`, `roster`, `profiles` | Identity |
| 003 | `shouts`, `shout_slots`, `answers` | The core object |
| 004 | `works`, `contributors`, `credits` | Split sheets + graph |
| 005 | `organisers`, `venues`, `holds`, `bookings`, `riders` | Gig side |
| 006 | `contracts`, `settlements`, `splits`, `payouts`, `ledger_entries` | Money |
| 007 | `rooms`, `room_versions`, `messages` | Collab workspace |
| 008 | `fans`, `fan_events` | Circle |
| 009 | `submissions`, `seasons`, `episodes`, `scores` | Stage |
| 010 | `licenses`, `benchmark_index` (matview), `reliability_scores` | Assets |

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

-- active org comes from the JWT, set at login and on org switch
create function current_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'org_id','')::uuid
$$;

alter table orgs enable row level security;
alter table org_members enable row level security;

create policy org_self on orgs for select
  using (id = current_org_id());
create policy member_self on org_members for select
  using (user_id = auth.uid());
```

**Every subsequent table follows this template. There is no table without it.**

```sql
alter table <t> enable row level security;
create policy <t>_read  on <t> for select using (org_id = current_org_id());
create policy <t>_write on <t> for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
```

## 003 — The Shout object

```sql
create table shouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  type text not null,                       -- validated against packages/shout-types registry
  title text not null,
  body text,
  status text not null default 'draft'
    check (status in ('draft','open','partially_filled','filled','closed',
                      'cancelled','expired')),
  visibility text not null default 'open'
    check (visibility in ('open','invite','roster','verified')),
  city text, deadline timestamptz,
  intent jsonb,                             -- GENERATION_INTENT, see packages/intent
  intent_embedding vector(1536),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shout_slots (
  id uuid primary key default gen_random_uuid(),
  shout_id uuid not null references shouts(id) on delete cascade,
  org_id uuid not null references orgs(id),
  role text not null,                       -- from registry.roles for this type
  attributes jsonb not null default '{}',   -- validated by registry.attributeSchema
  comp_model text not null
    check (comp_model in ('fee','points','hybrid','credit')),
  fee_paise bigint,
  writer_pct numeric(5,2), master_pct numeric(5,2),
  deadline timestamptz,
  status text not null default 'open'
    check (status in ('open','answered','shortlisted','accepted','contracted',
                      'delivered','settled','withdrawn','declined','expired')),
  filled_by uuid references artists(id),
  created_at timestamptz not null default now()
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references shout_slots(id) on delete cascade,
  org_id uuid not null references orgs(id),
  responder_org_id uuid not null references orgs(id),
  responder_artist_id uuid references artists(id),
  pitch text, media_url text,
  score numeric, score_components jsonb,
  status text not null default 'submitted'
    check (status in ('submitted','shortlisted','accepted','declined','withdrawn')),
  created_at timestamptz not null default now()
);

create index shouts_intent_idx on shouts using ivfflat (intent_embedding vector_cosine_ops);
create index shouts_open_idx on shouts (type, city, status) where status = 'open';
create index slots_open_idx on shout_slots (role, status) where status = 'open';
```

**Slots fill independently.** A Shout can be `partially_filled`. One Shout carries a songwriter slot on points and a vocalist slot on a flat fee, closed separately.

**`comp_model = 'credit'` must be explicitly chosen. Never default to it.**

## 004 — Split sheets and the graph

```sql
create table works (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  title text not null,
  iswc text, isrc text,
  status text not null default 'draft' check (status in ('draft','locked')),
  locked_at timestamptz,
  created_from_room_id uuid,
  created_at timestamptz not null default now()
);

create table contributors (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works(id) on delete cascade,
  org_id uuid not null references orgs(id),
  shoutout_id uuid references artists(id),
  name text not null, phone text not null, role text not null,
  writer_pct numeric(5,2) not null default 0,
  master_pct numeric(5,2) not null default 0,
  work_for_hire boolean not null default false,
  pro_affiliation text,
  signed_at timestamptz, signature_ref text
);
```

**Invariant, enforced in Postgres:**

```sql
create function assert_splits_total() returns trigger
language plpgsql as $$
declare w numeric; m numeric;
begin
  if new.status = 'locked' then
    select coalesce(sum(writer_pct),0), coalesce(sum(master_pct),0)
      into w, m from contributors where work_id = new.id;
    if w <> 100 or m <> 100 then
      raise exception 'SPLITS_MUST_TOTAL_100 (writer=%, master=%)', w, m;
    end if;
    if exists (select 1 from contributors
               where work_id = new.id and signed_at is null) then
      raise exception 'ALL_CONTRIBUTORS_MUST_SIGN';
    end if;
  end if;
  return new;
end $$;

create trigger works_lock_guard before update on works
  for each row when (new.status = 'locked') execute function assert_splits_total();
```

**A locked work is immutable.** Amendments create a new version row; they never mutate the original.

## 005 — Holds

```sql
create table holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  shout_id uuid references shouts(id),
  event_date date not null,
  state text not null default 'enquiry'
    check (state in ('enquiry','soft_hold_1','soft_hold_2','soft_hold_3',
                     'confirmed','contracted','advance_paid','performed',
                     'settled','closed','released','cancelled','disputed','expired')),
  priority int not null default 1,
  expires_at timestamptz not null,
  challenged_at timestamptz,
  released_at timestamptz
);
```

**No double-confirm on one date, enforced by index:**

```sql
create unique index holds_one_confirmed_per_date
  on holds (artist_id, event_date)
  where state in ('confirmed','contracted','advance_paid','performed','settled');
```

Auto-release runs from `pg_cron` + an Inngest function, never from a user action. **99.99% reliability required** — a missed release causes a double-booking, which is a reputational event for the manager, not merely a bug.

## 010 — Benchmark index

```sql
create materialized view benchmark_index as
select genre, city, slot_type, crowd_band, season,
       percentile_cont(0.25) within group (order by fee_paise) as p25,
       percentile_cont(0.50) within group (order by fee_paise) as p50,
       percentile_cont(0.75) within group (order by fee_paise) as p75,
       count(*) as sample_n
from settled_bookings_view
group by 1,2,3,4,5
having count(*) >= 5;   -- cells below 5 are never published
```

**Protection rules, enforced in the API not the UI:** never expose raw rows; percentile bands only; minimum `sample_n` 5 so individual deals cannot be reverse-engineered; anomaly review before a fee enters the index.

## Index checklist

Every foreign key indexed. Partial indexes on hot `status`/`state` filters. `ivfflat` on every vector column. Composite `(org_id, created_at desc)` on anything paginated.
