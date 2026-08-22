-- 008 — Retire the polymorphic Shout object
--
-- The fifth-draft architecture (ADR-001: "Polymorphic Shout over per-type
-- tables") is superseded by the seventh draft's ADR-001, which explicitly
-- rejects it: "An earlier draft modelled everything as one polymorphic
-- 'request' object. Rejected: it optimised for schema elegance over product
-- clarity." ShoutOut is the brand name, not a data model — the product is
-- eight modules (Profiles, Gigs, Collabs, Studio, Stage, Payments,
-- Promotion, Credits) on shared services, not typed slots on one table.
--
-- Drops shouts, shout_slots, answers and everything built against them
-- (migrations 003, 004, 006 in this repo's numbering). Verified before
-- writing this: only one demo row existed in `shouts`, nothing in
-- `shout_slots` or `answers` — no real data lost.
--
-- artists is NOT dropped — it's still needed (Profiles module, migration
-- 002 in the new doc's numbering, not yet built) and the RLS-provisioning
-- pieces (custom_access_token_hook, create_org_for_new_user) from migration
-- 005 are untouched — auth has no product-shape coupling.

drop function if exists create_shout_with_slots(uuid, text, text, text, text, timestamptz, text, jsonb, jsonb);
drop table if exists answers;
drop table if exists shout_slots;
drop table if exists shouts;
