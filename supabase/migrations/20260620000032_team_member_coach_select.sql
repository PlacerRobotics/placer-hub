-- ============================================================================
-- 0032 — Let coaches read their own team_member rows
-- ----------------------------------------------------------------------------
-- The original team_member select policy was `is_admin() OR owns_student(student_id)`.
-- Coach rows carry guardian_id and a NULL student_id, so owns_student(NULL) is false
-- and a non-admin coach could not read their own coach membership (the family
-- dashboard's "teams I coach" came back empty). Allow reading rows whose guardian_id
-- belongs to the signed-in user (matched by login_email), in addition to admins and
-- the student's family.
-- ============================================================================

drop policy if exists team_member_select on team_member;
create policy team_member_select on team_member for select to authenticated
  using (
    public.is_admin()
    or public.owns_student(student_id)
    or guardian_id in (select id from guardian where login_email = auth.email())
  );
