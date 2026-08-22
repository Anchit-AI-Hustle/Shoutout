-- 006 — create_shout_with_slots RPC
--
-- POST /api/shouts (docs/05-API.md) inserts a shout and its slots together.
-- Two separate PostgREST calls (insert shout, then insert slots) aren't
-- atomic — a failure on the second leaves an orphaned shout with no slots.
-- This wraps both inserts in one transaction, security invoker (runs under
-- the calling user's own RLS-scoped permissions, not elevated) — the
-- explicit org_id check below is defense in depth on top of what the
-- shouts_write / shout_slots_write RLS policies already enforce (ADR-002).

create function create_shout_with_slots(
  p_org_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_city text,
  p_deadline timestamptz,
  p_visibility text,
  p_intent jsonb,
  p_slots jsonb
) returns uuid
language plpgsql security invoker as $$
declare
  new_shout_id uuid;
  slot jsonb;
begin
  if p_org_id <> current_org_id() then
    raise exception 'FORBIDDEN';
  end if;

  insert into shouts (org_id, type, title, body, city, deadline, visibility, intent, created_by)
  values (p_org_id, p_type, p_title, p_body, p_city, p_deadline, p_visibility, p_intent, auth.uid())
  returning id into new_shout_id;

  for slot in select * from jsonb_array_elements(p_slots) loop
    insert into shout_slots (
      shout_id, org_id, role, attributes, comp_model, fee_paise, writer_pct, master_pct, deadline
    )
    values (
      new_shout_id,
      p_org_id,
      slot->>'role',
      coalesce(slot->'attributes', '{}'::jsonb),
      slot->>'comp_model',
      (slot->>'fee_paise')::bigint,
      (slot->>'writer_pct')::numeric(5,2),
      (slot->>'master_pct')::numeric(5,2),
      (slot->>'deadline')::timestamptz
    );
  end loop;

  return new_shout_id;
end $$;

grant execute on function create_shout_with_slots(
  uuid, text, text, text, text, timestamptz, text, jsonb, jsonb
) to authenticated;
