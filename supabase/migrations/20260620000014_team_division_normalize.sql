-- ============================================================================
-- Placer Robotics Hub — Division vocabulary normalized to ES / MS / HS
-- Migration: 20260620000014_team_division_normalize
--
-- Renames the shared `division` enum values to MS/HS and adds ES (elementary).
-- This enum is used by BOTH team.division and enrollment.division, so the rename
-- applies system-wide; the code that writes/reads division (registration, teams
-- admin, team importer) is updated in the same change.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be used within the same transaction that
-- later references the new value; nothing here uses 'ES' in this migration, so it
-- is safe. Run as-is in the Supabase SQL editor.
-- ============================================================================

ALTER TYPE division RENAME VALUE 'middle' TO 'MS';
ALTER TYPE division RENAME VALUE 'high' TO 'HS';
ALTER TYPE division ADD VALUE IF NOT EXISTS 'ES';
