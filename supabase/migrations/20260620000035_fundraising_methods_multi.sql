-- ============================================================================
-- Placer Robotics Hub — Multi-select fundraising methods
-- Migration: 20260620000035_fundraising_methods_multi
--
-- Families can fulfill the fundraising commitment in MORE THAN ONE way at once
-- (e.g. donate part AND have a business sponsor). The single-value
-- family_season.fundraising_method (0009) can't express that, so add an array.
--
-- fundraising_method is KEPT as the "primary" method (derived = first selected in
-- canonical order) for backward-compatible badges/filters; fundraising_methods is
-- the full set the family picked.
-- ============================================================================

alter table family_season
  add column if not exists fundraising_methods text[] not null default '{}';

-- Backfill the array from any existing single selection so resume/admin views are
-- consistent. (Leaves the column default '{}' for rows with no prior choice.)
update family_season
  set fundraising_methods = array[fundraising_method]
  where fundraising_method is not null
    and (fundraising_methods is null or fundraising_methods = '{}');
