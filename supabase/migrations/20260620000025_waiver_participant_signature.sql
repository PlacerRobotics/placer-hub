-- ============================================================================
-- Placer Robotics Hub — participant (student) signature on waivers
-- Migration: 20260620000025_waiver_participant_signature
--
-- Each waiver is acknowledged by BOTH the participant (student) and a parent/
-- legal guardian. waiver_signature already records the guardian's printed name
-- in typed_name; this adds participant_typed_name for the student's printed name
-- on the same signature row. Nullable (older rows / adult participants may have
-- only the guardian signature). Idempotent.
-- ============================================================================

alter table waiver_signature add column if not exists participant_typed_name text;
