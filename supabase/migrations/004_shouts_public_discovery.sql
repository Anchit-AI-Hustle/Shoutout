-- 004 — Public discovery read for open Shouts
--
-- Migration 003's shouts_read policy is pure org-tenant isolation
-- (org_id = current_org_id()), which is correct for a poster's own org but
-- doesn't support the public discovery feed docs/05-API.md describes:
--   GET /api/shouts?type=&city=&role=&cursor=   discovery feed
-- A discovery feed has to be readable across orgs by an anon session — that's
-- the whole point of visibility='open'. Per docs/02-ARCHITECTURE.md, the
-- service-role key must never be used in a user-facing route to fake this;
-- RLS stays the actual isolation boundary, so the fix is an additional,
-- narrowly-scoped read policy, not a bypass.

create policy shouts_public_discovery on shouts for select
  using (status = 'open' and visibility = 'open');
