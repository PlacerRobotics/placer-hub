-- ============================================================================
-- Placer Robotics Hub — School grade ranges
-- Migration: 20260620000012_school_grade_ranges
--
-- Adds grade_min/grade_max to `school` so the application + registration school
-- dropdowns can narrow to schools that actually serve the student's grade.
-- Filter logic in the app is `grade BETWEEN grade_min AND grade_max`, with NULL
-- treated as open-ended (always shown), so a NULL range never hides a school.
--
-- Strategy: set tight ranges for grade-bound public schools (high/middle/
-- elementary), and WIDE ranges for schools that genuinely span grades (charters,
-- private, homeschool/other) so they are never wrongly hidden. A few specific
-- overrides encode known spans (e.g. Western Sierra Collegiate Academy = 7–12).
--
-- Grades use integers; Kindergarten = 0. The forms currently only offer 6–12,
-- but ranges are stored on the full K–12 scale so they stay correct if the grade
-- options expand later.
--
-- NOTE: these ranges are best-effort. Public high/middle/elementary are reliable;
-- charter/private/other default to the full K–12 span on purpose (inclusive, not
-- precise) — tighten any you know exactly via the admin or a follow-up update.
--
-- Idempotent: columns use IF NOT EXISTS; updates are deterministic and re-runnable.
-- ============================================================================

alter table school add column if not exists grade_min integer;
alter table school add column if not exists grade_max integer;

-- Baseline by category --------------------------------------------------------
update school set grade_min = 9,  grade_max = 12 where type = 'high_school';
update school set grade_min = 6,  grade_max = 8  where type = 'middle_school';
update school set grade_min = 0,  grade_max = 6  where type = 'elementary';
-- Span-schools: inclusive full K–12 range so they appear for every grade.
update school set grade_min = 0,  grade_max = 12 where type in ('charter', 'private', 'other');

-- Precision overrides ---------------------------------------------------------
-- Junior highs are 7–8, not 6–8.
update school set grade_min = 7, grade_max = 8
  where name ilike '%jr. high%' or name ilike '%junior high%';

-- Western Sierra Collegiate Academy (charter) is a 7–12 school.
update school set grade_min = 7, grade_max = 12
  where name = 'Western Sierra Collegiate Academy';

-- Homeschool / generic "Other" must match any grade.
update school set grade_min = 0, grade_max = 12
  where name in ('Homeschool', 'Other');
