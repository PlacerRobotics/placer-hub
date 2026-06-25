-- ============================================================================
-- Placer Robotics Hub — pre-launch cleanup
-- Migration: 20260620000042_cleanup_audit_appendonly
--
--  1. Drops the temporary `error_log` diagnostic table (instrumentation removed).
--  2. Makes `registration_audit_log` append-only: admins may read and insert,
--     but not UPDATE or DELETE audit rows (record-keeping integrity).
--     Audit writes go through the service-role client, which bypasses RLS; the
--     grant/policy split below removes any update/delete path for app sessions.
-- ============================================================================

drop table if exists error_log;

-- Append-only audit log.
revoke update, delete on registration_audit_log from authenticated;

drop policy if exists registration_audit_log_admin_all on registration_audit_log;
drop policy if exists registration_audit_log_admin_select on registration_audit_log;
drop policy if exists registration_audit_log_admin_insert on registration_audit_log;

create policy registration_audit_log_admin_select on registration_audit_log
  for select to authenticated
  using (public.is_admin());

create policy registration_audit_log_admin_insert on registration_audit_log
  for insert to authenticated
  with check (public.is_admin());
