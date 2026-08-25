-- 037 - Pin search_path on the nine functions where it is free to pin.
--
-- Supabase's security advisor reports function_search_path_mutable on ten
-- public functions. CLAUDE.md already makes `set search_path` mandatory on
-- privileged functions, and migration 020 is the scar: custom_access_token_hook
-- had no search_path, so every token issuance failed with
-- `relation "org_members" does not exist`.
--
-- Two things had to be checked before touching anything, because following
-- the advisor literally would have introduced a worse bug than it fixes.
--
-- 1. create_work_with_contributors calls gen_random_bytes(), and pgcrypto is
--    installed in `extensions`, not `public`. Pinning that function to bare
--    `public` would make every work creation fail at runtime with
--    "function gen_random_bytes(integer) does not exist". It is pinned to
--    `public, extensions` instead. Verified: gen_random_bytes exists only in
--    the extensions schema on this project.
--
-- 2. current_org_id is DELIBERATELY LEFT ALONE. It is `language sql stable`,
--    so Postgres inlines its body into every RLS policy that calls it, which
--    is every policy on every table. A SET clause disables inlining. Measured
--    on this database:
--
--      without SET  ->  One-Time Filter: ((NULLIF(((current_setting(
--                       'request.jwt.claims', true))::json ->> 'org_id'),
--                       ''))::uuid IS NOT NULL)          -- body inlined
--      with SET     ->  One-Time Filter: (f_set() IS NOT NULL)
--                                                        -- opaque call
--
--    Pinning it would turn a folded expression into a real function call
--    evaluated per row on every RLS-filtered query in the product. There is
--    also nothing to harden: its body touches only current_setting, nullif,
--    ->> and casts, all of which live in pg_catalog, which is implicitly
--    searched first and cannot be shadowed by a user schema. The advisor
--    warning is a false positive on this one function.
--
-- Severity of the rest, stated honestly rather than inflated: none of the ten
-- is SECURITY DEFINER, so they run as the caller and cannot escalate. Neither
-- `anon` nor `authenticated` holds CREATE on any schema, so neither can plant
-- a shadowing object in the first place. This is defence in depth against a
-- future grant or a future SECURITY DEFINER, not a live hole.
--
-- Behaviour is unchanged: every one of these nine references only public
-- tables and pg_catalog built-ins, plus the one extensions call noted above.

alter function public.assert_application_artist_owned_by_org() set search_path = public;
alter function public.assert_hold_artist_owned_by_org()        set search_path = public;
alter function public.assert_splits_total()                    set search_path = public;
alter function public.assert_valid_shout_transition()          set search_path = public;
alter function public.assert_valid_slot_transition()           set search_path = public;
alter function public.assert_work_not_locked()                 set search_path = public;
alter function public.confirm_hold(uuid, bigint)               set search_path = public;
alter function public.create_collab_request_with_slots(
  uuid, uuid, text, text, text, jsonb, text, text, text, timestamptz, jsonb
) set search_path = public;

-- pgcrypto lives in `extensions` (see note 1).
alter function public.create_work_with_contributors(uuid, text, jsonb)
  set search_path = public, extensions;
