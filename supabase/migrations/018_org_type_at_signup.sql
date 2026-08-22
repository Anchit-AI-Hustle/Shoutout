-- 018 — Let a new user pick their org type at signup
--
-- create_org_for_new_user (migration 005) hardcoded type = 'self'. The
-- product now needs two real signup paths: artists/managers ('self') and
-- event organisers ('organiser') — docs/03-DATA-MODEL.md's orgs.type check
-- constraint already allows both, this just lets the caller choose instead
-- of always defaulting to 'self'.
--
-- Narrowed to exactly these two values here, not the full six-value check
-- constraint on orgs.type ('manager','agency','self','organiser','venue',
-- 'brand') — the signup UI only offers two choices right now, and this
-- function is the only path a first-time (org-less) user can use to create
-- their own org. A client bug sending an unexpected type should fail
-- loudly here, not silently create a 'brand' or 'venue' org nobody chose.
create or replace function create_org_for_new_user(org_name text, org_type text default 'self')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if exists (select 1 from org_members where user_id = auth.uid()) then
    raise exception 'ORG_ALREADY_EXISTS';
  end if;

  if org_type not in ('self', 'organiser') then
    raise exception 'VALIDATION_FAILED: org_type must be self or organiser';
  end if;

  insert into orgs (type, name) values (org_type, org_name) returning id into new_org_id;
  insert into org_members (org_id, user_id, role) values (new_org_id, auth.uid(), 'owner');

  return new_org_id;
end $$;

grant execute on function create_org_for_new_user(text, text) to authenticated;
