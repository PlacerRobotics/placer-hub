-- ============================================================================
-- Placer Robotics Hub — Family (household) address
-- Migration: 20260620000038_family_address
--
-- Address was only stored per-student (student.city/zip NOT NULL) and per-guardian.
-- Add a household address on the family so the imported registration address is
-- captured at the family level by default.
-- ============================================================================

alter table family add column if not exists street_address text;
alter table family add column if not exists city text;
alter table family add column if not exists state text;
alter table family add column if not exists zip_code text;
