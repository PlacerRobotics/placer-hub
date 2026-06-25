-- ============================================================================
-- Placer Robotics Hub — Fundraising received indicator (per student)
-- Migration: 20260620000041_fundraising_received
--
-- Tracks whether a student's fundraising commitment has actually been received:
--   - direct Zeffy contributions auto-set it on sync (covering payment),
--   - paper check / Benevity / sponsor are signed off by an admin with the deposit
--     date (Benevity transfer date or check deposit date).
-- ============================================================================

alter table enrollment add column if not exists fundraising_received_at timestamptz;
alter table enrollment add column if not exists fundraising_received_amount numeric(10, 2);
alter table enrollment add column if not exists fundraising_received_note text;
