<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# placer-hub — project & schema handoff

Family/admin registration portal for Placer Advanced Robotics & Technology (Placer
Robotics). Next.js 16 (app router, Turbopack) + React 19 + TypeScript, Supabase
(Postgres + Auth + RLS), deployed on Vercel. Brand: Navy `#0E2558` / Gold `#F2C352`.
Admin layout `components/ui/AdminShell.tsx`; Supabase server client
`lib/supabase/server.ts`; service-role admin client `lib/supabase/admin.ts`.

## The #1 rule: reconcile every spec against the real schema FIRST

Feature requests are usually written in a **denormalized mental model** that does not
match the normalized database. Building to a spec verbatim repeatedly referenced
columns/enum values that don't exist and broke the build. **Before writing code, read
`supabase/migrations/20260620000001_initial_schema.sql` and confirm the columns,
unique constraints, and enum values you're about to use.** When a spec conflicts with
the schema, flag it and propose the schema-correct shape rather than inventing columns.

Recurring wrong assumptions (all FALSE — don't repeat them):
- "family_season has team_id / student_id / program" — it does **not** (family-level).
- "student_application holds one row per program" — `unique (student_id, season)`.
- "a student in two programs needs two applications" — no: one application with
  `program_interest = 'both'`, and **two `enrollment` rows** (per-program lives there).
- "guardian.auth_user_id joins auth.users" — guardian has **no** auth_user_id; use
  `guardian.last_login_at`. `auth.users` is not queryable via PostgREST.
- "division is middle/high" — it's **ES/MS/HS** (renamed in migration 0014).
- "team has a status workflow" — no; use the `active` boolean (0015).

## Core data model

- **family** — permanent root, no season. User match: `guardian.login_email = auth.email()`.
- **family_season** — `unique (family_id, season)`, **one per family per season**.
  Family-level: `status`, `magic_link_sent` (0011), `current_season_notes`. No team_id /
  student_id / program. `family_season_status`: `prospect, applied, accepted,
  cleared_to_register, registered, declined, suspended, cancelled` (cancelled = 0018).
- **student** — per student. `city`/`zip_code` **NOT NULL**. Has `birthdate`, `phone`,
  `communication_email`, `preferred_name`, `tshirt_size`, `grade`, `school_id`/`school_raw`.
- **student_application** — `unique (student_id, season)`, single `program_interest`.
  `application_status`: `submitted, needs_follow_up, program_pending, accepted, declined,
  withdrawn, admin_waived` — **no 'pending'**. `additional_notes` (0013).
- **enrollment** — `unique (student_id, season, program)`. **Per-program participation
  lives here** (V5+Combat = two rows). Fees, `payment_reference_code` (unique),
  `division` (ES/MS/HS), `fundraising_target`. Created by `/register`, **not** imports.
- **program_selection**: `vex_v5, combat, vex_iq, not_sure, both` (`both` = 0017,
  application-interest only — enrollment/team stay single-program).
- **division**: `ES, MS, HS` (renamed from middle/high in 0014; shared by team +
  enrollment). Registration derives: `grade<=5 ES, <=8 MS, else HS`.
- **team** — per season. `school_org` **NOT NULL**, `program` = `team_program`
  (vex_v5/vex_iq/combat). No status workflow — `active` boolean + `notes` (0015).
- **team_member** — canonical team assignment: `team_id` + (`enrollment_id` OR
  `guardian_id`) + `program` (**NOT NULL**) + `team_role` (student/coach/manager/
  assistant + assistant_coach/mentor from 0016) + `revoked_at` (0016). **A student must
  be registered (have an enrollment) before team assignment.**
- **guardian** — `login_email` (unique, magic-link auth), `last_login_at` (login signal —
  **verify the login/callback flow writes it**), `occupation`, `volunteer_interests[]`,
  `volunteer_notes` (0013). No `auth_user_id`.
- **admin auth** — `admin_profile.auth_user_id` + non-revoked `admin_role_assignment`.
  `lib/auth/admin.ts:getAdminProfile()` → `{ id }` or null.
- **RLS** — SECURITY DEFINER helpers `public.is_admin()`, `public.owns_family()`,
  `public.can_write_registration()`. Table `GRANT`s are **separate** from RLS —
  "permission denied for table" = missing grant (0005), not RLS.
- **school** — seeded (0006); `type` + `grade_min`/`grade_max` (0012) drive grade-aware
  dropdowns.

## Migrations — status & ordering

Prefix `20260620000NNN_`. Run **manually** in the Supabase SQL editor (no auto-apply).
Use the next free number; validate with `pglast` before committing.

- **0012** school grade ranges (re-run if edited)
- **0013** application notes (`additional_notes`, `guardian.volunteer_notes`)
- **0014** division → `MS/HS/ES` — renames shared enum; **coupled with code**, deploy +
  migrate together
- **0015** `team.active` + `team.notes` — **fixes empty `/admin/teams`** (page selects them)
- **0016** team_member coach support (`revoked_at`, `assistant_coach`/`mentor`)
- **0017** `program_selection += 'both'` — coupled with apply/import/register code
- **0018** `family_season_status += 'cancelled'` + `registration_audit_log` (admin RLS)

**Enum caveat:** `ALTER TYPE … ADD VALUE` can't be referenced in the same transaction.
If the editor wraps a file in one transaction and errors on an `ADD VALUE` line, run
that line on its own first.

## Conventions / workflow

- **Build gate:** `next build` green before commit (`tsc --noEmit` for fast checks).
  Validate migration SQL with `pglast`.
- **Imports** (`/admin/import` returning, `/admin/import-applicants` applicants) create
  records only — **never send magic links during import**. Held → `family_season
  'applied'` + `student_application 'submitted'`; approved → `accepted` /
  `cleared_to_register`. Invites go out via separate Send-Invites flows.
- **Magic links** use `supabase.auth.signInWithOtp` (Supabase sends the email). No
  custom email sender (Resend/SMTP) is wired up — `auth.admin.generateLink` can't send.
- Season is hard-coded `'2026-27'` (`const SEASON`) in most routes.

## Known open items

- Confirm the login/callback flow writes `guardian.last_login_at` (login-status dots
  depend on it).
- Production email (Resend/SMTP) for magic links at volume.
- Family dashboard checklist partly mocked; Google/Slack sync (`sync_log`) not built.
- Combat teams not yet defined (only 15 V5 teams imported).
- Zeffy registration ticketing campaign exists but is unlisted/draft pending review.
