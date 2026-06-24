-- ============================================================================
-- Placer Robotics Hub — Registration payment & fundraising
-- Migration: 20260620000034_registration_fundraising
--
-- Backs the registration-wizard "Payment & Fundraising" step:
--   1. family employer-match columns (the wizard captures these; the dashboard +
--      admin registrations view read them back).
--   2. family_sponsor_interest — family-submitted sponsorship interest captured at
--      registration. NOTE: the existing sponsor_commitment table is the admin
--      sponsor CRM (keyed to a sponsor entity via sponsor_id, with tier/amount),
--      so it can't hold a family-level interest row. This is a separate, purpose-
--      built table per the spec's fallback.
--
-- family_season.fundraising_method already exists (migration 0009), with the
-- exact CHECK values the wizard uses — no change needed here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. family employer-match columns
-- ----------------------------------------------------------------------------
alter table family add column if not exists employer_match_company text;
alter table family add column if not exists employer_match_pct integer;
alter table family add column if not exists employer_match_portal text;

-- ----------------------------------------------------------------------------
-- 2. family_sponsor_interest
-- ----------------------------------------------------------------------------
create table if not exists family_sponsor_interest (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references family(id),
  season text not null,
  business_name text,
  contact_name text,
  estimated_amount numeric(10, 2),
  status text default 'pending',
  source text default 'registration_wizard',
  notes text,
  created_at timestamptz default now()
);

grant all on family_sponsor_interest to anon, authenticated, service_role;

alter table family_sponsor_interest enable row level security;

drop policy if exists family_sponsor_interest_admin_all on family_sponsor_interest;
create policy family_sponsor_interest_admin_all on family_sponsor_interest for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
