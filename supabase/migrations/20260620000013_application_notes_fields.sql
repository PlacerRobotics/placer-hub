-- ============================================================================
-- Placer Robotics Hub — Application free-text fields (PRD §5)
-- Migration: 20260620000013_application_notes_fields
--
-- The full PRD §5 application form has two optional free-text fields that had no
-- home in the schema:
--   • Section 5 "Anything else we should know?"  → student_application.additional_notes
--   • Section 4 "Volunteering comments or notes"  → guardian.volunteer_notes
-- (occupation and volunteer_interests[] already exist on guardian.)
--
-- Both are nullable and optional. Idempotent.
-- ============================================================================

alter table student_application add column if not exists additional_notes text;
alter table guardian add column if not exists volunteer_notes text;
