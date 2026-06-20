-- ============================================================================
-- Placer Robotics Hub — Task 2: Seed data + bootstrap admin
-- Migration: 20260620000002_seed
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2026-27 season configuration
--   sync_active = true, registration_active = false, program_year_active = true
--   (program_year_start/end and fundraising_deadline are NOT NULL in season_config)
-- ----------------------------------------------------------------------------
insert into season_config (
  season,
  program_year_start,
  program_year_end,
  fundraising_deadline,
  sync_active,
  registration_active,
  program_year_active,
  active
)
values (
  '2026-27',
  date '2026-08-01',
  date '2027-06-30',
  date '2027-03-31',
  true,
  false,
  true,
  true
)
on conflict (season) do update set
  sync_active         = excluded.sync_active,
  registration_active = excluded.registration_active,
  program_year_active = excluded.program_year_active,
  active              = excluded.active,
  updated_at          = now();

-- ----------------------------------------------------------------------------
-- Bootstrap admin
--   When BOOTSTRAP_ADMIN_EMAIL signs in for the first time (new auth.users row),
--   create their admin_profile and grant role = super_admin.
--
--   The bootstrap email is read from the GUC 'app.bootstrap_admin_email' if set
--   (e.g. `alter database postgres set app.bootstrap_admin_email = '...'`), and
--   otherwise falls back to the value in .env.example. Keep the fallback in sync
--   with the BOOTSTRAP_ADMIN_EMAIL environment variable.
-- ----------------------------------------------------------------------------
create or replace function handle_bootstrap_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bootstrap_email text := nullif(current_setting('app.bootstrap_admin_email', true), '');
  v_admin_id uuid;
begin
  if bootstrap_email is null then
    bootstrap_email := 'kevin.miller@placerrobotics.org';  -- fallback: matches BOOTSTRAP_ADMIN_EMAIL
  end if;

  if new.email is not null and lower(new.email) = lower(bootstrap_email) then
    insert into admin_profile (auth_user_id, email, display_name, active)
    values (new.id, new.email, 'Bootstrap Super Admin', true)
    on conflict (auth_user_id) do nothing
    returning id into v_admin_id;

    if v_admin_id is not null then
      insert into admin_role_assignment (admin_profile_id, role)
      values (v_admin_id, 'super_admin');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_bootstrap_admin on auth.users;
create trigger on_auth_user_bootstrap_admin
  after insert on auth.users
  for each row execute function handle_bootstrap_admin();
