-- ============================================================================
-- Placer Robotics Hub — Participation waiver rev 2 (remove COVID-19 section)
-- Migration: 20260620000039_participation_waiver_rev2_no_covid
--
-- Record-keeping policy: a waiver change creates a NEW revision. The old rev is
-- deactivated (NOT deleted) so prior signatures keep referencing the exact version
-- they signed; a new active rev is inserted with the COVID-19 section removed.
-- Each waiver_signature already records waiver_version + body_hash, so signatures
-- remain tied to their rev. body_hash = md5(body) integrity stamp.
-- ============================================================================

update waiver_template set active = false
  where waiver_type = 'student_participation' and version = '2026-27';

insert into waiver_template (waiver_type, version, title, body_markdown, body_hash, effective_date, active)
select waiver_type, '2026-27.2', title,
       regexp_replace(body_markdown, E'COVID-19\n\nI acknowledge the contagious[^\n]+\n\n', ''),
       md5(regexp_replace(body_markdown, E'COVID-19\n\nI acknowledge the contagious[^\n]+\n\n', '')),
       current_date, true
from waiver_template
where waiver_type = 'student_participation' and version = '2026-27'
  and not exists (
    select 1 from waiver_template where waiver_type = 'student_participation' and version = '2026-27.2'
  );
