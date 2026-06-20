-- ============================================================================
-- Placer Robotics Hub — Sponsor schema
-- Migration: 20260620000009_sponsor_schema
--   (requested as 0006, but 0006 is the school-seed migration — renumbered to
--    0009 so it isn't overwritten.)
--
-- Sponsor, sponsor_commitment, enrollment_sponsor_credit tables + a
-- family_season.fundraising_method column. Admin-only RLS (no family access).
-- ============================================================================

create type sponsor_tier as enum ('diamond', 'platinum', 'gold', 'silver', 'bronze', 'irl_season', 'in_kind');
create type sponsor_type as enum ('company', 'family', 'individual');

-- ----------------------------------------------------------------------------
-- sponsor
-- ----------------------------------------------------------------------------
create table sponsor (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sponsor_type sponsor_type not null default 'company',
  contact_first text,
  contact_last text,
  contact_email text,
  contact_phone text,
  logo_url text,
  website_url text,
  is_returning boolean default false,
  part_contact text,
  notes text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- sponsor_commitment
-- ----------------------------------------------------------------------------
create table sponsor_commitment (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid references sponsor(id),
  season text not null,
  tier sponsor_tier,
  amount_committed numeric(10, 2),
  amount_type text,
  amount_received numeric(10, 2) default 0,
  payment_date date,
  payment_method text,
  donor_letter_sent_date date,
  logo_on_tshirt boolean default false,
  tshirt_sizes text,
  social_media_recognition boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- enrollment_sponsor_credit
-- ----------------------------------------------------------------------------
create table enrollment_sponsor_credit (
  id uuid primary key default gen_random_uuid(),
  sponsor_commitment_id uuid references sponsor_commitment(id),
  family_season_id uuid references family_season(id),
  amount_credited numeric(10, 2),
  credited_by uuid references admin_profile(id),
  credited_at timestamptz default now(),
  notes text
);

-- ----------------------------------------------------------------------------
-- family_season.fundraising_method
-- ----------------------------------------------------------------------------
alter table family_season
  add column if not exists fundraising_method text
  default 'pending'
  check (fundraising_method in ('direct_donation', 'corporate_match', 'sponsored', 'paper_check', 'pending'));

-- ----------------------------------------------------------------------------
-- Grants (so the authenticated API roles can reach the new tables; rows still
-- gated by RLS below).
-- ----------------------------------------------------------------------------
grant all on sponsor, sponsor_commitment, enrollment_sponsor_credit
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RLS — admins read/write all sponsor tables; no family access.
-- ----------------------------------------------------------------------------
alter table sponsor                    enable row level security;
alter table sponsor_commitment         enable row level security;
alter table enrollment_sponsor_credit  enable row level security;

drop policy if exists sponsor_admin_all on sponsor;
create policy sponsor_admin_all on sponsor for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists sponsor_commitment_admin_all on sponsor_commitment;
create policy sponsor_commitment_admin_all on sponsor_commitment for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists enrollment_sponsor_credit_admin_all on enrollment_sponsor_credit;
create policy enrollment_sponsor_credit_admin_all on enrollment_sponsor_credit for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
