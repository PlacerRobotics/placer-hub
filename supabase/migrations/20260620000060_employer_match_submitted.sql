-- ============================================================================
-- Placer Robotics Hub — employer-match "submitted" self-report
-- Migration: 20260620000060_employer_match_submitted
--
-- Families choosing corporate_match had no way to tell us they'd actually
-- submitted the matching-gift request in Benevity/YourCause/etc — the only
-- fundraising-progress signal was the admin-only fundraising_received_at
-- (money actually received by PART), which is set well after submission and
-- isn't something a family can self-report. Adds a family-editable date,
-- alongside the existing employer_match_company/pct/portal columns (0034),
-- so admins can see who has acted vs who's still sitting on it, and families
-- have something to actually update once they've submitted their request.
--
-- Family-scoped (not per-student), matching the existing employer_match_*
-- columns — siblings share one employer-match record today, and this
-- shouldn't be the migration that changes that.
-- ============================================================================

alter table family add column if not exists employer_match_submitted_at date;
