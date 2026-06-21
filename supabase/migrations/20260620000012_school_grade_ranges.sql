-- ============================================================================
-- Placer Robotics Hub — School grade ranges
-- Migration: 20260620000012_school_grade_ranges
--
-- Adds grade_min/grade_max to `school` so the application + registration school
-- dropdowns can narrow to schools that actually serve the student's grade.
-- Filter logic in the app is `grade BETWEEN grade_min AND grade_max`, with NULL
-- treated as open-ended. Grades are integers; Kindergarten = 0.
--
-- DESIGN: ranges err WIDE on purpose. A too-narrow range hides a valid school
-- from a student (forcing a free-text "Other" entry that pollutes the data);
-- a too-wide range merely shows a school for a grade it doesn't serve, which is
-- harmless because the family still picks their actual school. So unverified
-- schools get a generous range; only confident spans are tightened.
--
-- These spans are best-effort and SHOULD BE VERIFIED against local knowledge —
-- re-run this migration after editing any row. Idempotent.
-- ============================================================================

alter table school add column if not exists grade_min integer;
alter table school add column if not exists grade_max integer;

-- Safe baseline by category --------------------------------------------------
update school set grade_min = 9, grade_max = 12 where type = 'high_school';
update school set grade_min = 6, grade_max = 8  where type = 'middle_school';
update school set grade_min = 0, grade_max = 6  where type = 'elementary';   -- covers K-5 and K-6
update school set grade_min = 0, grade_max = 12 where type in ('charter', 'private', 'other');

-- Junior highs are 7–8 -------------------------------------------------------
update school set grade_min = 7, grade_max = 8
  where name in ('Cavitt Jr. High', 'Olympus Junior High School');

-- 7–12 college-prep charter --------------------------------------------------
update school set grade_min = 7, grade_max = 12
  where name = 'Western Sierra Collegiate Academy';

-- K–8 schools (no high grades) — tightened so they don't show for 9–12 -------
update school set grade_min = 0, grade_max = 8
  where name in (
    'Loomis Basin Charter School',
    'California Montessori Project',
    'Maria Montessori Charter Academy',
    'Orangevale Open',
    'Excelsior Elementary',
    'St. Albans Country Day School',
    'Our Lady of the Assumption',
    'St. Francis of Assisi Elementary'
  );

-- K–6 specifics --------------------------------------------------------------
update school set grade_min = 0, grade_max = 6
  where name in ('Rocklin Academy (Turnstone)', 'Rescue Elementary');

-- Everything else keeps its category baseline. Homeschool / Other / independent-
-- study charters (Sutter Peak, South Sutter, Feather River, Cottonwood, John
-- Adams, Rocklin Academy Gateway, Harvest Ridge, NP3, Golden Hills, Sacramento
-- Country Day, Bradshaw Christian) intentionally remain full K–12.
