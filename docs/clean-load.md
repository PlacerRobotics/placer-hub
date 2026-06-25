# Clean load runbook (2026-27)

Wipe all test data and reload from the real files. Order matters because of schema
dependencies (a student can't be on a team until they're enrolled; a coach must exist
before a coach row; a registration's team reference must resolve to an existing team).

**Order:** Teams → Returning registrations → Applicants → Volunteers → send invites → onboard.

All importers **create records only** — they never send magic links. All match/de-dupe
by `guardian.login_email`, so the same person across files collapses into one guardian.

---

## Phase 0 — Wipe (destructive)

```
node scripts/wipe-user-data.mjs                      # dry run — prints what WOULD go
node scripts/wipe-user-data.mjs --yes-wipe-production # actually wipe
```

- **Preserves:** every admin (anyone with an `admin_profile`) + their auth users/roles,
  and seed data (`season_config`, `school`, `waiver_template`). The dry run prints the
  exact admins preserved — review it. (If you want a non-super admin gone too, revoke
  them on `/admin/admins` and delete their profile before/after; the wipe keeps all admins.)
- **Deletes:** all families, registrations, teams, volunteers, sponsors, payments, logs,
  and every non-admin auth user.

After wiping, re-confirm the super-admins via the bootstrap script if needed:
```
node scripts/bootstrap-super-admins.mjs kevin.miller@placerrobotics.org vivek.vishist@placerrobotics.org amity.chavez@placerrobotics.org vasu.vallurupalli@placerrobotics.org
node scripts/bootstrap-super-admins.mjs <iq-coordinator@placerrobotics.org> --role=iq_coordinator
```

---

## Phase 1 — Teams  →  `/admin/import-teams`

One combined file (IQ + V5/Combat). Set `active = true`/yes so they show in dropdowns.
Coaches listed here are created as guardians and attached as coaches; they fill in fully
if/when they register (matched by email).

| column | notes |
|---|---|
| `program` | `vex_v5` / `vex_iq` / `combat` |
| `team_number` | e.g. `12345A` (used to match registrations' team reference) |
| `team_name` | optional |
| `school_org` (or `org`) | required |
| `division` | `ES` / `MS` / `HS` |
| `team_fee_amount` | optional |
| `coach_first_name`, `coach_last_name`, `coach_email`, `coach_phone` | optional coach |
| `notes` | optional |

---

## Phase 2 — Returning registrations  →  `/admin/import`

Staged as **cleared_to_register, not yet invited** (they show in "Registrations to send").
The **household address loads onto the family** (and the student). If `team_26_27` matches
a Phase-1 team (by number, then name), it's stored as a pointer so the student is **auto-
placed on that team when they register**.

| column | notes |
|---|---|
| `guardian1_first`, `guardian1_last`, `guardian1_email`, `guardian1_phone` | required email |
| `guardian2_first`, `guardian2_last`, `guardian2_email`, `guardian2_phone` | optional |
| `student_first_name`, `student_last_name`, `student_email`, `student_phone` | |
| `street_address`, `street_address_2`, `city`, `state`, `zip` | city + zip required |
| `grade_fall_2026` | required |
| `school` | free text |
| `tshirt_size` | xs–xxl or Small/Medium/Large |
| `program_26_27` | `vex_v5` / `combat` / `vex_iq` / `both` |
| `team_26_27` | team number or name (→ auto-placement pointer) |
| `employer_match` (`yes`), `employer_match_company`, `employer_match_pct` | optional |
| `notes` | optional |
| `import_action` | `invite` (→ cleared_to_register) or `hold` (→ applied) or `skip` |

---

## Phase 3 — Applicants  →  `/admin/import-applicants`

New applicants needing review (status `applied`). Uses the application-form headers:
`Student First Name`, `Student Last Name`, `Student Email`, `Student Phone Number`,
`Date of Birth …`, `Grade Entering (Fall 2026)`, `School Attending (Fall 2026)`,
`Home Address (City, State, ZIP)`, `Parent/Guardian First/Last Name`,
`Parent/Guardian Email`, `Parent/Guardian Phone Number`, `Review Status`.

---

## Phase 4 — Volunteers  →  `/admin/import-volunteers`

`first_name`, `last_name`, `email`, `phone`, `status` (e.g. `cleared`/`pending`),
`is_returning`, APS: `aps_user_id`, `aps_external_id`, `aps_cert_expiry`, `aps_score`,
quizzes: `rc_quiz_passed(+_date/_score)`, `yp_quiz_passed(+_date/_score)`,
`doj_cleared`, `has_door_access`, `door_access_type`, `street_address`/`city`/`state`/`zip`,
`notes`. Matched to an existing guardian by email; volunteer-only people get a minimal
guardian + family.

---

## Phase 5 — Send & onboard

- **Families:** `/admin/registrations` → select the cleared / not-invited rows → **Send
  Magic Links**. They register → enrollments created → team pointers materialize into
  `team_member` automatically.
- **Coaches / admins:** send sign-in links (admins via `/admin/admins`).

---

## Verification (after load)

```sql
select status, count(*) from family_season where season='2026-27' group by 1;     -- cleared_to_register / applied counts
select program, count(*) from team where season='2026-27' group by 1;             -- team counts
select count(*) from volunteer_profile;                                            -- volunteers
select count(*) from family where street_address is not null;                      -- families w/ address
-- after some registrations: students auto-placed on teams
select t.team_number, count(*) from team_member tm join team t on t.id=tm.team_id
  where tm.team_role='student' and tm.revoked_at is null group by 1 order by 1;
```
