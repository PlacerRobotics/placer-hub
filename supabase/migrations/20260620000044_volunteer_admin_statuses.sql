-- ============================================================================
-- Placer Robotics Hub — volunteer admin statuses
-- Migration: 20260620000044_volunteer_admin_statuses
--
-- Adds admin-only lifecycle states to volunteer_status so the volunteers dashboard
-- can show clear buckets: Denied and Deactivated (both set by the volunteer admin).
-- The dashboard derives Cleared / Renewal Pending / In Progress from clearance data.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot be used in the same transaction where the
-- value is referenced. These statements only add the values, so they are safe; if
-- your SQL editor wraps the file in one transaction, run each line on its own.
-- ============================================================================

alter type volunteer_status add value if not exists 'denied';
alter type volunteer_status add value if not exists 'deactivated';
