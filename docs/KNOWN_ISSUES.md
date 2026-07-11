# placer-hub — known issues & implementation notes

Severity: **[BLOCKER]** = needed before launch · **[FIX]** = real bug, should fix soon
· **[LATER]** = polish / not yet built.

---

## Resolved this session

- Registration submit reliability + `both`-split enrollments (H1), `team_member`
  uniqueness (H2, mig 0019), roster excludes cancelled (H3).
- Family dashboard is now **real** (per-student completion, supporter level, receipt) —
  no longer mock. Self-service edits at `/dashboard/edit`.
- Waivers seeded + active (liability 0020, Center Use 0022, Expectations 0023, Youth
  Protection 0024); registration captures **student + parent** signatures (mig 0025);
  second parent can sign at `/waivers`.
- Registration confirmation email to both guardians + student via `lib/email.ts`
  (Resend, gated on `RESEND_API_KEY`).
- T-shirt sizes (Youth M/L + Adult XS–3XL, mig 0021).
- Zeffy reconciliation as an **API pull** (`/admin/payments → Sync from Zeffy`),
  replacing the non-delivering Beta webhook. One payment per enrollment.
- Admin family management (`/admin/families`) + roles UI (`/admin/admins`).
- Fixed `matched_status='matched'` (invalid enum) in `lib/payments.ts` — had been
  breaking manual payment matching too.

---

## Open

### Auth & email
- **[BLOCKER] Production SMTP** for Supabase magic links (in progress). App email needs
  `RESEND_API_KEY` (+ verified domain) set in Vercel — until then confirmation emails
  log/skip.
- **[RESOLVED] `guardian.last_login_at`** — now stamped by `POST /api/auth/touch-login`,
  called from `/login` after `setSession` (magic links land on `/login`, bypassing the
  callback). Login-status dots now reflect real sign-ins.
- **[FIX] `/login` shows `{}`** instead of the real Supabase error on a failed send.
- **[FIX] Auth-admin actions untested live** — `families/[id]/change-email`,
  `view-as-family`, and roles grant-by-email use `auth.admin.listUsers/updateUserById/
  generateLink`. Compile-correct; run against prod before relying on them.

### Admin — registrations (deferred from the H1–H3 audit)
- **[RESOLVED] Bulk "Send Magic Links" failures** — per-email failures now surfaced in
  the manager status message ("Sent N. M failed: …").
- **[RESOLVED] Reinstate** — now restores `registered` if the family has any enrollment,
  else `cleared_to_register`.
- **[RESOLVED] `family_season.updated_at`** — now set on cancel / reinstate / bulk
  cancel / send-invite (manual stamp; still no DB trigger).
- **[LATER]** Detail page picks `studs[0]` w/o `?student=`; emergency-contact name parse
  is lossy; bulk Assign Team doesn't validate program/division.

### Payments / Zeffy
- **[CONFIG]** Set `ZEFFY_API_KEY` + `ZEFFY_REGISTRATION_CAMPAIGN_ID` in Vercel to
  activate the sync; rotate the API key (it was shared in chat).
- **[LATER]** No partial-payment state (fee is all-or-nothing).

### Teams & coaches
- **[STOPGAP] Combat teams undefined** — real 2026-27 Combat rosters aren't finalized
  yet. Migration `20260620000045_provisional_combat_teams` seeds two placeholder
  teams ("Combat MS — TBD" / "Combat HS — TBD", `team.is_provisional = true`) so
  Combat students can be assigned via `/admin/registrations/[id]` as an interim
  step. Admin views show the TBD name + a "Provisional" tag; family/coach views
  (`app/dashboard/page.tsx`) show "Final team placement in progress" instead —
  never the internal name. When real rosters exist, re-split `team_member` rows
  onto real teams per-student using the query template at the bottom of that
  migration file, then deactivate the provisional teams.
- **[RESOLVED] Coach "create new guardian"** — no longer a dead `/admin/guardians/new`
  link; the Add-Coach panel now creates a coach-only family + guardian inline (reusing an
  existing guardian if the email matches) via `POST /api/admin/teams/[id]/coaches`.
- **[LATER] "Default to prior team"** not wired (prior team only in `triage_notes`).

### Volunteers
- **[RESOLVED] Volunteers sign TWO real, versioned agreements** each season at
  `/volunteer/waiver`: the Release of Liability (`student_participation`, same as guardians)
  + the Registered Volunteer policy acknowledgment (`volunteer`, mig 0043). Each is recorded
  as its own `waiver_signature` (version, body_hash snapshot, first+last typed name,
  acceptance date, email, IP/UA); the clearance signal flips only when both are signed.
  `VOLUNTEER_WAIVER_TYPES` in `lib/volunteer.ts` is the source of truth. The apply route no
  longer pre-sets `waiver_signed_date` (it would skip the real signing); renew links to the
  same page (bypass server action removed).
- **[RESOLVED] APS certs are read-only to volunteers** — expiry is synced automatically from
  APS (`lib/aps.ts`; daily cron `/api/cron/volunteer-reminders` calls `syncApsForAll` when
  `APS_API_KEY` is set). The portal shows the expiry + real APS links (safetysystem sign-in
  + CA Mandated Reporter training); the self-report form/route and the apply-time cert-date
  entry were removed. Admin can still set/override expiry from the volunteer detail page.
- **[CONFIG]** APS auto-sync only runs when `APS_API_KEY` (+ optional `APS_SURVEY_CODE`) is
  set in Vercel AND volunteers have an `aps_user_id` (from import). Until then, expiry stays
  blank unless an admin sets it.
- **[LATER]** RC/YP quiz are self-service; DOJ background check is still manual.

### Data / schema
- **[RESOLVED] `registration_audit_log` is now append-only** (mig 0042) — update/delete
  revoked from `authenticated`; RLS reduced to admin select + insert. Also dropped the
  temporary `error_log` diagnostic table (instrumentation removed).
- **[NOTE] `both` fee policy:** split into two enrollments; fee + fundraising target
  charged once (V5 row), Combat row $0. Confirm intended.

### Not built
- **[LATER] Google / Slack sync** (`sync_log` infra exists, job doesn't).
