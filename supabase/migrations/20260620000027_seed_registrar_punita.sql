-- ============================================================================
-- 0027 — Seed Punita Gupta as Registration Admin (Registrar)
-- ----------------------------------------------------------------------------
-- Safe no-op until she has signed in at least once (so her auth.users row
-- exists). Re-run this migration after her first sign-in, OR — easier — grant
-- the role from /admin/admins (no SQL needed). Idempotent.
-- ============================================================================

insert into admin_profile (auth_user_id, email, active)
select u.id, 'punita.gupta@placerrobotics.org', true
from auth.users u
where lower(u.email) = 'punita.gupta@placerrobotics.org'
on conflict (auth_user_id) do nothing;

insert into admin_role_assignment (admin_profile_id, role)
select ap.id, 'registration_admin'
from admin_profile ap
where ap.email = 'punita.gupta@placerrobotics.org'
  and not exists (
    select 1 from admin_role_assignment ra
    where ra.admin_profile_id = ap.id and ra.role = 'registration_admin' and ra.revoked_at is null
  );
