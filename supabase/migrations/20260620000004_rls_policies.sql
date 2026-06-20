-- ============================================================================
-- Placer Robotics Hub — Task 3: Row Level Security policies
-- Migration: 20260620000004_rls_policies
--
-- RLS is already ENABLED on all tables (migration 20260620000001). This file
-- adds the policies. Re-runnable: every policy is dropped-if-exists first.
--
-- Identity model:
--   * A family member is any auth user whose email matches a guardian row:
--     lower(guardian.login_email) = lower(auth.email()).
--   * An admin is an auth user with admin_profile.auth_user_id = auth.uid()
--     and at least one non-revoked admin_role_assignment.
--
-- Helper functions are SECURITY DEFINER so their internal lookups bypass RLS
-- (prevents recursive policy evaluation). Every policy targets the
-- `authenticated` role only, so anonymous users get no access to any table
-- (rule 8). The service_role key bypasses RLS entirely (used by server jobs).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from admin_role_assignment ara
    join admin_profile ap on ap.id = ara.admin_profile_id
    where ap.auth_user_id = auth.uid()
      and ap.active
      and ara.revoked_at is null
  );
$$;

create or replace function public.has_admin_role(target admin_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from admin_role_assignment ara
    join admin_profile ap on ap.id = ara.admin_profile_id
    where ap.auth_user_id = auth.uid()
      and ap.active
      and ara.revoked_at is null
      and ara.role = target
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role('super_admin'::admin_role);
$$;

create or replace function public.can_write_registration()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role('super_admin'::admin_role)
      or public.has_admin_role('registration_admin'::admin_role);
$$;

create or replace function public.can_write_volunteer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role('super_admin'::admin_role)
      or public.has_admin_role('volunteer_admin'::admin_role);
$$;

create or replace function public.owns_family(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target is not null and exists (
    select 1 from guardian g
    where g.family_id = target
      and lower(g.login_email) = lower(auth.email())
  );
$$;

create or replace function public.owns_student(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student s
    where s.id = target and public.owns_family(s.family_id)
  );
$$;

create or replace function public.owns_volunteer(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from volunteer_profile vp
    where vp.id = target and public.owns_family(vp.family_id)
  );
$$;

-- ============================================================================
-- POLICIES
-- ============================================================================

-- ---- 7. season_config — all authenticated read; super_admin write ----------
drop policy if exists season_config_read on season_config;
create policy season_config_read on season_config for select to authenticated using (true);
drop policy if exists season_config_write on season_config;
create policy season_config_write on season_config for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- 7. school — all authenticated read; super_admin write ------------------
drop policy if exists school_read on school;
create policy school_read on school for select to authenticated using (true);
drop policy if exists school_write on school;
create policy school_write on school for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- Family-owned core tables (rule 1 read/write own; rule 2 admin read,
--       super_admin + registration_admin write) -------------------------------
-- family
drop policy if exists family_select on family;
create policy family_select on family for select to authenticated
  using (public.owns_family(id) or public.is_admin());
drop policy if exists family_insert on family;
create policy family_insert on family for insert to authenticated
  with check (public.owns_family(id) or public.can_write_registration());
drop policy if exists family_update on family;
create policy family_update on family for update to authenticated
  using (public.owns_family(id) or public.can_write_registration())
  with check (public.owns_family(id) or public.can_write_registration());
drop policy if exists family_delete on family;
create policy family_delete on family for delete to authenticated
  using (public.can_write_registration());

-- family_season
drop policy if exists family_season_select on family_season;
create policy family_season_select on family_season for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists family_season_write on family_season;
create policy family_season_write on family_season for all to authenticated
  using (public.owns_family(family_id) or public.can_write_registration())
  with check (public.owns_family(family_id) or public.can_write_registration());

-- guardian
drop policy if exists guardian_select on guardian;
create policy guardian_select on guardian for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists guardian_write on guardian;
create policy guardian_write on guardian for all to authenticated
  using (public.owns_family(family_id) or public.can_write_registration())
  with check (public.owns_family(family_id) or public.can_write_registration());

-- student
drop policy if exists student_select on student;
create policy student_select on student for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists student_write on student;
create policy student_write on student for all to authenticated
  using (public.owns_family(family_id) or public.can_write_registration())
  with check (public.owns_family(family_id) or public.can_write_registration());

-- emergency_contact
drop policy if exists emergency_contact_select on emergency_contact;
create policy emergency_contact_select on emergency_contact for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists emergency_contact_write on emergency_contact;
create policy emergency_contact_write on emergency_contact for all to authenticated
  using (public.owns_family(family_id) or public.can_write_registration())
  with check (public.owns_family(family_id) or public.can_write_registration());

-- student_application
drop policy if exists student_application_select on student_application;
create policy student_application_select on student_application for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists student_application_write on student_application;
create policy student_application_write on student_application for all to authenticated
  using (public.owns_family(family_id) or public.can_write_registration())
  with check (public.owns_family(family_id) or public.can_write_registration());

-- enrollment
drop policy if exists enrollment_select on enrollment;
create policy enrollment_select on enrollment for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists enrollment_write on enrollment;
create policy enrollment_write on enrollment for all to authenticated
  using (public.owns_family(family_id) or public.can_write_registration())
  with check (public.owns_family(family_id) or public.can_write_registration());

-- ---- 3. financial_aid — ONLY financial_aid_admin + super_admin (read+write).
--       No family access, no other admin (incl. registration_admin). ----------
drop policy if exists financial_aid_admins_only on financial_aid;
create policy financial_aid_admins_only on financial_aid for all to authenticated
  using (public.has_admin_role('financial_aid_admin'::admin_role) or public.is_super_admin())
  with check (public.has_admin_role('financial_aid_admin'::admin_role) or public.is_super_admin());

-- ---- 5. payment_transaction — family reads own; all admins read;
--       payment_admin + super_admin write -------------------------------------
drop policy if exists payment_transaction_select on payment_transaction;
create policy payment_transaction_select on payment_transaction for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists payment_transaction_write on payment_transaction;
create policy payment_transaction_write on payment_transaction for all to authenticated
  using (public.has_admin_role('payment_admin'::admin_role) or public.is_super_admin())
  with check (public.has_admin_role('payment_admin'::admin_role) or public.is_super_admin());

-- ---- 6. volunteer_profile — family reads own; all admins read;
--       volunteer_admin + super_admin write -------------------------------------
drop policy if exists volunteer_profile_select on volunteer_profile;
create policy volunteer_profile_select on volunteer_profile for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists volunteer_profile_write on volunteer_profile;
create policy volunteer_profile_write on volunteer_profile for all to authenticated
  using (public.can_write_volunteer()) with check (public.can_write_volunteer());

-- volunteer_step — family reads own (via volunteer_profile); vol_admin/super write
drop policy if exists volunteer_step_select on volunteer_step;
create policy volunteer_step_select on volunteer_step for select to authenticated
  using (public.owns_volunteer(volunteer_id) or public.is_admin());
drop policy if exists volunteer_step_write on volunteer_step;
create policy volunteer_step_write on volunteer_step for all to authenticated
  using (public.can_write_volunteer()) with check (public.can_write_volunteer());

-- youth_protection_cert — family reads own; vol_admin/super write
drop policy if exists youth_protection_cert_select on youth_protection_cert;
create policy youth_protection_cert_select on youth_protection_cert for select to authenticated
  using (public.owns_volunteer(volunteer_id) or public.is_admin());
drop policy if exists youth_protection_cert_write on youth_protection_cert;
create policy youth_protection_cert_write on youth_protection_cert for all to authenticated
  using (public.can_write_volunteer()) with check (public.can_write_volunteer());

-- quiz_attempt — family inserts/reads own; vol_admin/super write
drop policy if exists quiz_attempt_select on quiz_attempt;
create policy quiz_attempt_select on quiz_attempt for select to authenticated
  using (public.owns_volunteer(volunteer_id) or public.is_admin());
drop policy if exists quiz_attempt_insert on quiz_attempt;
create policy quiz_attempt_insert on quiz_attempt for insert to authenticated
  with check (public.owns_volunteer(volunteer_id) or public.can_write_volunteer());
drop policy if exists quiz_attempt_modify on quiz_attempt;
create policy quiz_attempt_modify on quiz_attempt for update to authenticated
  using (public.can_write_volunteer()) with check (public.can_write_volunteer());
drop policy if exists quiz_attempt_delete on quiz_attempt;
create policy quiz_attempt_delete on quiz_attempt for delete to authenticated
  using (public.can_write_volunteer());

-- ---- Reference tables readable by any authenticated user; super_admin write --
-- team
drop policy if exists team_read on team;
create policy team_read on team for select to authenticated using (true);
drop policy if exists team_write on team;
create policy team_write on team for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- waiver_template
drop policy if exists waiver_template_read on waiver_template;
create policy waiver_template_read on waiver_template for select to authenticated using (true);
drop policy if exists waiver_template_write on waiver_template;
create policy waiver_template_write on waiver_template for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- quiz (definitions/metadata; answers live in quiz_question which is admin-only)
drop policy if exists quiz_read on quiz;
create policy quiz_read on quiz for select to authenticated using (true);
drop policy if exists quiz_write on quiz;
create policy quiz_write on quiz for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- waiver_signature — family + admin read; family + admin insert.
--       Append-only (update/delete blocked by trigger; no policy granted). -----
drop policy if exists waiver_signature_select on waiver_signature;
create policy waiver_signature_select on waiver_signature for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists waiver_signature_insert on waiver_signature;
create policy waiver_signature_insert on waiver_signature for insert to authenticated
  with check (public.owns_family(family_id) or public.is_admin());

-- ---- team_member — admins + the student's family read; registration write ----
drop policy if exists team_member_select on team_member;
create policy team_member_select on team_member for select to authenticated
  using (public.is_admin() or public.owns_student(student_id));
drop policy if exists team_member_write on team_member;
create policy team_member_write on team_member for all to authenticated
  using (public.can_write_registration()) with check (public.can_write_registration());

-- ---- notification_log — family reads own; admins read; admins insert ---------
drop policy if exists notification_log_select on notification_log;
create policy notification_log_select on notification_log for select to authenticated
  using (public.owns_family(family_id) or public.is_admin());
drop policy if exists notification_log_insert on notification_log;
create policy notification_log_insert on notification_log for insert to authenticated
  with check (public.is_admin());

-- ---- 4. admin_action_log — append-only: admins read + insert; no update/delete
drop policy if exists admin_action_log_select on admin_action_log;
create policy admin_action_log_select on admin_action_log for select to authenticated
  using (public.is_admin());
drop policy if exists admin_action_log_insert on admin_action_log;
create policy admin_action_log_insert on admin_action_log for insert to authenticated
  with check (public.is_admin());
-- (No UPDATE/DELETE policies. The append-only trigger also blocks mutation.)

-- ---- sync_log — append-only: admins read + insert; no update/delete ----------
drop policy if exists sync_log_select on sync_log;
create policy sync_log_select on sync_log for select to authenticated
  using (public.is_admin());
drop policy if exists sync_log_insert on sync_log;
create policy sync_log_insert on sync_log for insert to authenticated
  with check (public.is_admin());

-- ---- Admin-only tables -------------------------------------------------------
-- admin_profile — admins read all; a user may read their own row; super write
drop policy if exists admin_profile_select on admin_profile;
create policy admin_profile_select on admin_profile for select to authenticated
  using (public.is_admin() or auth_user_id = auth.uid());
drop policy if exists admin_profile_write on admin_profile;
create policy admin_profile_write on admin_profile for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- admin_role_assignment — admins read; super_admin write
drop policy if exists admin_role_assignment_select on admin_role_assignment;
create policy admin_role_assignment_select on admin_role_assignment for select to authenticated
  using (public.is_admin());
drop policy if exists admin_role_assignment_write on admin_role_assignment;
create policy admin_role_assignment_write on admin_role_assignment for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- person_role — admins read; super_admin write
drop policy if exists person_role_select on person_role;
create policy person_role_select on person_role for select to authenticated
  using (public.is_admin());
drop policy if exists person_role_write on person_role;
create policy person_role_write on person_role for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- sync_exclusion — admins read; super_admin write
drop policy if exists sync_exclusion_select on sync_exclusion;
create policy sync_exclusion_select on sync_exclusion for select to authenticated
  using (public.is_admin());
drop policy if exists sync_exclusion_write on sync_exclusion;
create policy sync_exclusion_write on sync_exclusion for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- quiz_question — admin read (contains correct_answers); super_admin write
drop policy if exists quiz_question_select on quiz_question;
create policy quiz_question_select on quiz_question for select to authenticated
  using (public.is_admin());
drop policy if exists quiz_question_write on quiz_question;
create policy quiz_question_write on quiz_question for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- engagement_event — admins read; registration_admin/super_admin write
drop policy if exists engagement_event_select on engagement_event;
create policy engagement_event_select on engagement_event for select to authenticated
  using (public.is_admin());
drop policy if exists engagement_event_write on engagement_event;
create policy engagement_event_write on engagement_event for all to authenticated
  using (public.can_write_registration()) with check (public.can_write_registration());

-- engagement_attendance — admins read; registration_admin/super_admin write
drop policy if exists engagement_attendance_select on engagement_attendance;
create policy engagement_attendance_select on engagement_attendance for select to authenticated
  using (public.is_admin());
drop policy if exists engagement_attendance_write on engagement_attendance;
create policy engagement_attendance_write on engagement_attendance for all to authenticated
  using (public.can_write_registration()) with check (public.can_write_registration());
