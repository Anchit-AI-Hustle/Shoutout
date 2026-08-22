-- 010 — Drop the duplicate room column
--
-- Migration 007 (fifth-draft Credits) created created_from_room_id.
-- Migration 009 (seventh-draft alignment) added room_id per the new spec's
-- exact column name, without noticing the old one already served the same
-- purpose. One column, not two.

alter table works drop column created_from_room_id;
