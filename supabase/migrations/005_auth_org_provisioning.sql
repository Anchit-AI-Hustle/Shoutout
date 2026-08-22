-- 005 — Auth: org provisioning and the org_id JWT claim
--
-- current_org_id() (migration 001) reads org_id from JWT claims. Nothing
-- before this migration ever puts it there. Two pieces close that gap:
--
-- 1. custom_access_token_hook — a Supabase Auth "Custom Access Token" hook,
--    registered in supabase/config.toml and pushed via `supabase config push`.
--    Injects the caller's org_id into every issued/refreshed JWT. Follows
--    Supabase's own documented pattern exactly: NOT security definer: grant
--    table access to supabase_auth_admin directly, plus an explicit RLS
--    policy, so the hook only ever sees what it's explicitly granted.
--
-- 2. create_org_for_new_user — a chicken-and-egg problem: a brand-new user
--    has no org yet, so the normal RLS-scoped insert (org_id =
--    current_org_id()) can't succeed for their own first org. This is a
--    narrowly-scoped SECURITY DEFINER RPC instead of routing through the
--    service-role key (docs/02-ARCHITECTURE.md forbids that in a user path)
--    — validated against auth.uid(), and refuses to run if the caller
--    already has an org.

grant usage on schema public to supabase_auth_admin;
grant select on table org_members to supabase_auth_admin;

create policy "Allow auth admin to read org_members" on org_members
  as permissive for select to supabase_auth_admin using (true);

create function custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable as $$
declare
  claims jsonb;
  user_org_id uuid;
begin
  select org_id into user_org_id
  from org_members
  where user_id = (event->>'user_id')::uuid
  limit 1;

  claims := event->'claims';

  if user_org_id is not null then
    claims := jsonb_set(claims, '{org_id}', to_jsonb(user_org_id));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end $$;

grant execute on function custom_access_token_hook to supabase_auth_admin;
revoke execute on function custom_access_token_hook from authenticated, anon, public;

create function create_org_for_new_user(org_name text) returns uuid
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

  insert into orgs (type, name) values ('self', org_name) returning id into new_org_id;
  insert into org_members (org_id, user_id, role) values (new_org_id, auth.uid(), 'owner');

  return new_org_id;
end $$;

grant execute on function create_org_for_new_user(text) to authenticated;
