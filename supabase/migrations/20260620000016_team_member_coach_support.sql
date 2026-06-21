-- ============================================================================
-- Placer Robotics Hub — Coach support on team_member
-- Migration: 20260620000016_team_member_coach_support
--
-- Adds a revoke timestamp to team_member (coaches are removed by setting
-- revoked_at, not deleting the row) and extends the team_role enum with the
-- coach role names the admin UI uses.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be referenced in the same transaction it
-- is added in; nothing here uses the new values, so it is safe. If your SQL
-- editor wraps the file in one transaction and errors on ADD VALUE, run the two
-- ADD VALUE lines separately.
-- ============================================================================

alter table team_member add column if not exists revoked_at timestamptz;

alter type team_role add value if not exists 'assistant_coach';
alter type team_role add value if not exists 'mentor';
