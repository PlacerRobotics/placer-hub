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
- **[FIX] `guardian.last_login_at` never written** in `app/api/auth/callback` → admin
  login-status dots always show "never logged in."
- **[FIX] `/login` shows `{}`** instead of the real Supabase error on a failed send.
- **[FIX] Auth-admin actions untested live** — `families/[id]/change-email`,
  `view-as-family`, and roles grant-by-email use `auth.admin.listUsers/updateUserById/
  generateLink`. Compile-correct; run against prod before relying on them.

### Admin — registrations (deferred from the H1–H3 audit)
- **[FIX] Bulk "Send Magic Links" hides per-email failures** (reports "Sent 0").
- **[FIX] Reinstate always → `cleared_to_register`** even if previously `registered`.
- **[FIX] `family_season.updated_at`** not set by cancel/reinstate/bulk; "Last Updated"
  is unreliable (no trigger).
- **[LATER]** Detail page picks `studs[0]` w/o `?student=`; emergency-contact name parse
  is lossy; bulk Assign Team doesn't validate program/division.

### Payments / Zeffy
- **[CONFIG]** Set `ZEFFY_API_KEY` + `ZEFFY_REGISTRATION_CAMPAIGN_ID` in Vercel to
  activate the sync; rotate the API key (it was shared in chat).
- **[LATER]** No partial-payment state (fee is all-or-nothing).

### Teams & coaches
- **[FIX] Combat teams undefined** — only 15 V5 teams; combat students unassignable
  until a combat team list is imported.
- **[LATER] `/admin/guardians/new` missing** — the coach "create new guardian" link 404s.
- **[LATER] "Default to prior team"** not wired (prior team only in `triage_notes`).

### Volunteers
- **[LATER]** Clearance steps are admin-attestation only (no APS/quiz integration).

### Data / schema
- **[FIX] `registration_audit_log` is NOT append-only** (unlike the other log tables) —
  grants update/delete to authenticated; should be insert-only.
- **[NOTE] `both` fee policy:** split into two enrollments; fee + fundraising target
  charged once (V5 row), Combat row $0. Confirm intended.

### Not built
- **[LATER] Google / Slack sync** (`sync_log` infra exists, job doesn't).
