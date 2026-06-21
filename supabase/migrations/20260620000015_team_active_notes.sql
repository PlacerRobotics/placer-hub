-- ============================================================================
-- Placer Robotics Hub — Team active flag + notes
-- Migration: 20260620000015_team_active_notes
--
-- Teams have no status workflow — they are simply active or not. Adds an `active`
-- boolean (default true) and a free-text `notes` field. The legacy `status` enum
-- column is left in place but no longer written by the app.
--
-- Idempotent.
-- ============================================================================

alter table team add column if not exists active boolean not null default true;
alter table team add column if not exists notes text;
