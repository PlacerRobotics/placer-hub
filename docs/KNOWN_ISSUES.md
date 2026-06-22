# placer-hub — known issues & implementation notes

Status snapshot as of the current session. Severity: **[BLOCKER]** = needed before
launch · **[FIX]** = real bug, should fix soon · **[LATER]** = polish / not yet built.
"Verified" = confirmed by reading code/DB this session. "History" = from the build
transcript, not re-verified.

---

## Auth & email

- **[BLOCKER] Production email / SMTP** (in progress). Magic links are sent by
  Supabase, not the app, so this is Supabase SMTP config. Gmail SMTP is a dead end
  (personal Gmail can't send from `@placerrobotics.org`; Workspace is rate-limited).
  Recommended: **Resend** (free tier: 3,000/mo, 100/day — split bulk invites across
  2 days to stay under 100/day). Custom SMTP is also what **unlocks email-template
  editing** in Supabase. Verified.
- **[FIX] `/login` shows `{}` instead of the real error** when a send fails
  (`app/login/page.tsx` renders `error.message`, which can be empty/object). Should
  surface the actual Supabase message. Verified.
- **[FIX] `guardian.last_login_at` is never written** in
  `app/api/auth/callback/route.ts`. The login-status dots in `/admin/registrations`
  therefore always read "never logged in." Small fix in the callback. Verified.
- **[LATER] Implicit-flow hardening (optional).** Admin-sent invites use Supabase's
  implicit flow (tokens in URL hash); `/login` now consumes them (fixed this
  session). More secure long-term option: token_hash verify flow — needs a callback
  change **and** an email-template edit. Don't switch templates to `{{ .TokenHash }}`
  without the callback change. Verified.
- **[LATER] Branded email templates** are written (`docs/email-templates/`) but can
  only be pasted into Supabase **after** custom SMTP is enabled.

## Family-facing

- **[FIX] Family dashboard is half-mock.** `app/dashboard/page.tsx` queries guardian
  + financial_aid for real, but the enrollment / waiver / payment / team checklist is
  a hardcoded `CHECKLIST` constant. Families see placeholder rows. Needs wiring to the
  logged-in family's real students/enrollments. Verified.
- **[LATER] Cold sign-in = empty dashboard.** An auth user with no matching
  `guardian.login_email` row has a valid session but no family data (RLS). Fine for
  real invited families (they have guardian rows); just a note. Verified.

## Admin — registrations (deferred medium/low findings from the H1–H3 audit)

High-severity H1/H2/H3 were fixed and deployed this session. These remain:

- **[FIX] Bulk "Send Magic Links" hides per-email failures** — reports "Sent 0
  invite(s)" instead of the real SMTP error. Makes email problems look like a dead
  button. `app/api/admin/registrations/bulk/route.ts` collects `failures[]` but the
  UI ignores it. Verified.
- **[FIX] Unchecked Supabase errors / inflated counts.** Several writes return
  `{ ok: true }` or increment counts even when the write failed (bulk cancel/invite,
  PATCH edits, `lib/admin/reg-audit.ts` swallows its insert error). Verified (audit).
- **[FIX] Invite email source mismatch.** Send paths use `family.primary_email`; the
  UI displays/keys off `guardian.login_email`. If they differ, the invite goes to a
  different address than the admin sees. Verified (audit).
- **[FIX] Reinstate always → `cleared_to_register`**, even if the family was
  `registered` before cancellation (silent demotion; prior state unrecoverable).
- **[FIX] "Last Updated" column is unreliable** — no `updated_at` trigger on
  `family_season`, and cancel/reinstate/bulk don't set it.
- **[LATER] Detail page picks `studs[0]`** for a multi-student family when no
  `?student=` param is passed (only reachable via hand-edited URL).
- **[LATER] Emergency-contact name parsing is lossy** (single-token names become
  `last = '-'`); round-tripping can corrupt stored names.
- **[LATER] Bulk Assign Team doesn't validate program/division** — could place a
  Combat student on a V5 team. No DB constraint enforces it.

## Payments / Zeffy

- **[BLOCKER] Zeffy webhook is a stub.** `app/api/webhooks/zeffy/route.ts` — payload
  shape is guessed, signature check optional. The money→`registration_fee_status =
  'paid'` loop only works via the manual `/admin/payments` tool until reconciled with
  Zeffy's real webhook payload. Verified.
- **[LATER] No partial-payment state.** `registration_fee_status` is only
  unpaid/paid/waived — a payment smaller than the fee still flips it to paid. Fee
  waivers are all-or-nothing. History.
- **[LATER] Zeffy campaign** exists but is unlisted/draft pending review. History.

## Teams & coaches

- **[FIX] Combat teams undefined.** Only 15 V5 teams imported; the 34 combat students
  can't be team-assigned until combat teams exist (need the list → import). History.
- **[FIX] `/admin/guardians/new` is missing.** The coach "create new guardian"
  fallback link 404s. Verified.
- **[LATER] "Default to prior team" not wired.** Returning students' prior team rides
  along only as text in `student_application.triage_notes`; registration doesn't
  auto-assign. History.

## Volunteers

- **[LATER] Clearance steps are admin-attestation only.** No APS/MinistrySafe
  integration or quiz engine — an admin manually marks steps complete. History.

## Data / schema notes

- **[FIX] `registration_audit_log` is NOT append-only** (mig 0018), unlike the other
  log tables (which have BEFORE UPDATE/DELETE triggers). It grants update/delete to
  authenticated. Should be insert-only for a real audit trail. Verified.
- **[NOTE] `both` enrollment fee policy.** A `both` application splits into two
  enrollments at registration (V5 + Combat); the registration fee + fundraising
  target are charged **once** (on the V5 row), Combat row set to $0. Confirm this is
  the intended policy. History.

## Not built / later

- **[LATER] Google / Slack sync** — `sync_log` infra exists, the actual sync job does
  not. History.
- **[LATER] App-sent notifications** — `notification_log` table + `RESEND_API_KEY`
  slot exist, but the app sends no email itself (all auth email is Supabase's).

## Migrations — fully verified this session

All applied: 0012–0019. Two had silently never been applied and were fixed this
session — **0016** (`team_member.revoked_at` + coach roles) and **0017**
(`program_selection 'both'`). 0019 (team_member unique indexes) applied.
