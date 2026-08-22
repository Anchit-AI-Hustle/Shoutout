-- 009 — Align Credits (works/contributors) to the seventh-draft spec
--
-- Migration 007 built Credits against the fifth draft. The seventh draft's
-- 03-DATA-MODEL.md section 003 is close but not identical:
--   - status gets a third value: draft -> sent -> locked (was draft/locked
--     only). 11-CREDITS.md: "sent — signature requests dispatched over
--     WhatsApp, still editable by the owner." The existing
--     assert_work_not_locked trigger (migration 007) already only blocks
--     writes when status='locked' specifically, so contributors stay
--     editable during 'sent' with no trigger change needed here.
--   - works gains room_id (a Collab work is auto-drafted from a Room —
--     06-COLLABS.md — not yet built, so no FK target exists yet; added as
--     a plain uuid per the doc's own SQL, which doesn't give it an FK
--     either).
--   - contributors gains artist_id, linking a contributor to a registered
--     artist when one exists (Profiles module, not yet built either).
--   - The lock trigger's WHEN clause narrows to "and old.status <> 'locked'"
--     — the seventh draft's refinement over the fifth draft's version,
--     skipping re-validation on a no-op update that leaves status locked.
--
-- amended_from (added in 007, for "amendments create a new version, never
-- mutate the original" — stated in both drafts with no mechanism given
-- either time) is kept; it doesn't conflict with anything here.

alter table works drop constraint works_status_check;
alter table works add constraint works_status_check
  check (status in ('draft','sent','locked'));
alter table works add column room_id uuid;

alter table contributors add column artist_id uuid references artists(id);

drop trigger works_lock_guard on works;
create trigger works_lock_guard before update on works
  for each row when (new.status = 'locked' and old.status <> 'locked')
  execute function assert_splits_total();
