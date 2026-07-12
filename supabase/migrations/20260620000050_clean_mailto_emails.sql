-- ============================================================================
-- Placer Robotics Hub — clean up mailto:-prefixed email data
-- Migration: 20260620000050_clean_mailto_emails
--
-- Incident (2026-07-11): an IQ coach pasted parent contact info from her email
-- client into the roster-add form and it landed as "mailto:name@ex.com" —
-- browsers can include the mailto: scheme when copied text originates from a
-- mailto hyperlink rather than plain text. Every guardian lookup/creation path
-- matches on the (cleaned) email, so a corrupted value silently failed to find
-- the real parent's account and created a second, unreachable family record
-- instead — the real parent never got invited for that student, and the
-- duplicate can never sign in (its login_email isn't a deliverable address).
--
-- The application-level fix (lib/email-input.ts cleanEmail(), applied at every
-- email-ingestion route) ships alongside this migration and stops new bad data
-- from landing. This migration cleans up what's already there.
--
-- `login_email` and `primary_email` are UNIQUE — stripping the prefix on a
-- duplicate-family row can collide with the real account that already exists
-- under the clean email. Those two updates use a NOT EXISTS collision guard
-- and skip (rather than fail) any row that would collide; the final SELECT
-- lists exactly what was skipped so an admin can manually review/merge those
-- specific families (merging is a data decision, not something to automate
-- here — enrollments/students/payments all reference family_id).
--
-- communication_email / slack_email / fusion_education_email / secondary_email
-- have no uniqueness constraint, so those are cleaned unconditionally.
--
-- Idempotent (WHERE clauses only match rows still carrying the mailto: prefix).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- guardian.login_email (unique) — safe cases only.
-- ---------------------------------------------------------------------------
update guardian g
set login_email = regexp_replace(lower(trim(g.login_email)), '^mailto:', '')
where g.login_email ilike 'mailto:%'
  and not exists (
    select 1 from guardian g2
    where g2.id <> g.id
      and lower(g2.login_email) = regexp_replace(lower(trim(g.login_email)), '^mailto:', '')
  );

-- ---------------------------------------------------------------------------
-- guardian.communication_email / slack_email — no uniqueness constraint.
-- ---------------------------------------------------------------------------
update guardian
set communication_email = regexp_replace(lower(trim(communication_email)), '^mailto:', '')
where communication_email ilike 'mailto:%';

update guardian
set slack_email = regexp_replace(lower(trim(slack_email)), '^mailto:', '')
where slack_email ilike 'mailto:%';

-- ---------------------------------------------------------------------------
-- family.primary_email (unique) — safe cases only.
-- ---------------------------------------------------------------------------
update family f
set primary_email = regexp_replace(lower(trim(f.primary_email)), '^mailto:', '')
where f.primary_email ilike 'mailto:%'
  and not exists (
    select 1 from family f2
    where f2.id <> f.id
      and lower(f2.primary_email) = regexp_replace(lower(trim(f.primary_email)), '^mailto:', '')
  );

update family
set secondary_email = regexp_replace(lower(trim(secondary_email)), '^mailto:', '')
where secondary_email ilike 'mailto:%';

-- ---------------------------------------------------------------------------
-- student.communication_email / slack_email / fusion_education_email —
-- no uniqueness constraint.
-- ---------------------------------------------------------------------------
update student
set communication_email = regexp_replace(lower(trim(communication_email)), '^mailto:', '')
where communication_email ilike 'mailto:%';

update student
set slack_email = regexp_replace(lower(trim(slack_email)), '^mailto:', '')
where slack_email ilike 'mailto:%';

update student
set fusion_education_email = regexp_replace(lower(trim(fusion_education_email)), '^mailto:', '')
where fusion_education_email ilike 'mailto:%';

-- ---------------------------------------------------------------------------
-- Review queue: anything still mailto:-prefixed after the updates above is a
-- collision that was skipped (a clean duplicate already exists under the
-- corrected email) — needs a manual admin decision, not an automated merge.
-- Run this on its own after the migration to check for remaining rows:
-- ---------------------------------------------------------------------------
select 'guardian.login_email' as source, id, login_email as dirty_value from guardian where login_email ilike 'mailto:%'
union all
select 'family.primary_email', id, primary_email from family where primary_email ilike 'mailto:%';
