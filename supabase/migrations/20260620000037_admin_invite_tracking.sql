-- ============================================================================
-- Placer Robotics Hub — Admin invite tracking
-- Migration: 20260620000037_admin_invite_tracking
--
-- Record when an admin was last sent a sign-in link, so the admins page can show
-- onboarding status (link sent / signed in / nothing yet). Login status itself is
-- read live from auth.users.last_sign_in_at via the admin API.
-- ============================================================================

alter table admin_profile add column if not exists invite_sent_at timestamptz;
