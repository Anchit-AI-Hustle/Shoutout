-- 007 — Split sheets
-- docs/03-DATA-MODEL.md section 004, docs/09-BUILD-SEQUENCE.md M2.
-- "The lock is the product." A locked work is immutable.

create table works (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  title text not null,
  iswc text, isrc text,
  status text not null default 'draft' check (status in ('draft','locked')),
  locked_at timestamptz,
  created_from_room_id uuid,
  -- Amendments create a new version row, never mutate a locked one
  -- (docs/03-DATA-MODEL.md). Not fully spec'd in the docs beyond that
  -- statement — this column is the minimal mechanism to link a new draft
  -- back to the locked work it amends.
  amended_from uuid references works(id),
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

alter table works enable row level security;
create policy works_read on works for select using (org_id = current_org_id());
create policy works_write on works for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

alter table contributors enable row level security;
create policy contributors_read on contributors for select using (org_id = current_org_id());
create policy contributors_write on contributors for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- The lock invariant, exactly as specified in docs/03-DATA-MODEL.md.
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

-- Beyond the doc's literal SQL: "a locked work is immutable" is stated as a
-- rule but migration 004's SQL in the doc only guards the lock TRANSITION
-- itself, not contributor edits AFTER locking. Without this, "immutable"
-- would just be an API-layer promise — the same category of gap the
-- project's own RLS-over-application-checks philosophy (ADR-002) exists to
-- close. This enforces it at the row level: no insert/update/delete on
-- contributors once their work is locked.
create function assert_work_not_locked() returns trigger
language plpgsql as $$
declare work_status text;
begin
  select status into work_status from works
    where id = coalesce(new.work_id, old.work_id);
  if work_status = 'locked' then
    raise exception 'WORK_LOCKED: contributors are immutable once a work locks';
  end if;
  return coalesce(new, old);
end $$;

create trigger contributors_lock_guard before insert or update or delete on contributors
  for each row execute function assert_work_not_locked();

-- create_work_with_contributors — same atomicity reasoning as migration
-- 006's create_shout_with_slots: inserting a work then contributors via two
-- separate calls risks an orphaned work if the second fails.
create function create_work_with_contributors(
  p_org_id uuid,
  p_title text,
  p_contributors jsonb
) returns uuid
language plpgsql security invoker as $$
declare
  new_work_id uuid;
  c jsonb;
begin
  if p_org_id <> current_org_id() then
    raise exception 'FORBIDDEN';
  end if;

  insert into works (org_id, title) values (p_org_id, p_title) returning id into new_work_id;

  for c in select * from jsonb_array_elements(p_contributors) loop
    insert into contributors (
      work_id, org_id, name, phone, role, writer_pct, master_pct, work_for_hire,
      pro_affiliation, signature_ref
    )
    values (
      new_work_id,
      p_org_id,
      c->>'name',
      c->>'phone',
      c->>'role',
      coalesce((c->>'writer_pct')::numeric(5,2), 0),
      coalesce((c->>'master_pct')::numeric(5,2), 0),
      coalesce((c->>'work_for_hire')::boolean, false),
      c->>'pro_affiliation',
      encode(gen_random_bytes(16), 'hex')
    );
  end loop;

  return new_work_id;
end $$;

grant execute on function create_work_with_contributors(uuid, text, jsonb) to authenticated;

-- Public share page (docs/05-API.md: "GET /api/w/:id PUBLIC read-only share
-- page data"). works/contributors only have org-scoped RLS — a blanket
-- public-read RLS policy would let the anon key list/enumerate every work
-- in the database, not just fetch one by a known (unguessable) id. These
-- SECURITY DEFINER functions require the exact id as a parameter instead —
-- functionally a share link, not an open table scan. Same reasoning as
-- migration 005's create_org_for_new_user: a narrow, audited exception
-- rather than reaching for the service-role key in a user path.
--
-- Contributor phone numbers and signature_ref are deliberately NOT exposed
-- here — the public page shows the split sheet, not other contributors' PII
-- or their private signing links.
create function get_work_public(p_work_id uuid)
returns table (
  id uuid, title text, status text, locked_at timestamptz, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select id, title, status, locked_at, created_at from works where id = p_work_id;
$$;

create function get_work_contributors_public(p_work_id uuid)
returns table (
  id uuid, name text, role text, writer_pct numeric, master_pct numeric, signed boolean
)
language sql security definer set search_path = public stable as $$
  select id, name, role, writer_pct, master_pct, (signed_at is not null) as signed
  from contributors where work_id = p_work_id;
$$;

grant execute on function get_work_public(uuid) to anon, authenticated;
grant execute on function get_work_contributors_public(uuid) to anon, authenticated;

-- Signing — reduced scope, flagged honestly: docs/05-API.md specifies
-- "POST /api/works/:id/sign { token, otp }" implying WhatsApp-dispatched
-- OTP verification. WhatsApp BSP isn't configured (external account
-- dependency, same category as the SMS provider blocking phone-OTP auth).
-- This implements possession-of-link signing instead: each contributor's
-- signature_ref (generated above) is their unique signing token, sent
-- however the org actually reaches them until WhatsApp dispatch exists.
-- Real OTP-over-WhatsApp verification is a stated follow-up, not silently
-- downgraded without a comment.
create function sign_as_contributor(p_contributor_id uuid, p_signature_ref text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  work_status text;
begin
  select w.status into work_status
  from contributors c join works w on w.id = c.work_id
  where c.id = p_contributor_id and c.signature_ref = p_signature_ref;

  if work_status is null then
    raise exception 'NOT_FOUND';
  end if;
  if work_status = 'locked' then
    raise exception 'WORK_LOCKED';
  end if;

  update contributors set signed_at = now()
  where id = p_contributor_id and signature_ref = p_signature_ref and signed_at is null;

  return found;
end $$;

grant execute on function sign_as_contributor(uuid, text) to anon, authenticated;
