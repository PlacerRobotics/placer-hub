-- ============================================================================
-- Placer Robotics Hub — guardian email aliases + APS login email of record
-- Migration: 20260620000052_guardian_email_aliases
--
-- Design: docs/design_email_identity_v1_0.md (§1, §1.5), decided with Kevin
-- 2026-07-12. Fixes the recurring root cause behind duplicate families: every
-- guardian lookup across the app (imports, IQ roster-add, coach-add, Zeffy
-- payment matching) matches on exactly one string — guardian.login_email —
-- so any known-alternate address (an APS-era yahoo, an abandoned outlook, a
-- former login) fails the match and mints a duplicate family instead of
-- finding the real person.
--
-- guardian_email_alias: additional emails known to belong to a guardian, used
-- as a FALLBACK match (never authoritative — login_email is always checked
-- first). email is globally unique so one address can't alias two guardians.
-- Populated three ways: automatically when a login email changes (the old
-- value becomes an alias, so it can never spawn a duplicate again), manually
-- via "Add known email" on the family detail page, and from the APS backfill
-- below (source 'aps_legacy').
--
-- volunteer_profile.aps_email: the MinistrySafe account's login email of
-- record — an attribute of the APS account, alongside the existing
-- aps_user_id / aps_training_url. NOT used for cert linkage (that's
-- aps_user_id, untouched by any of this) — this exists so a volunteer or
-- admin can answer "what email did I sign up for APS training with?" without
-- anyone having to remember a years-old yahoo address. Backfilled from the
-- MinistrySafe API (GET /users/:id already returns email — see
-- lib/aps.ts getApsUser), not from human memory.
-- ============================================================================

create table if not exists guardian_email_alias (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardian(id) on delete cascade,
  email text not null unique,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  created_by uuid references admin_profile(id)
);

create index if not exists idx_guardian_email_alias_guardian on guardian_email_alias(guardian_id);

alter table volunteer_profile add column if not exists aps_email text;

alter table guardian_email_alias enable row level security;

drop policy if exists guardian_email_alias_select on guardian_email_alias;
create policy guardian_email_alias_select on guardian_email_alias for select to authenticated
  using (public.is_admin() or guardian_id in (select id from guardian where login_email = auth.email()));

drop policy if exists guardian_email_alias_write on guardian_email_alias;
create policy guardian_email_alias_write on guardian_email_alias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
