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
- **0019** `team_member` partial unique indexes (one active membership per enrollment;
  per team+guardian for coaches) — `revoked_at is null`
- **0020** seed participation / liability waiver (active)
- **0021** `tshirt_size += ym/yl/xxxl` (Youth M/L + Adult 3XL; xs/s/m reused as Adult XS/S/M)
- **0022** seed Center Use waiver · **0023** Expectations Agreement · **0024** Youth
  Protection summary — all active `waiver_template` rows
- **0025** `waiver_signature.participant_typed_name` — **coupled with the register route**
  (student + parent dual signature); registration submit errors until it's applied

- **0048** Cavitt Jr. High V5 fee tier — `school.fee_tier` +
  `season_config.cavitt_v5_registration_fee`/`zeffy_cavitt_url`. V5-ONLY registrations
  from a 'cavitt' school pay via a separate same-structure Zeffy campaign
  (env `ZEFFY_CAVITT_CAMPAIGN_ID`); Combat/'both'/IQ stay standard.
- **0049** `season_config.cavitt_v5_fundraising_target` — Cavitt keeps the standard
  $40 reg fee; what differs is the fundraising commitment ($500 vs $550). Live config
  set 2026-07-11 (fee 40, target 500, Cavitt Zeffy URL).
- **0053** `vex_stats_schema` — `vex_team`/`vex_award`/`vex_worlds_run` + `vex_category_stats`
  view (VEX competition record: Worlds quals, banner awards, elim depth, State/Region
  titles). **NOT YET APPLIED** — run in the Supabase SQL editor before the sync job or
  the `/admin/cavitt` page will work. See docs/vex-stats-integration.md.
- **0054** `combat_stats_schema` — `combat_bot`/`combat_event`/`combat_result`/`combat_match` +
  `combat_bot_stats` view. **NOT YET APPLIED** — same as 0053; `/admin/combat` needs this
  first. See docs/combat-results-capture.md.

Applied through **0049** (0053–0054 written 2026-07-12, NOT yet run against the live DB —
see above; 0048–0049 applied + verified live 2026-07-11; 0025–0047 verified
against the live DB 2026-07-10: 0025 waiver column, 0026 volunteer_clearance, 0044
volunteer statuses, 0045 provisional Combat teams,
0046 step_status 'needs_review', 0047 aps_enrollment_run all present). Historical
note: 0016 + 0017 had once silently never been applied — always verify, don't assume.

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
- **Magic links** use `supabase.auth.signInWithOtp` (Supabase sends via its configured
  SMTP). Admin-sent invites arrive via implicit flow (tokens in the URL hash); `/login`
  consumes the hash to finish sign-in. `auth.admin.generateLink` only *returns* a link
  (used by view-as-family) — it can't send.
- **App-sent email** (e.g. registration confirmation) goes through `lib/email.ts`
  (Resend REST API), gated on `RESEND_API_KEY` — it no-ops/logs if unset so it never
  breaks a flow. Branded templates live in `docs/email-templates/`.
- **Payments / Zeffy:** reconciliation is a **pull** via the Zeffy API (`lib/zeffy.ts`,
  `/admin/payments → Sync from Zeffy`; env `ZEFFY_API_KEY` + `ZEFFY_REGISTRATION_CAMPAIGN_ID`).
  Match key = guardian sign-in email + student name + program; one payment per enrollment.
  The native Zeffy webhook (Beta) never delivered — `/api/webhooks/zeffy` stays as a
  capture-only fallback. **`matched_status` has NO `'matched'` value** — use
  `auto_matched` / `manually_matched`.
- **Admin roles** are managed at `/admin/admins` (super-admin only) — no SQL needed.
- Season is hard-coded `'2026-27'` (`const SEASON`) in most routes.

## Where things live (built this season)

- Family: `/dashboard` (per-student completion + supporter level + receipt),
  `/dashboard/edit` (self-service), `/register` wizard (4 waivers, dual signature),
  `/waivers` (second-parent signing).
- Admin: `/admin/registrations`, `/admin/families` (+ `[id]` detail, change-email /
  resend / view-as-family), `/admin/admins` (roles), `/admin/payments` (Zeffy sync).
- **Competition stats** (2026-07-12, migrations 0053/0054 — see above):
  `/coach` shows a "Competition record" block per team (`lib/vexStats.ts`,
  `components/ui/CompetitionRecord.tsx`) when a synced `vex_team` row matches
  the coach's `team.team_number`. `/admin/cavitt` — the Cyber Cowboys (Willma
  Cavitt JH) record, a SEPARATE program (`is_part=false`), never blended into
  PART's own totals. `/admin/combat` — manual entry for combat results (no
  RobotEvents source exists for combat). `scripts/part_vex_history.py`
  (`--backfill` / `--season current --to supabase`) is the sync job, run by
  `.github/workflows/sync-vex-stats.yml` 2x/day; `scripts/import_combat.py`
  loads a combat history CSV. `GET /api/public/vex-stats` (service-role,
  mirrors `/api/schools`'s public-read pattern) is what placer-site reads.
  Full spec: `docs/vex-stats-integration.md` + `docs/combat-results-capture.md`.

## Email capture — re-add to registration (requested)

Most per-person email columns already exist in `20260620000001_initial_schema.sql`; the
rebuilt public forms stopped collecting several. **Add the inputs to the `/register`
wizard** (NOT `/apply`, which stays minimal) and to admin family/student edit. Reconcile
against the schema first.

**Two-email model per person** (no schema change — all columns already exist, so this
stays PRD §16-compliant; do NOT add new email columns):
- `login_email` (guardian) = registration = Slack identity. Capture `slack_email`
  separately **only if it differs** — prefill it from `login_email`. PRD §19: warn on
  first set that changing Slack email later needs admin action (Slack can't rename/merge).
- `communication_email` (guardian AND student) = the **Google Workspace email**: used for
  Google Drive / Workspace access rights **and** as the address communications are sent
  to. **Relabel the field in the UI** accordingly, e.g. "Google Workspace email — used for
  Drive access and all communications." This is the second email families asked for; it is
  the existing `communication_email`, not a new field.
- `student.fusion_education_email` — already captured on `/register`; keep it.
- `student.slack_email` — not captured today; add it alongside the student fields.

Forms to touch: `/register` wizard (primary), admin family/student edit, and import
mapping in `/admin/import` + `/admin/import-applicants`. `/apply` stays minimal.
PRD §20: registration must **warn (not block)** when a student email looks like a school
domain ("School email addresses are often blocked — use a personal email…").
Do **NOT** re-add `volunteerlocal_email` (PRD §18/26 removed it deliberately — no API).

## Known open items

- `guardian.last_login_at` is still **not written** on login — the login-status dots
  read "never logged in" for everyone. Fix in `app/api/auth/callback/route.ts`.
- Production email at volume: Supabase SMTP (for magic links) still being configured;
  app email (`RESEND_API_KEY`) not yet set.
- The auth-admin actions (`change-email`, `view-as-family`, grant-role-by-email) use
  `auth.admin.*` and have **not been run against live** — verify before relying on them.
- Combat teams not yet defined (only 15 V5 teams imported).
- Migrations 0053/0054 (vex_*/combat_* competition-stats schema) are written but **NOT
  applied** — run them in the Supabase SQL editor, then set `VEX_EVENTS_TOKEN` +
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` as repo secrets and run the
  `Sync VEX Stats` GitHub Action once with `mode: backfill` to seed all history
  before `/coach`'s competition record, `/admin/cavitt`, or `GET /api/public/vex-stats`
  will show real data.
- Deferred registration polish (see `docs/KNOWN_ISSUES.md`): bulk-send hides per-email
  failures; reinstate always → `cleared_to_register`; `family_season.updated_at` not
  set; `registration_audit_log` isn't append-only; `/admin/guardians/new` 404 from the
  coach flow.
- Google/Slack sync (`sync_log`) and volunteer-clearance integrations not built.

See `docs/KNOWN_ISSUES.md` for the full, severity-tagged list.
