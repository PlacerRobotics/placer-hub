-- ============================================================================
-- Placer Robotics Hub — volunteer step admin-exception flag
-- Migration: 20260620000046_step_status_needs_review
--
-- Adds 'needs_review' to step_status (volunteer_step.status) as the admin-set
-- exception flag — e.g. manual verification required, suspected duplicate
-- volunteer. The volunteer portal renders it as a plain-language "Needs
-- attention" row with a contact path (mirroring the family dashboard's
-- admin-flag treatment); it is never set automatically.
--
-- Existing vocabulary recap (unchanged): 'pending' = volunteer hasn't started,
-- 'in_progress' = submitted / Placer Robotics is processing, 'complete',
-- 'waived'.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot be referenced in the same transaction.
-- This file only adds the value, so it is safe to run as-is; if your SQL editor
-- wraps files in one transaction and errors, run the line on its own.
-- ============================================================================

alter type step_status add value if not exists 'needs_review';
