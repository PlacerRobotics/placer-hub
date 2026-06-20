-- ============================================================================
-- Placer Robotics Hub — Task 2a support migration
-- Migration: 20260620000003_add_jotform_submission_id
--
-- Adds the Google Form / JotForm submission identifier to student_application.
-- Used by scripts/sync_applications.py (Phase 1 sync) to map Col 55 and to
-- dedupe synced applications. Unique so a given form submission maps to at most
-- one application row.
-- ============================================================================
alter table student_application
  add column if not exists jotform_submission_id text unique;
