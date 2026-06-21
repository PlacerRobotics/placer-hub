-- ============================================================================
-- Placer Robotics Hub — 'both' program interest
-- Migration: 20260620000017_program_both
--
-- Students may apply interested in V5 AND Combat. Adds 'both' to the
-- program_selection enum so a single student_application can express that
-- (no second application needed). 'both' is an APPLICATION interest only — teams
-- and enrollments remain single-program (vex_v5 / vex_iq / combat).
--
-- Note: ALTER TYPE ... ADD VALUE cannot be referenced in the same transaction it
-- is added in; nothing here uses it. If the SQL editor wraps the file in one
-- transaction and errors, run this line on its own.
-- ============================================================================

alter type program_selection add value if not exists 'both';
