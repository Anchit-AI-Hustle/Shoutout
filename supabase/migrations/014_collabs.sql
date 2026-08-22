-- 014 — Collabs
-- docs/03-DATA-MODEL.md §006, docs/06-COLLABS.md, docs/12-API.md §Collabs.
-- "One request carries up to six slots. Each fills independently... A
-- request can be half-closed." "On signature it writes straight into
-- Credits — no data entry, ever": accept_application below is that write,
-- reusing migration 007's works/contributors rather than duplicating them.

create table collab_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  artist_id uuid not null references artists(id),
  kind text not null
    check (kind in ('track','band','crew','engineer','visual','mentor','session')),
  title text not null,
  body text,
  brief_json jsonb, -- MUSIC_BRIEF: bpm, key, mood, languages (docs/06-COLLABS.md)
  reference_url text,
  city text, -- relevant for crew/session kinds; not in the doc's literal SQL, added for GET /api/collabs?city=
  visibility text not null default 'open'
    check (visibility in ('open','invite','roster','verified')),
  status text not null default 'open'
    check (status in ('draft','open','partially_filled','filled','closed','expired')),
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INDEPENDENT slots (docs/06-COLLABS.md's defining feature): "A request can
-- need a songwriter AND a vocalist on completely different terms, closed
-- separately." comp_model has no default — "must be explicitly chosen.
-- Never default to it."
create table collab_slots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references collab_requests(id) on delete cascade,
  org_id uuid not null references orgs(id),
  role text not null,
  requirements jsonb not null default '{}',
  comp_model text not null check (comp_model in ('fee','points','hybrid','credit')),
  fee_paise bigint,
  writer_pct numeric(5,2),
  master_pct numeric(5,2),
  revisions_included int,
  status text not null default 'open'
    check (status in ('open','applied','shortlisted','accepted','delivered','settled',
                      'withdrawn','expired')),
  filled_by uuid references artists(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Not detailed in the doc's literal SQL (only listed in the migration-order
-- table's "Creates" column) — applications, rooms, room_versions below are
-- shaped from docs/06-COLLABS.md's prose and docs/12-API.md's endpoint list.
--
-- org_id here is the APPLICANT's org, not the poster's — an application is
-- something an artist's org creates. That makes visibility genuinely
-- two-sided (the poster must be able to see applications to their own
-- slots, which live in a different org) — see applications_read below,
-- the first RLS policy in this project that isn't a single-org check.
create table applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  slot_id uuid not null references collab_slots(id) on delete cascade,
  artist_id uuid not null references artists(id),
  pitch text,
  demo_url text,
  status text not null default 'applied'
    check (status in ('applied','shortlisted','accepted','declined','withdrawn')),
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, artist_id)
);

-- Opens automatically when a slot is accepted (docs/06-COLLABS.md), one per
-- request (not per slot) — the Room holds the whole collab's context, and
-- multiple accepted slots on one request share it. org_id is the poster's
-- org; every accepted collaborator's org also gets read/write access via
-- the multi-party policies below, not via org_id.
create table rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  request_id uuid not null references collab_requests(id),
  work_id uuid references works(id), -- the auto-drafted split sheet (migration 007)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

-- "Every upload is versioned and immutable" — no update/delete policy
-- exists for this table at all, only insert + select.
create table room_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  room_id uuid not null references rooms(id) on delete cascade,
  file_key text not null,
  note text,
  version int not null,
  uploaded_by_artist_id uuid references artists(id),
  created_at timestamptz not null default now(),
  unique (room_id, version)
);

alter table collab_requests enable row level security;
create policy collab_requests_read  on collab_requests for select using (org_id = current_org_id());
create policy collab_requests_write on collab_requests for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table collab_slots enable row level security;
create policy collab_slots_read  on collab_slots for select using (org_id = current_org_id());
create policy collab_slots_write on collab_slots for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Two-sided by design: an org can see its OWN applications (it applied),
-- or applications TO its own posted slots (it's the poster). Write access
-- stays single-sided — only the applicant's org can INSERT/UPDATE its own
-- application row directly (e.g. withdraw). The poster's actions
-- (shortlist/accept/decline) go through poster_update_application below,
-- a narrow SECURITY DEFINER exception with its own inline authorisation
-- check — the same "audited exception, not a bypass" idiom as migration
-- 012's create_public_brief, applied here to a same-session (not
-- anonymous) cross-org write instead of a public one.
alter table applications enable row level security;
create policy applications_read on applications for select using (
  org_id = current_org_id()
  or exists (
    select 1 from collab_slots s
    join collab_requests r on r.id = s.request_id
    where s.id = applications.slot_id and r.org_id = current_org_id()
  )
);
create policy applications_write on applications for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table rooms enable row level security;
create policy rooms_read on rooms for select using (
  org_id = current_org_id()
  or exists (
    select 1 from applications a
    join collab_slots s on s.id = a.slot_id
    where s.request_id = rooms.request_id
      and a.status = 'accepted'
      and a.org_id = current_org_id()
  )
);
create policy rooms_write on rooms for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table room_versions enable row level security;
create policy room_versions_read on room_versions for select using (
  org_id = current_org_id()
  or exists (
    select 1 from rooms rm where rm.id = room_versions.room_id and (
      rm.org_id = current_org_id()
      or exists (
        select 1 from applications a join collab_slots s on s.id = a.slot_id
        where s.request_id = rm.request_id and a.status = 'accepted'
          and a.org_id = current_org_id()
      )
    )
  )
);
-- insert-only — no update/delete policy, matching "immutable, full history."
create policy room_versions_insert on room_versions for insert with check (
  org_id = current_org_id()
  and exists (
    select 1 from rooms rm where rm.id = room_versions.room_id and (
      rm.org_id = current_org_id()
      or exists (
        select 1 from applications a join collab_slots s on s.id = a.slot_id
        where s.request_id = rm.request_id and a.status = 'accepted'
          and a.org_id = current_org_id()
      )
    )
  )
);

-- Defence in depth, same reasoning as migration 012's holds_artist_org_guard:
-- without this, an org could apply as an artist_id it doesn't own, as long
-- as it wrote its own org_id on the application row.
create function assert_application_artist_owned_by_org() returns trigger
language plpgsql as $$
declare artist_org uuid;
begin
  select org_id into artist_org from artists where id = new.artist_id;
  if artist_org is distinct from new.org_id then
    raise exception 'FORBIDDEN: artist does not belong to this org';
  end if;
  return new;
end $$;

create trigger applications_artist_org_guard before insert or update on applications
  for each row execute function assert_application_artist_owned_by_org();

-- poster_update_application — shortlist/decline (docs/12-API.md:
-- "POST /api/collabs/applications/:id/shortlist",
-- "POST /api/collabs/applications/:id/decline { reason } reason required").
-- accept is its own function below — it does substantially more (opens a
-- Room, drafts the split sheet), not a status flip.
create function poster_update_application(
  p_application_id uuid,
  p_status text,
  p_decline_reason text default null
) returns applications
language plpgsql security definer set search_path = public as $$
declare
  v_request_org uuid;
  v_result applications;
begin
  if p_status not in ('shortlisted', 'declined') then
    raise exception 'VALIDATION_FAILED: poster_update_application only handles shortlisted/declined';
  end if;

  select r.org_id into v_request_org
  from applications a
  join collab_slots s on s.id = a.slot_id
  join collab_requests r on r.id = s.request_id
  where a.id = p_application_id;

  if v_request_org is null then raise exception 'NOT_FOUND: application not found'; end if;
  if v_request_org <> current_org_id() then raise exception 'FORBIDDEN'; end if;
  if p_status = 'declined' and (p_decline_reason is null or length(trim(p_decline_reason)) = 0) then
    raise exception 'VALIDATION_FAILED: a decline reason is required';
  end if;

  update applications set status = p_status, decline_reason = p_decline_reason, updated_at = now()
  where id = p_application_id
  returning * into v_result;

  return v_result;
end $$;

grant execute on function poster_update_application(uuid, text, text) to authenticated;

-- accept_application — "opens a Room, drafts the split sheet" (docs/06-COLLABS.md).
-- The first accepted slot on a request creates the work + room; later
-- accepted slots on the same request add another contributor to the same
-- work. Contributor phone is resolved from the artist's own org's members
-- (auth.users.phone) since Profiles doesn't capture a phone directly on
-- artists — a real gap, flagged: if that lookup finds nothing, phone falls
-- back to '' rather than failing the whole accept, since contributors.phone
-- is NOT NULL (migration 007) and this is metadata, not the security
-- boundary — the split percentages and signature flow are unaffected.
create function accept_application(p_application_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_poster_org uuid;
  v_request_id uuid;
  v_slot_id uuid;
  v_artist_id uuid;
  v_role text;
  v_writer_pct numeric;
  v_master_pct numeric;
  v_room_id uuid;
  v_work_id uuid;
  v_artist_name text;
  v_phone text;
  v_title text;
  v_open_remaining int;
begin
  select a.slot_id, a.artist_id, s.request_id, r.org_id, s.role, s.writer_pct, s.master_pct, r.title
  into v_slot_id, v_artist_id, v_request_id, v_poster_org, v_role, v_writer_pct, v_master_pct, v_title
  from applications a
  join collab_slots s on s.id = a.slot_id
  join collab_requests r on r.id = s.request_id
  where a.id = p_application_id;

  if v_poster_org is null then raise exception 'NOT_FOUND: application not found'; end if;
  if v_poster_org <> current_org_id() then raise exception 'FORBIDDEN'; end if;

  update applications set status = 'accepted', updated_at = now() where id = p_application_id;
  update collab_slots set status = 'accepted', filled_by = v_artist_id, updated_at = now()
  where id = v_slot_id;

  select id, work_id into v_room_id, v_work_id from rooms where request_id = v_request_id;

  if v_room_id is null then
    insert into works (org_id, title, status) values (v_poster_org, v_title, 'draft')
    returning id into v_work_id;

    insert into rooms (org_id, request_id, work_id) values (v_poster_org, v_request_id, v_work_id)
    returning id into v_room_id;

    update works set room_id = v_room_id where id = v_work_id;
  end if;

  select stage_name into v_artist_name from artists where id = v_artist_id;
  select au.phone into v_phone
  from artists a2
  join org_members om on om.org_id = a2.org_id
  join auth.users au on au.id = om.user_id
  where a2.id = v_artist_id and au.phone is not null
  limit 1;

  insert into contributors (
    work_id, org_id, artist_id, name, phone, role, writer_pct, master_pct,
    work_for_hire, signature_ref
  )
  values (
    v_work_id, v_poster_org, v_artist_id, coalesce(v_artist_name, 'Collaborator'),
    coalesce(v_phone, ''), v_role, coalesce(v_writer_pct, 0), coalesce(v_master_pct, 0),
    false, encode(gen_random_bytes(16), 'hex')
  );

  select count(*) into v_open_remaining from collab_slots
  where request_id = v_request_id and status = 'open';

  update collab_requests
  set status = case when v_open_remaining = 0 then 'filled' else 'partially_filled' end,
      updated_at = now()
  where id = v_request_id;

  return jsonb_build_object('roomId', v_room_id, 'workId', v_work_id, 'slotId', v_slot_id);
end $$;

grant execute on function accept_application(uuid) to authenticated;
