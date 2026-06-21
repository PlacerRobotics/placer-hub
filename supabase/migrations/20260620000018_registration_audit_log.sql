-- ============================================================================
-- Placer Robotics Hub — Registration lifecycle: 'cancelled' status + audit log
-- Migration: 20260620000018_registration_audit_log
--
-- Adds 'cancelled' to family_season_status (simplified lifecycle:
-- cleared_to_register / registered / cancelled) and a registration_audit_log
-- table that records admin edits to a family's registration.
--
-- Note: ALTER TYPE ... ADD VALUE is not referenced later in this migration, so it
-- is safe alongside the table create. If your SQL editor wraps the file in one
-- transaction and errors on the ADD VALUE line, run that line on its own first.
-- ============================================================================

alter type family_season_status add value if not exists 'cancelled';

create table if not exists registration_audit_log (
  id uuid primary key default gen_random_uuid(),
  family_season_id uuid references family_season(id) on delete cascade,
  field_changed text,
  old_value text,
  new_value text,
  changed_by uuid references admin_profile(id),
  changed_at timestamptz not null default now(),
  notes text
);

create index if not exists idx_registration_audit_log_fs on registration_audit_log (family_season_id, changed_at desc);

-- RLS: admins read/write; no family access.
alter table registration_audit_log enable row level security;

drop policy if exists registration_audit_log_admin_all on registration_audit_log;
create policy registration_audit_log_admin_all on registration_audit_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on registration_audit_log to authenticated;
