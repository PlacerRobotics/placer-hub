-- ============================================================================
-- Placer Robotics Hub — Per-student fundraising
-- Migration: 20260620000040_fundraising_per_student
--
-- Fundraising is PER STUDENT (each enrolled student carries their own ~$550
-- commitment and can fulfill it differently). It was family-level on family_season;
-- move the method to the enrollment, and tie sponsorship interest to a student.
-- family_season.fundraising_methods is kept as a family-level union for admin views.
-- ============================================================================

alter table enrollment add column if not exists fundraising_methods text[] not null default '{}';
alter table family_sponsor_interest add column if not exists student_id uuid references student(id);

-- Backfill each registered student's enrollment from the old family-level value.
update enrollment e
  set fundraising_methods = fs.fundraising_methods
  from family_season fs
  where fs.family_id = e.family_id and fs.season = e.season
    and (e.fundraising_methods is null or e.fundraising_methods = '{}')
    and fs.fundraising_methods is not null and fs.fundraising_methods <> '{}';
