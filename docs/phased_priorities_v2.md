# Placer Hub — Phased Priorities v2

**Status:** Operative planning document. Supersedes the sequencing in the short-term build spec (§12), the lean advisory roadmap, and the external platform assessment where they conflict.
**Date:** 2026-07-10
**Sources reconciled:** short-term build spec, long-term product direction, lean advisory memo, external "blue sky" platform assessment, and direct review of the `PlacerRobotics/placer-hub` repository (code, migrations, `KNOWN_ISSUES.md`, PRD v1.13).
**Success metric (unchanged):** Families, volunteers, and coaches understand their current status and next required action without emailing Placer Robotics.

Each task carries a suggested Claude Code setting: **model / effort**. Legend at the end.

---

## Decision register

Rulings made during reconciliation. If a source document says otherwise, this register governs.

| # | Decision | Ruling |
|---|----------|--------|
| D1 | Volunteer credited-hours display during renewal | **Excluded** (build spec §5.5 governs; lean advisory overruled). Historical hour data is aggregate estimates; displaying it during renewal generates dispute email. Show obligation + clearance only. |
| D2 | Historical import timing | **Split.** Staging import (raw → normalize → match → flag) may run as a background task any time. Family-facing history display deferred to Phase 2. Not on the registration critical path. |
| D3 | Possible-events / availability polling | Deferred to Phase 3 (all sources converge). Confirmed-events-only first, admin-entered. |
| D4 | RobotEvents API sync | **Not in v1 of events.** Admin-entered `team_event` table storing external event ID/URL ships first; API sync added later as a backfill/refresh layer on the same schema. |
| D5 | Capability-based authorization engine (blue-sky §3) | **Deferred.** Hedge: centralize all checks in `lib/auth/roles.ts` (no scattered `if role ===` branches) and add a `scope` column to `admin_role_assignment` so later migration is cheap. |
| D6 | Case management, communication center, family-360 rebuild | Deferred until exception queues demonstrably fail. Both lean documents agree. |
| D7 | Newsletter composition | Never built in the Hub. Hub owns list **membership**; external tool owns composition/delivery. |
| D8 | Newsletter delivery vendor | Zeffy (liked; free; import dedupes by email and auto-tags by import date → send to latest-tag segment) acceptable now with a Hub-generated export. Target state: Resend Audiences/Broadcasts synced nightly (already the transactional vendor in `lib/email.ts`; API supports true sync incl. removals; ~1 day). Delta is small enough to skip straight to Resend if preferred. |
| D9 | Required operational messages | **Never** sent via the newsletter channel (unsubscribe would silently break must-receive mail). Transactional stays Hub→Resend with the all-guardians fan-out rule. |
| D10 | Squarespace list | Kill. Google Groups: internal/staff aliases only; no investment in Groups sync for family mail. |
| D11 | Slack | No auto-provisioning (standard-plan Slack has no public invite API). Design = invite link delivered at the right moment + nightly reconciliation + post-join channel placement via bot (`conversations.invite`). Channel **removal** on drop/transfer goes to admin queue for confirmation, never automatic. |
| D12 | Student director role | Deprioritized (all sources agree: team-scoped, restricted). Immediate one-line change: remove `student_director` from `ADMIN_SECTION_ROLES['/admin']` so it doesn't carry Needs Attention (PII) access in the meantime. |
| D13 | Google Drive / Docs / Calendar / VolunteerLocal | All remain authoritative in their domains this season. Hub is presentation + status layer. Managed resource-link table is the only Drive-related Hub work. |
| D14 | Coach guardian-contact display | Deferred pending a policy decision (spec itself hedges). Coach dashboard ships without it. |

---

## Phase 0 — This week (operational, mostly not code)

| Task | Notes | Model / effort |
|---|---|---|
| 0.1 Flip repo to private | Vercel Pro purchased; confirm the Vercel **project lives under the Pro team** (transfer from personal Hobby scope if needed; verify env vars + domain survive). Push a trivial commit to confirm the pipeline. Note: Pro requires commit authors to be team members — add collaborators before they push. | manual |
| 0.2 Rotate exposed material | Privating does not un-leak. Rotate the Zeffy API key (shared in chat per KNOWN_ISSUES). Regenerate both Slack shared-invite links (were public in `dashboard/page.tsx`); move them out of code into the resource table / env. | manual + Sonnet / low |
| 0.3 Production SMTP + Resend | Supabase magic-link SMTP (the launch blocker); `RESEND_API_KEY` + verified domain in Vercel. | manual |
| 0.4 Env config | `ZEFFY_API_KEY`, `ZEFFY_REGISTRATION_CAMPAIGN_ID`, `APS_API_KEY` (+ `APS_SURVEY_CODE`) in Vercel. | manual |
| 0.5 Import Combat team list | Combat students are currently unassignable (only 15 V5 teams exist). | Sonnet / medium |
| 0.6 Fix `/login` error display | Shows `{}` on failed magic-link send — family-facing failure during peak registration. | Sonnet / low |
| 0.7 **Decide the fundraising deadline** | PRD v1.13 contradicts itself: July 31 (line 358) vs Aug 31 standard (line 75). The dashboard is showing one to families right now. Decide, then fix the PRD. | decision |
| 0.8 PRD "operative spec" cleanup | Confirmed contradictions: `receives_notifications` both removed (l.84) and foundational (l.107/301); deadline conflict above. Matters because AI coding tools will implement the stale paragraph. Archive superseded text; one current-rules document. | Fable / medium |

---

## Phase 1 — Registration & volunteer-renewal window (July → Aug 31)

Renewal runs July 1 – Aug 31 per PRD (`volunteer_renewal_open_at` / `target_close_at`).

| Task | Scope | Model / effort |
|---|---|---|
| 1.1 Status-language pass on family dashboard | Add **"Waiting on Placer Robotics"** and **"Needs attention"** states to student checks + consolidated to-do (states exist in `StepChecklist`; dashboard is binary Ready/In-progress). Smallest change, biggest email reduction. Not a rebuild. | Fable / medium |
| 1.2 **Coach dashboard** (V5/Combat) | New `/coach` route. Assigned teams only (season + team_member scope); restricted roster (name, preferred name, grade, registration + agreement completion); team alerts (registration incomplete, agreement missing, coach clearance expiring, assistant not cleared, roster changed); four-value co-coach clearance visibility (Cleared / Not cleared / Expiring soon / Restricted). **No** guardian contact (D14), no financial data, no event display yet. | Fable / high |
| 1.3 Program-lead scoping (Combat + V5 leads) | Replicate the `iq_coordinator` pattern: `scope` (program) column on `admin_role_assignment`; filter `/admin/teams` and `/admin/registrations` by scope. All checks live in `roles.ts` (D5). | Fable / high |
| 1.4 Volunteer-coordinator queue additions | Expiring-soon and door-access-pending views on the existing `/admin/volunteers` queue. Renewal-window critical. | Sonnet / high or Fable / medium |
| 1.5 **Horizontal-escalation test suite** | `createAdminClient()` (RLS bypass) appears in **26 family-facing files**; app-level scoping is the real enforcement path. Audit every service-role read/write for session-derived `family_id`/`volunteer_id` filtering; write adversarial tests (guardian→other family, coach→other team, read-only→mutation, registrar→financial aid). Long multi-file exploration. | **Fable / xhigh** |
| 1.6 Slack invite + reconciliation | (a) Deliver correct workspace invite link at registration-confirmed / volunteer-cleared, gated by under-13 rule + consent. (b) Nightly job on existing `sync_log` infra: `users.list` vs roster → queue of not-joined (chase), joined-but-dropped (confirm-then-deactivate), under-13 present (flag). (c) Post-join channel placement: match by email (`users:read.email`), `conversations.invite` into team/program channels from roster. Bot only ever adds; removals queue for confirmation (D11). | Fable / high (auth-adjacent) |
| 1.7 Mailing-list mechanism | Per D8: either "Generate mailing list" scoped, audited export (Zeffy path) or nightly Resend Audience sync. The deliverable is the **regeneration mechanism**, not a one-time list update. | Sonnet / medium (export) or Fable / medium (Resend sync) |
| 1.8 Google Groups reconciliation report | v0 = zero-infrastructure: export group CSV from Admin console, script it against `guardian.login_email` / `communication_email` / application emails. Three buckets: in-group-not-in-Hub (**flag**), in-Hub-not-in-group (registered families missing announcements), matched. Exception/allowlist tag for board, mentors, sponsors, alumni. **Flag, don't purge** until after the Aug 31 application cutoff — matching is lossy and pre-applicants are on that list for a reason. Build the Admin SDK nightly job only if the need persists past ~a month. | Sonnet / medium |
| 1.9 `student_director` access tightening | Remove from `ADMIN_SECTION_ROLES['/admin']` (D12). | Sonnet / low |
| 1.B Background: historical staging import | Raw rows → normalize → match canonical students → split programs → resolve schools → flag ambiguous → reconciliation counts. Preserve source file/sheet/row, original + normalized value, batch, confidence, review state. No family exposure yet (D2). Do not import derived tabs (Headline, Crossover, Retention, Org Health) as facts. | Fable / medium |

---

## Phase 2 — Early season (Aug → Sept)

1. **Confirmed team events, admin-entered** (D3/D4): `event` + `team_event_registration` schema with external RobotEvents ID/URL stored from day one; statuses Registered / Waitlisted / Cancelled / Removed; display on family + coach dashboards; "View official event details" link; no narrative content copied from events.vex.com. — Fable / high (schema) then Sonnet / medium (display)
2. Family-facing historical summary from reviewed staging records (Season — Program — Team only; nothing uncertain or sensitive). — Sonnet / medium
3. Handbook: prominent link + curated topic links + **contextual links** from onboarding steps (payment→fees section, volunteer→expectations, etc.). No CMS. Lightweight Google Doc→HTML publisher only if it costs nothing schedule-wise. — Sonnet / medium
4. Managed resource-link table (title, URL, program, audience, active, last-reviewed) replacing hardcoded links (incl. the Slack/Drive constants currently in `dashboard/page.tsx`). — Sonnet / medium
5. Announcements (simple org/program/team posts) + drop/transfer request form feeding the registrar queue. — Fable / medium
6. Migrate newsletters fully to the D8 vendor; final Google Groups purge of unmatched flags after the Aug 31 cutoff. — manual + script

## Phase 3 — Tournament planning (Sept → Oct)

1. Possible events + family/coach availability collection (Considering / Seeking availability / Planning to register / Registered / Waitlisted / Declined / Cancelled); program-lead decision matrix; promotion to confirmed events. — Fable / high
2. Calendar subscription feeds (Google/Apple/Outlook ICS), source-labeled. — Fable / medium
3. RobotEvents API sync as idempotent backfill/refresh on the Phase 2 schema; admin sync-health view; API failure never erases confirmed records. — Fable / high
4. Season-config hardcoding cleanup (`SEASON`, `$40`, `$550` fallbacks in `dashboard/page.tsx`) ahead of rollover. — Sonnet / medium

## Deferred until pain proves need (all sources agree)

Case management · communication center · capability-based authz engine · native volunteer shifts / hour ledger / VolunteerLocal replacement · attendance · asset tracking · IRL snapshots (admin-triggered, minimal-field design already specified in long-term doc §6) · handbook CMS · advanced reporting · season-rollover wizard.

---

## Open decisions for Kevin

1. Fundraising deadline: July 31 or Aug 31 (Phase 0.7 — this week).
2. Coach guardian-contact policy (unblocks the deferred half of 1.2).
3. Newsletter vendor: Zeffy-with-export vs. straight to Resend Audiences (D8).
4. Repo visibility long-term: private now works on Pro; if ever re-publicized, secrets/link hygiene must be re-audited.

## Model / effort legend

Per Anthropic guidance: **high** is the Fable 5 default; **xhigh** for extended multi-file agentic exploration; lower effort on Fable still performs well (often above prior models' max). Reduce effort when tasks complete correctly but slowly; use the `ultrathink` keyword for a one-off deeper turn instead of changing session effort; skip **max** (session-only, marginal gains). Sonnet at high effort is the economical choice for spec-driven, bounded builds — this document is the spec. Effort scales are calibrated per model; re-check after switching models. Ref: https://platform.claude.com/docs/en/build-with-claude/effort
