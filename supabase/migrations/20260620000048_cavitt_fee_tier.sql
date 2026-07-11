-- ============================================================================
-- Placer Robotics Hub — Cavitt Jr. High V5 fee tier
-- Migration: 20260620000048_cavitt_fee_tier
--
-- Cavitt Jr. High VEX V5 students pay a different (partner) registration fee
-- through a separate Zeffy campaign with the same ticket structure, so the
-- price difference is never shown side-by-side and families can't pick the
-- wrong campaign. Applies ONLY to V5-only registrations whose selected school
-- is fee_tier 'cavitt' — Combat, 'both', and IQ stay on the standard fee and
-- campaign.
--
-- fee_tier is plain text (not an enum) so adding another partner school later
-- is an UPDATE, not a migration. Coupled with: /api/register fee logic,
-- /register wizard + /dashboard payment links, and the Zeffy registration
-- sync (env ZEFFY_CAVITT_CAMPAIGN_ID).
-- ============================================================================

alter table school add column if not exists fee_tier text not null default 'standard';

update school set fee_tier = 'cavitt' where name = 'Cavitt Jr. High';

-- Null = fall back to v5_combat_registration_fee / zeffy_student_url until the
-- Cavitt campaign is set up.
alter table season_config add column if not exists cavitt_v5_registration_fee numeric;
alter table season_config add column if not exists zeffy_cavitt_url text;
