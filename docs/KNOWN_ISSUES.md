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
- **[FIX] Combat teams undefined** — only 15 V5 teams; combat students unassignable
  until a combat team list is imported.
- **[RESOLVED] Coach "create new guardian"** — no longer a dead `/admin/guardians/new`
  link; the Add-Coach panel now creates a coach-only family + guardian inline (reusing an
  existing guardian if the email matches) via `POST /api/admin/teams/[id]/coaches`.
- **[LATER] "Default to prior team"** not wired (prior team only in `triage_notes`).

### Volunteers
- **[RESOLVED] Volunteer waiver is now the real, versioned waiver** (mig 0043 seeds the
  `volunteer` `waiver_template`). `/volunteer/waiver` renders the actual body and records a
  `waiver_signature` (version, body_hash snapshot, first+last typed name, acceptance date,
  email, IP/UA). Renew now routes through the same page (no more bypass server action).
- **[RESOLVED] APS on the portal** — real APS links (safetysystem sign-in + CA Mandated
  Reporter training), the certificate expiry is shown, and volunteers can self-record
  their cert (expiry + link) via `POST /api/volunteer/aps`. Admin can still verify/override
  from the volunteer detail page.
- **[LATER]** Self-reported APS certs have no `verified` flag — admin entry and volunteer
  self-report write the same `youth_protection_cert` row; add a trust/verification flag if
  compliance requires distinguishing them.
- **[LATER]** RC/YP quiz are self-service; DOJ background check is still manual.

### Data / schema
- **[RESOLVED] `registration_audit_log` is now append-only** (mig 0042) — update/delete
  revoked from `authenticated`; RLS reduced to admin select + insert. Also dropped the
  temporary `error_log` diagnostic table (instrumentation removed).
- **[NOTE] `both` fee policy:** split into two enrollments; fee + fundraising target
  charged once (V5 row), Combat row $0. Confirm intended.

### Not built
- **[LATER] Google / Slack sync** (`sync_log` infra exists, job doesn't).
