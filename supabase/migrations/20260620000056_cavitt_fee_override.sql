-- ============================================================================
-- Placer Robotics Hub — per-student Cavitt fee-tier exception
-- Migration: 20260620000056_cavitt_fee_override
--
-- fee_tier (0048) is normally driven entirely by student.school_id -> school.fee_tier
-- ('cavitt' only for kids actually enrolled at Cavitt Jr. High). Real case: a family
-- attends a different school but has an approved one-off exception to register at the
-- Cavitt V5 fee/fundraising tier anyway (e.g. a longtime teammate whose family didn't
-- end up enrolling at Cavitt). cavitt_fee_override lets an admin grant that exception
-- per student, independent of school_id — set manually, never automatically.
--
-- Coupled with: app/api/admin/students/[id]/route.ts (admin edit), app/register/route.ts
-- + register-wizard.tsx (fee/fundraising-target computation), app/dashboard/page.tsx
-- (Zeffy payment link selection) — all three already branch on fee_tier === 'cavitt'
-- and now also check this flag.
-- ============================================================================

alter table student add column if not exists cavitt_fee_override boolean not null default false;
alter table student add column if not exists cavitt_fee_override_note text;
