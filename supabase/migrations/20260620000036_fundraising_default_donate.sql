-- ============================================================================
-- Placer Robotics Hub — Default fundraising to "donate", not "Aid"
-- Migration: 20260620000036_fundraising_default_donate
--
-- The fundraising columns defaulted to 'pending' (0009), which the UI shows as
-- "Aid"/financial assistance. Imported and applied families never choose a method
-- until they register, so they all wrongly read as financial aid. Default to
-- direct_donation ("donate") instead, and reset the families that only carry the
-- old default and haven't registered yet. Registered families (who actually chose)
-- are left untouched.
-- ============================================================================

alter table family_season alter column fundraising_method  set default 'direct_donation';
alter table family_season alter column fundraising_methods set default array['direct_donation']::text[];

update family_season
  set fundraising_method  = 'direct_donation',
      fundraising_methods = array['direct_donation']::text[]
  where status <> 'registered'
    and (fundraising_method = 'pending' or fundraising_method is null)
    and (fundraising_methods = array['pending']::text[] or fundraising_methods = '{}'::text[] or fundraising_methods is null);
