# PRD — IQ Teams Dashboard v2 + Registrations key indicators (proposed)

**Status:** PROPOSED — not scheduled, no code written. For review by Kevin / IQ Coordinator / Registrar.
**Date:** 2026-07-11
**Owner surfaces:** `/admin/iq-teams` (+ `/admin/iq-teams/members`, `/admin` Needs Attention); §7 extends the same pattern to `/admin/registrations`
**Primary users:** IQ Coordinator (single-purpose role; their admin home IS the IQ page — `adminHome()` sends `iq_coordinator` straight here because they have no `/admin` access); registrar for §7

---

## 1. Problem

1. **The topline numbers are buried.** Team counts ("20 teams · 0 pending payment · 8 pending approval · 12 active") render as one line of muted subtitle text under the page title. They are the coordinator's most important numbers and are the hardest thing on the page to see.
2. **No filtering or search.** The table sorts by column but cannot be filtered or searched. Tolerable at 20 teams; the pain grows with the roster, and some questions are slow even today.
3. **"Which team is this student on?"** is a real, recurring question with no fast answer. Student names aren't in the teams table at all — you have to open the Members page and scan.
4. **No IQ-specific "needs attention."** The org-wide `/admin` Needs Attention page is (a) invisible to the IQ Coordinator (no `/admin` access) and (b) contains nothing IQ-specific anyway. The coordinator has no "what do I need to do today" view.
5. **Registrations vs roster is undefined.** Once teams are paid/approved, the coordinator's job shifts from *getting teams registered* to *managing the roster* (kids, waivers, drops, transfers). The UI doesn't acknowledge that shift — both jobs share one table.

## 2. Current state (verified against code, 2026-07-11)

- `/admin/iq-teams/page.tsx`: one table (`IqTeamsTable`), sortable columns, bulk actions, Zeffy sync button. Counts appear only in the `PageHeader` subtitle string.
- IQ roster is **not** `team_member`: students attach to IQ teams via `student_application.triage_notes` pointers (`iq_team:<uuid>`), with `drop_requested` / `dropped` markers in the same field. Waiver state = `waiver_signature` rows; registered = `enrollment.submitted_at`.
- `/admin/iq-teams/members`: per-student rows (name, grade, contacts, team, coach, waiver/registered flags) — this is already half of a "roster" surface.
- `/admin` Needs Attention: six org-wide queues (applications, aid, invites, unpaid, unmatched payments, sync failures). None IQ-scoped; `iq_coordinator` can't open it.
- Team statuses: `pending_payment → pending_admin_confirmation → active` (+ `suspended`). Fee = $1,200/team, partial payments visible via `payment_transaction.team_id`.

## 3. Goals

- The coordinator sees status totals and money-at-a-glance within one second of landing.
- Every "what needs me today?" item is on this page — they never need `/admin`.
- Any student's team is findable in under five seconds by typing a name.
- The registrations→roster shift is explicit in the UI, not implied.

**Non-goals:** no schema changes; no coach-facing changes; no auto-actions (approvals, removals stay manual); no change to who may access IQ pages.

## 4. Proposed changes

### 4.1 Stat cards (replaces the subtitle numbers)

A card strip at the top of `/admin/iq-teams`, matching the pattern already used on `/admin/volunteers`:

| Card | Value | Color cue |
|---|---|---|
| Teams | total | neutral |
| Pending payment | count + $ outstanding (`$1,200 × n − partials received`) | amber |
| Pending approval | count | blue |
| Active | count | green |
| Students | total across teams (+ "n waivers missing") | amber if any missing |
| Fees collected | `$X of $Y` — Zeffy + manually recorded checks (per ruling below) | green when equal |
| Checks pending deposit | count + $ of check payments with no `deposited_at` (column exists, migration 0031) | amber whenever > 0 |

**Cards are also filters** (see 4.3): clicking "Pending approval" filters the table to those teams. One mechanism, two problems solved.

### 4.2 "Needs attention — IQ" strip

A queue list directly under the stat cards (same `NeedsAttentionQueue` component as `/admin`), IQ-scoped. Proposed queues, all derivable from existing data:

1. **Ready to approve** — `pending_admin_confirmation` teams with roster ≥ 3 and fee `paid`. The coordinator's most actionable item; today it must be deduced from two columns.
2. **Drop requests** — students whose `triage_notes` contain `drop_requested`. Ruling (2026-07-11): a queue item the coordinator explicitly **confirms**. Requests may originate from the family (exists today via the dashboard), from a coach, or be entered manually by the coordinator when the ask arrives out-of-band — all three paths land in this same queue. Confirming a drop **notifies the family by email** and is **reversible** (an undrop restores the roster pointer; the audit trail keeps both events).
3. **Stalled on payment** — `pending_payment` teams created more than 14 days ago (age already on the row).
4. **Waivers missing on active teams** — active-team students without a `waiver_signature` this season.
5. **Coach never signed in** — teams whose coach has `last_login_at` null (signal already computed for the table).
6. **Coach not cleared** — IQ coaches are youth-facing volunteers; join coach → `volunteer_profile` → the same four-value view built for task 1.2 (`coachClearanceView`), and flag Not cleared / Expiring soon. *This is the one queue pulling in a new data source, and arguably the most important child-safety indicator on the page.*

Optionally, add queues 1, 2, and 6 (with counts) to the org-wide `/admin` page too — other admins with IQ visibility benefit, and it costs nothing once the counts exist.

### 4.3 Filtering + student search

- **Status filter chips** driven by the stat cards (All / Pending payment / Pending approval / Active / Suspended).
- **One search box** over the teams table matching: team number, team name, kit number, coach name, coach email, **and student names**. Student names per team are one extra join at page load (the Members page already fetches them). When the search matches a student, the row shows a "matched: *Ada Lovelace*" hint so the answer to "which team is Ada on?" is the visible row itself.
- Search and filter compose (e.g., Active + "lovelace").

### 4.4 Registrations vs. Roster (naming + tabs, not new pages)

The distinction the transcript reaches for is a **lifecycle phase**, and the two existing pages already split along it — they're just not framed that way:

- **Registrations phase** (getting a team to `active`): team-level work — fee, approval, events.vex registration. This is `/admin/iq-teams` today.
- **Roster phase** (running the season): student-level work — who's on which team, waivers, drops, transfers, contact/emergency info. This is `/admin/iq-teams/members` today, reachable only by a small header link.

Proposal: present the two pages as **tabs on one surface** — "Teams" and "Roster" — and rename Members → Roster. The Roster tab gains the same search box (name → team is its core question) plus filter chips for its own exceptions (waiver missing, not registered, drop requested). Once most teams are active, the coordinator lives in Roster; the tab framing makes that shift legible without inventing a new lifecycle model or touching the data layer.

### 4.5 Explicitly out (needs a decision first)

- Migrating IQ roster membership from `triage_notes` pointers to real `team_member` rows. Correct long-term, but a data migration mid-season is risk without user-visible payoff; everything above works on the current representation. Revisit at season rollover.

## 5. Data & implementation notes

- **No migrations.** Every queue and card derives from tables already read by these two pages; the only new joins are student names into the teams page and coach→volunteer clearance (both cheap at this scale).
- Reuse: `NeedsAttentionQueue` (from `/admin`), stat-card pattern (from `/admin/volunteers`), `coachClearanceView` (from `lib/volunteer-buckets.ts`, task 1.2), existing role gate (`iq_coordinator`, super, payment, registration — unchanged).
- Estimated effort: **Fable / medium** — one PR for 4.1–4.3, a second small PR for 4.4 tabs + Roster filters.

## 6. Decisions (resolved with Kevin, 2026-07-11)

1. **Stalled on payment = 14 days.** Roster minimum stays 3.
2. **Both.** The org-wide `/admin` page gets the IQ queues *and* the IQ page keeps its
   self-contained strip — `/admin` grows toward an organizational process-health
   dashboard; the IQ page stays sufficient on its own for the coordinator.
3. **Fees collected includes manually recorded checks.** Additionally, distinguish
   checks **collected** from checks **deposited**: `payment_transaction.deposited_at`
   already exists (0031) — surface a "Checks pending deposit" card/highlight so a
   collected-but-undeposited check is visible instead of misplaceable. (Requires the
   record-check flow to reliably set `deposited_at` on deposit — verify and add the
   affordance if missing.)
4. **Drop requests are a confirm queue** with three intake paths (family, coach,
   coordinator manual), family email notification on confirm, and reversibility.
   Full spec folded into §4.2 item 2.

## 7. Extension — the same pattern on `/admin/registrations`

The registrar's page has the inverse problem from IQ Teams: it already has **nine filter
dropdowns plus text search** (status, program, division, team, school, invite-sent,
logged-in, fundraising, payment) but **no summary** — you can slice the data any way you
want, yet nothing tells you which slice needs you. `/admin` Needs Attention has two of
these counts (invites to send, unpaid), but it's a different page and a coordinator-style
"see the number → click it → see the list" loop doesn't exist.

### 7.1 Clickable stat cards above the table

One card strip; **each card is a one-click preset of the filters that already exist** —
no new filtering machinery, clicking a card just sets the corresponding dropdown state
(and clicking it again, or "All", clears it). Because the cards compute from the same
`rows` array the client manager already holds, they respect program-lead scoping (task
1.3) for free — a Combat lead's cards count only Combat rows.

Proposed cards, in funnel order (all derivable from existing `RegRow` fields):

| Card | Definition (existing filter preset) | Cue |
|---|---|---|
| Students | all rows | neutral |
| Awaiting invite | status `cleared_to_register` + invite not sent (`fMagic`) | blue — registrar action |
| Invited, not registered | status `cleared_to_register` + invite sent | amber — family action, nudgeable |
| Registered, unpaid | status `registered` + payment `unpaid`/`partial` (`fPay`) | amber |
| Paid | payment `paid`/`waived` | green |
| No team yet | `teamId` null (needs a team filter option "unassigned" — small addition) | blue |
| Fundraising not selected | `fundraisingMethods` empty (`fFund`) | amber |

Cap the strip at ~7; "Never logged in" stays a dropdown-only filter (diagnostic, not a
queue). Counts on the cards double as the status summary the subtitle can't convey.

### 7.2 What this is NOT

- Not a replacement for `/admin` Needs Attention — that page stays the cross-section
  triage for all admins; these cards are the registrar's in-page working view.
- No new queries, no schema change, no server work at all: the cards are a client-side
  render over data the page already ships. Smallest task in this PRD (Sonnet / low–medium).

### 7.3 Registrations decisions (resolved with Kevin, 2026-07-11)

1. **Ship the seven cards as proposed** — revisit the set after the registrar has used
   them ("okay for now, have to look through it").
2. **Yes, cards stack**: a card presets only its own dimension and composes with any
   active program/school/other filter.
