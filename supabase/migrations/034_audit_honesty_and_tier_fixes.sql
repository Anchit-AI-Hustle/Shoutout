-- 034 - Fixes from the seven-questions audit.
--
-- 1. Verification must mean something.
--    33 of 45 listed artists carried a Verified badge on seeded placeholder
--    profiles with stock photos. A badge 73% of a fake roster holds is not a
--    trust signal, it is decoration, and it teaches a visitor that nothing
--    on the site can be believed. docs/04-PROFILES.md gates Verified behind
--    PAN or equivalent, which none of these have.
--      update artists set verified = false where listed;
--
-- 2. "Demo Artist" was a visible profile on the browse page. Removed with
--    its roles and media.
--
-- 3. Collabs and the credits registry were gated to Pro (₹4,999/mo).
--    Collabs is the second pillar on the homepage and the feature most
--    likely to seed the network: a producer posting for a vocalist brings
--    the vocalist. Pricing the seeding mechanism above the people who would
--    seed it is backwards in a cold start. Both now start at Basic; paid
--    tiers still differentiate on volume, benchmarks, reliability and
--    roster tools.
--      insert into plan_entitlements (tier, entitlement) values
--        ('basic','collabs'), ('basic','credits_registry'),
--        ('plus','collabs'),  ('plus','credits_registry');

-- ---------------------------------------------------------------------------
-- Recovered 2026-09-13.
--
-- This file held only the header comment above and no SQL at all. The schema
-- it describes was applied straight to the live database and never written
-- down here, so `supabase/migrations` could not rebuild it - nine migrations
-- (029 to 036) were in that state, including the paywall and the whole credit
-- graph. The statements below are the exact SQL that was applied, recovered
-- verbatim from the session transcripts, in application order.
-- ---------------------------------------------------------------------------

-- NOTE: this one is data, not schema - it was applied with execute_sql, not
-- apply_migration. It corrects seeded rows (unsetting Verified on placeholder
-- profiles, removing 'Demo Artist'). On a fresh database with no seed data it
-- is a no-op, which is correct: it is recorded for fidelity, not for effect.

-- 1. Verification must mean something.
--
-- 33 of 45 listed artists carried a Verified badge, on profiles that are
-- seeded placeholders with stock photos. A badge that 73% of a fake roster
-- holds is not a trust signal, it is decoration - and it is the single
-- fastest way to teach a visitor that nothing on the site can be believed.
-- docs/04-PROFILES.md gates Verified behind PAN or equivalent, which none
-- of these have.
update artists set verified = false where listed;

-- 2. "Demo Artist" is the first thing a visitor sees on a browse page.
delete from artist_media  where artist_id in (select id from artists where slug = 'demo-artist');
delete from artist_roles  where artist_id in (select id from artists where slug = 'demo-artist');
delete from artists where slug = 'demo-artist';

-- 3. Collabs and the credits registry were gated to Pro (₹4,999).
--
-- Collabs is the second pillar on the homepage and the feature most likely
-- to seed the network: a producer posting for a vocalist brings the
-- vocalist. Pricing the seeding mechanism above the people who would seed
-- it is backwards in a cold start. Both move down to Basic; the paid tiers
-- still differentiate on volume, benchmarks, reliability and roster tools.
insert into plan_entitlements (tier, entitlement) values
  ('basic','collabs'), ('basic','credits_registry'),
  ('plus','collabs'),  ('plus','credits_registry')
on conflict (tier, entitlement) do nothing;

select
 (select count(*) from artists where listed) as listed,
 (select count(*) from artists where listed and verified) as verified_now,
 (select count(*) from artists where stage_name ilike '%demo%') as demo_named,
 (select string_agg(tier, ', ' order by tier) from plan_entitlements where entitlement='collabs') as collabs_tiers,
 (select count(*) from list_book_combinations()) as seo_pages;
