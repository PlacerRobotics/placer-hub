-- ============================================================================
-- Placer Robotics Hub — provisional Combat teams (stopgap for undefined rosters)
-- Migration: 20260620000045_provisional_combat_teams
--
-- Combat's real team list for 2026-27 isn't finalized (docs/KNOWN_ISSUES.md
-- "Combat teams undefined"), which blocks registration for Combat students —
-- there's nothing to assign them to. This adds an `is_provisional` flag on
-- `team` and seeds two placeholder Combat teams (one per division) so admins
-- have an interim landing spot. Family- and coach-facing code must check
-- `is_provisional` and never surface the internal "TBD" name to them (see
-- app code in app/dashboard/page.tsx and app/admin/registrations/[id]/).
--
-- When real Combat rosters exist, re-split team_member rows off these two
-- provisional teams onto the real teams — see the query template at the
-- bottom of this file (do not run it as part of this migration).
--
-- Idempotent.
-- ============================================================================

alter table team add column if not exists is_provisional boolean not null default false;

insert into team (season, program, division, team_name, team_number, school_org, active, is_provisional, notes)
select '2026-27', 'combat', 'MS', 'Combat MS — TBD', null, 'Placer Robotics', true, true,
  'Provisional placeholder — real MS Combat team roster not yet finalized. Re-split team_member rows onto real teams once the roster exists; do not treat this as a real team number.'
where not exists (
  select 1 from team where season = '2026-27' and program = 'combat' and is_provisional and division = 'MS'
);

insert into team (season, program, division, team_name, team_number, school_org, active, is_provisional, notes)
select '2026-27', 'combat', 'HS', 'Combat HS — TBD', null, 'Placer Robotics', true, true,
  'Provisional placeholder — real HS Combat team roster not yet finalized. Re-split team_member rows onto real teams once the roster exists; do not treat this as a real team number.'
where not exists (
  select 1 from team where season = '2026-27' and program = 'combat' and is_provisional and division = 'HS'
);

-- ----------------------------------------------------------------------------
-- FUTURE RE-SPLIT (run manually once real Combat rosters are finalized — not
-- part of this migration). Reassigns team_member rows from a provisional team
-- to a real team by bulk update, preserving id/season/created_at history, so
-- this is a data update, not a re-registration event.
--
-- 1) Create the real team rows first (regular `team` inserts via /admin/teams
--    or SQL), noting their new team.id values.
-- 2) For each student being re-split, update their active team_member row:
--
--   update team_member
--   set team_id = '<real_team_id>'
--   where team_id = '<provisional_team_id>'
--     and student_id = '<student_id>'
--     and season = '2026-27'
--     and team_role = 'student'
--     and revoked_at is null;
--
-- 3) Once every member of a provisional team has been re-split (i.e. no
--    remaining active team_member rows reference it), deactivate it rather
--    than deleting it, so history/audit stay intact:
--
--   update team set active = false where id = '<provisional_team_id>';
--
-- Do this per-student (not a blind bulk UPDATE ... WHERE team_id = provisional)
-- since students typically split across more than one real team.
-- ----------------------------------------------------------------------------
