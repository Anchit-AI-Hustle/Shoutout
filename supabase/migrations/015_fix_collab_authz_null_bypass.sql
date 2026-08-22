-- 015 — Fix a real authorisation bypass in migration 014
--
-- poster_update_application and accept_application are SECURITY DEFINER
-- (they bypass RLS by design — a poster must be able to update an
-- applicant's row, which lives in a different org). Their only protection
-- was `if v_request_org <> current_org_id() then raise FORBIDDEN`.
--
-- Postgres: NULL <> anything is NULL, and `IF NULL THEN ... END IF` is
-- treated as false — the branch is skipped. An unauthenticated caller
-- (the anon role, or any authenticated session with no active org) has
-- current_org_id() = NULL. The comparison above evaluated to NULL, the
-- FORBIDDEN branch never ran, and the function proceeded to mutate
-- applications/collab_slots/collab_requests and write into Credits'
-- works/contributors with zero authorisation. Confirmed live before this
-- fix: `SET LOCAL ROLE anon; SELECT (some_uuid <> current_org_id()) IS
-- NULL` returns true.
--
-- Fixed the same way migration 012's holds_artist_org_guard already did it
-- correctly — `IS DISTINCT FROM` treats NULL as a real, comparable value
-- (NULL IS DISTINCT FROM 'x' is TRUE), so an unauthenticated caller now
-- hits FORBIDDEN like anyone else without a matching org. EXECUTE is also
-- now explicitly revoked from anon — belt and suspenders, since Postgres
-- grants EXECUTE to PUBLIC by default on function creation regardless of
-- which roles are explicitly granted it, which is what let anon in despite
-- migration 014 only ever granting to `authenticated`.

create or replace function poster_update_application(
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
  if v_request_org is distinct from current_org_id() then raise exception 'FORBIDDEN'; end if;
  if p_status = 'declined' and (p_decline_reason is null or length(trim(p_decline_reason)) = 0) then
    raise exception 'VALIDATION_FAILED: a decline reason is required';
  end if;

  update applications set status = p_status, decline_reason = p_decline_reason, updated_at = now()
  where id = p_application_id
  returning * into v_result;

  return v_result;
end $$;

revoke execute on function poster_update_application(uuid, text, text) from public, anon;
grant execute on function poster_update_application(uuid, text, text) to authenticated;

create or replace function accept_application(p_application_id uuid)
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
  if v_poster_org is distinct from current_org_id() then raise exception 'FORBIDDEN'; end if;

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

revoke execute on function accept_application(uuid) from public, anon;
grant execute on function accept_application(uuid) to authenticated;
