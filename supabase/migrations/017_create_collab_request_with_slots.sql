-- 017 — create_collab_request_with_slots
-- Same atomicity reasoning as migration 007's create_work_with_contributors
-- and migration 006's create_shout_with_slots: inserting a request then
-- slots via two separate calls risks an orphaned request (no slots at all)
-- if the second call fails. security invoker — runs as the caller, so the
-- inserts still pass the RLS policies from migration 014 normally.
create function create_collab_request_with_slots(
  p_org_id uuid,
  p_artist_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_brief_json jsonb,
  p_reference_url text,
  p_city text,
  p_visibility text,
  p_deadline timestamptz,
  p_slots jsonb
) returns uuid
language plpgsql security invoker as $$
declare
  new_request_id uuid;
  s jsonb;
begin
  if p_org_id <> current_org_id() then
    raise exception 'FORBIDDEN';
  end if;
  if jsonb_array_length(p_slots) = 0 then
    raise exception 'VALIDATION_FAILED: a request needs at least one slot';
  end if;
  if jsonb_array_length(p_slots) > 6 then
    raise exception 'VALIDATION_FAILED: a request carries up to six slots (docs/06-COLLABS.md)';
  end if;

  insert into collab_requests (
    org_id, artist_id, kind, title, body, brief_json, reference_url, city,
    visibility, status, deadline
  )
  values (
    p_org_id, p_artist_id, p_kind, p_title, p_body, p_brief_json, p_reference_url, p_city,
    coalesce(p_visibility, 'open'), 'open', p_deadline
  )
  returning id into new_request_id;

  for s in select * from jsonb_array_elements(p_slots) loop
    if not (s ? 'comp_model') then
      raise exception 'VALIDATION_FAILED: comp_model must be explicitly chosen for every slot';
    end if;
    insert into collab_slots (
      request_id, org_id, role, requirements, comp_model, fee_paise,
      writer_pct, master_pct, revisions_included
    )
    values (
      new_request_id, p_org_id, s->>'role', coalesce(s->'requirements', '{}'::jsonb),
      s->>'comp_model',
      (s->>'fee_paise')::bigint,
      (s->>'writer_pct')::numeric(5,2),
      (s->>'master_pct')::numeric(5,2),
      (s->>'revisions_included')::int
    );
  end loop;

  return new_request_id;
end $$;

grant execute on function create_collab_request_with_slots(
  uuid, uuid, text, text, text, jsonb, text, text, text, timestamptz, jsonb
) to authenticated;
