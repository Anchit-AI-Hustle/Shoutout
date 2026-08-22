-- Fix: custom_access_token_hook could never run, so no one could ever sign in.
--
-- The hook is invoked by GoTrue as the `supabase_auth_admin` role, whose
-- search_path does not include `public`. The function had no `set
-- search_path` of its own and referenced `org_members` unqualified, so
-- every single token issuance failed with:
--
--   ERROR: relation "org_members" does not exist (SQLSTATE 42P01)
--
-- which GoTrue surfaces to the client as the opaque "Error running hook
-- URI: pg-functions://postgres/public/custom_access_token_hook", and to
-- the caller as a 500. This was not specific to a channel: it would have
-- failed phone sign-in identically the moment an SMS provider existed, so
-- it was masked the whole time by the earlier "missing Twilio account SID"
-- failure happening first.
--
-- Pinning search_path is also the correct hardening for any function run
-- by a privileged role — it stops an attacker-controlled search_path from
-- resolving `org_members` to something they created.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  claims jsonb;
  user_org_id uuid;
begin
  select org_id into user_org_id
  from public.org_members
  where user_id = (event->>'user_id')::uuid
  limit 1;

  claims := event->'claims';

  if user_org_id is not null then
    claims := jsonb_set(claims, '{org_id}', to_jsonb(user_org_id));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
