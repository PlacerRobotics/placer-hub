-- ============================================================================
-- Placer Robotics Hub — APS bulk-enrollment run log
-- Migration: 20260620000047_aps_enrollment_run
--
-- Task 1.10: bulk APS renewal enrollment. Each admin-triggered run is logged
-- here — who ran it, counts, and per-volunteer results (jsonb) including
-- failures — mirroring registration_audit_log's admin-only access pattern.
--
-- Idempotent.
-- ============================================================================

create table if not exists aps_enrollment_run (
  id uuid primary key default gen_random_uuid(),
  ran_by uuid references admin_profile(id),
  season text not null,
  enrolled_count integer not null default 0,
  emailed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  -- per-volunteer results: [{ volunteerId, name, status, error? }]
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_aps_enrollment_run_created on aps_enrollment_run (created_at desc);

-- RLS: admins only; volunteers never see run logs.
alter table aps_enrollment_run enable row level security;

drop policy if exists aps_enrollment_run_admin_all on aps_enrollment_run;
create policy aps_enrollment_run_admin_all on aps_enrollment_run
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Table grants are separate from RLS (see migration 0005's lesson).
grant select, insert on aps_enrollment_run to authenticated;
