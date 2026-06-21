-- ============================================================================
-- Placer Robotics Hub — team_member active-membership uniqueness
-- Migration: 20260620000019_team_member_unique_active
--
-- The registrations "assign team" paths do find-active-row-else-insert with no
-- DB guard, so concurrent assigns (or a stale read) can create duplicate ACTIVE
-- team_member rows. The list/detail reads then error or under-count. These
-- partial unique indexes make a duplicate active membership impossible.
--
-- Two distinct shapes of team_member row:
--   * student rows  — keyed by enrollment_id (guardian_id is NULL)
--   * coach/mentor rows — keyed by guardian_id (enrollment_id is NULL)
-- Because NULLs are distinct in a unique index, ONE index can't cover both;
-- each shape gets its own partial index. All scoped to revoked_at IS NULL so a
-- revoked row never blocks a fresh assignment.
--
-- NOTE: if the table already contains duplicate ACTIVE rows, CREATE UNIQUE INDEX
-- will fail and name the conflict — resolve (revoke the extras) and re-run.
-- Idempotent.
-- ============================================================================

-- One active student membership per enrollment per season.
create unique index if not exists team_member_unique_student_active
  on team_member (enrollment_id, season)
  where revoked_at is null and team_role = 'student' and enrollment_id is not null;

-- One active coach/mentor membership per (team, guardian, season).
create unique index if not exists team_member_unique_coach_active
  on team_member (team_id, guardian_id, season)
  where revoked_at is null and guardian_id is not null;
