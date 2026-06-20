-- ============================================================================
-- Placer Robotics Hub — Task 3 support: API role grants
-- Migration: 20260620000005_grants
--
-- RLS controls WHICH ROWS a role may see, but PostgreSQL checks table-level
-- privileges FIRST. The PostgREST API roles (anon, authenticated, service_role)
-- need GRANTs on the public schema objects, otherwise every query fails with
-- "permission denied for table ...". Supabase normally applies these
-- automatically, but the tables created by our migration did not receive them.
--
-- Granting table privileges here does NOT weaken security: row access is still
-- governed entirely by the RLS policies in 20260620000004_rls_policies. A role
-- with a GRANT but no matching policy simply sees zero rows.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Future objects created in public inherit the same grants.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
