-- ============================================================================
-- Placer Robotics Hub — Financial aid closed loop
-- Migration: 20260620000008_financial_aid_family_read
--
-- Adds a SELECT policy so a family can read its OWN financial_aid record (to see
-- the status of their request). The existing admins-only policy is unchanged, so
-- aid remains confidential from OTHER families and non-financial-aid staff —
-- a family only ever sees its own request. Writes stay admin-only (families
-- submit via the service-role API route after a session/ownership check).
-- ============================================================================
drop policy if exists financial_aid_family_read on financial_aid;
create policy financial_aid_family_read on financial_aid
  for select to authenticated
  using (public.owns_family(family_id));
