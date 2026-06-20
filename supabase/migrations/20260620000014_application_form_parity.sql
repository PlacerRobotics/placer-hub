-- ============================================================================
-- Placer Robotics Hub — Application form parity with the live Google Form
-- Migration: 20260620000014_application_form_parity
--
-- The canonical Google Form ("Placer Robotics – 2026–27 Application") asks a few
-- questions that had no column on student_application. Date of birth, student
-- phone, and student email already exist on `student` (birthdate, phone,
-- communication_email); these are the remaining gaps:
--
--   • Which programs are you interested in?  → program_interests (text[], multi-select).
--       program_interest (single enum) is still derived for the pipeline.
--   • Why do you want to join Placer Robotics?        → motivation_why_join
--   • Why do you want to be on a competitive team?    → motivation_why_competitive
--   • Commitment level / hours per week on robotics   → commitment_level
--   • Hours/week on other activities                  → extracurricular_hours
--
-- All nullable. Idempotent.
-- ============================================================================

alter table student_application add column if not exists program_interests text[] not null default '{}';
alter table student_application add column if not exists motivation_why_join text;
alter table student_application add column if not exists motivation_why_competitive text;
alter table student_application add column if not exists commitment_level text;
alter table student_application add column if not exists extracurricular_hours text;
