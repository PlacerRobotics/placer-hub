# PLACER ROBOTICS
## Volunteer & Student Registration Platform
### Product Requirements Document / Build Specification
**Version 1.13 — Full Scope Specification / Staged Release Plan**

| Field | Value |
|---|---|
| Organization | Placer Advanced Robotics and Technology, dba Placer Robotics |
| Document Type | Product Requirements + Implementation Specification |
| Season | 2026–2027 |
| Version | 1.13 |
| Status | Build Ready — Pre-Implementation |
| Owner | Kevin Miller, Executive Director |
| Classification | Confidential — Internal Use Only |

---

## 0. Version History

### v1.13 Changes (this version)

Comprehensive review pass. All changes based on Kevin Miller's direct operational review of v1.12.

**Organization:**
1. Executive summary updated — nearly 300 students, 10+ events/year.

**Financial aid:**
2. Financial aid v1 uses existing Google Form, linked from registration form. Platform does not build a financial aid form in Release 1. Registration admin can see a pending indicator if a request exists. Financial Aid Admin resolves off-platform. Future release builds it in-platform.

**Application and fast-track:**
3. Admin waiver process clarified — admin creates `admin_waived` application record via platform, mandatory notes, magic links sent immediately.
4. Mass CSV import tool specified as admin dashboard feature — column spec in ETL spec companion document. Handles returning students, IQ→V5 transitions, known new students. Creates `admin_waived` records and sends magic links.
5. Application requirement clarified — returning students in good standing do not need to reapply each season. Admin fast-tracks them via CSV import or individual waiver. New students always apply.

**IQ coach flow corrected:**
6. Coach creates family account first (standard registration), then initiates IQ team creation from within their authenticated dashboard. Not a public unauthenticated form.
7. Sequence: family account → IQ team creation request → admin (IQ Coordinator) accepts → coach pays $1,200 fee → magic links sent to parent emails → coach clearance runs in parallel.
8. $1,200 IQ team fee is NOT a donation — direct benefit to specific students. Taxable. Must be clearly labeled in Zeffy and all communications. Zeffy automatic receipts disabled for IQ team fee campaign.

**Registration terminology:**
9. "Enrollment" replaced with "registration" throughout UI-facing language. One registration per student per season. "Enrollment" implies a class/course — PART is not a class.

**V5 coach assignment:**
10. V5 and Combat coaches are admin-assigned, not self-selected. Admin assigns primary and optional secondary coach each season. Both are stored in `team_member` with appropriate roles.

**Team identifiers:**
11. Team number may be assigned before or after GRSF confirmation — not mandated to wait. Admin assigns when ready.
12. V5/IQ teams: team number is primary identifier (format 295A, 295B, 9537A for Cavitt). Team name optional.
13. Combat teams: pod name is the identifier, no number. Creative name chosen by team.
14. Constraint: at least one of `team_number` OR `team_name` must be non-null per team.
15. Slack channel name stored on team record, admin-managed. Format: `vex-295a`, `vex-295b`, `vex-9537a` (Cavitt), `combat-[podname]`. Stored on team, not auto-generated.

**Email model simplified:**
16. Guardian email fields reduced to three: `login_email` (required, unique), `communication_email` (optional alternate), `slack_email` (optional, for Slack invite targeting). All other email fields removed from guardian.
17. `fusion_education_email` retained on student record only.
18. `volunteerlocal_email` removed entirely — VolunteerLocal has no usable API.
19. Slack email: once set, changes require admin action (Slack API cannot rename/merge accounts). Warn users on first set.

**Student email and school domain:**
20. Registration form must warn (not block) when student email appears to be a school domain. Warning: "School email addresses are often blocked — we recommend a personal email your student checks regularly." Show confirmation prompt if they proceed.

**T-shirt size:**
21. Registration form shows prior season t-shirt size pre-filled with prompt to update: "This is the size from last season — update if your student has grown."

**Season config UI:**
22. `season_config` requires an admin UI layer in the platform. Super Admin configures dates, fees, thresholds through the portal — not directly in the database.

**Donation receipts:**
23. Zeffy handles donation receipts automatically — toggle enabled on fundraising campaigns. PART does not need to build receipt generation. IQ team fee campaign: toggle disabled (not a donation).

**Zeffy campaign definition:**
24. Two Zeffy campaigns required: (a) student fundraising — automatic receipts ON, payment reference code in custom field; (b) IQ team fee — automatic receipts OFF, team identifier in custom field.

**Fundraising deadline:**
25. August 31 as standard fundraising deadline. Configurable in `season_config.fundraising_deadline`. Series of email reminders leading up to deadline. Families who do not meet target flagged for admin/steering committee follow-up.

**VolunteerLocal:**
26. `volunteerlocal_email` removed from schema. VolunteerLocal has no API. Field not stored, not exposed in UI.

**Service area:**
27. No service area gating. Removed from functional requirements. Open to any student who can participate at the required level.

**Notification opt-out:**
28. `receives_notifications` field removed. All guardians always receive all notifications. No opt-out.

**Family display name:**
29. `family.display_name` added — derived from Guardian 1 last name (e.g. "Miller Family"), editable by admin. Display label only, not a database key.

**ETL and migration:**
30. ETL migration spec (`etl_migration_spec_v1_0.md`) added as companion document. Covers full column-by-column mapping from 25-26 RegData, Payment Log, Dropped Students, Slack/DL email mapping sheets, and Return Status sheet.
31. Dropped Students: `student.status = withdrawn`, no 26-27 records created.
32. Guardian 2 email same as Guardian 1: update role to `single_guardian`, no duplicate guardian record.
33. ZIP code normalization: cast float to int, zero-pad to 5 digits.
34. `data_only=True` required for Payment Log and Submission ID fields.

**Admin roles:**
35. Steering committee role added. Program leads (V5 Program Lead, Combat Program Lead) get scoped access to their program data. Roles to be fully defined in a subsequent release.
36. Registrar handles both registration admin and payment admin functions — these may be the same person.

**Build timeline:**
37. Registration live ASAP — target days, not weeks. Full platform by September 1, 2026.

### v1.12 Changes (prior version)

Guardian model expanded (dual login, address, emergency_contact table), volunteer migration finalized, application_source enum.

1. **Guardian model expanded.** Both guardians can authenticate independently via magic link. Both receive all notifications by default. `can_authenticate`, `receives_notifications`, `street_address`, `city`, `state`, `zip_code`, `last_login_at`, `relationship` added to `guardian` table. `single_guardian_duplicate` role removed — replaced with `single_guardian`. `guardian_role` enum updated.

2. **Dual login implemented.** Magic link auth resolves against all guardian email addresses in the family, not just the primary email. Either parent can log in independently and sees the same family dashboard. Divorced parents each get full independent access.

3. **Notification fan-out rule established.** All notifications go to ALL guardians where `receives_notifications = true`. Default true for all guardians. This is a foundational rule — no notification ever goes to only one parent.

4. **Same-address UX specified.** Application and registration forms default Guardian 2 address to same as Guardian 1 with one checkbox. Unchecking reveals separate address fields. Zero friction for typical households, full flexibility for divorced families.

5. **`emergency_contact` table added.** Separates emergency-only contacts (grandparents, aunts/uncles called in emergencies) from guardians with program involvement. Emergency contacts have no portal access, no notifications — just name, phone, relationship, call priority.

6. **Student address extended.** Added `student.street_address` and `student.state` to complement existing `city` and `zip_code`. Student record = primary residence.

7. **Guardian address added.** Each guardian has their own address fields. Divorced families store different addresses per guardian. Used for emergency contact purposes and mailing.

8. **Volunteer migration finalized.**
   - Column mapping from volunteer sheet confirmed.
   - IQ/V5 coach columns not migrated — handled via team schema.
   - Mandated Reporter Training columns ignored — no longer accepted.
   - APS score not stored.
   - Guardian address not migrated from volunteer sheet.
   - `include_in_migration` column required before ETL runs — Kevin scrubs list manually.
   - All migrated volunteers get `policy_acknowledgment` step = pending.
   - Migration summary report includes cert expiration analysis (expired, expiring before May 31, valid).
   - UniFi not automated yet — admin handles manually based on report.
   - Volunteers with no students get standalone `family` + `guardian` records, no `family_season`.

9. **`application_source` enum formalized** in prior version — confirmed correct.

10. **`guardian_role` enum cleaned up.** `single_guardian_duplicate` removed. Roles: `primary | secondary | single_guardian | extended_family | other`.

### v1.11 Changes (prior version)

Live application sync model, Phase 1/Phase 2 migration, field mapping from Google Form to schema, August 31 cutoff.

1. **Live application sync added (Phase 1 — now through August 31).** The existing Google Form and Sheets-based application process is retained for the 2026-27 application season. A scheduled sync job reads from the Google Sheets registration sheet and upserts records into Supabase on a schedule. The new platform admin dashboard surfaces all applications including synced ones. Hard cutoff: August 31, after which the form is retired and all new applications go through `/apply` on the platform.

2. **Field mapping defined.** Complete mapping from current Google Form fields to new schema documented in Section 19 (Sync and Migration). Best-effort mapping with admin-flagged records for ambiguous fields.

3. **Student email sync policy.** Student email from the Google Form is synced directly to `student.communication_email`. Parent consent is collected properly at registration — family may review and remove it then. No consent flags set on synced records until registration consent flow is completed.

4. **`family_season` sync policy.** Sync job creates `family_season` records with `status = applied` and `season = 2026-27` for each synced applicant.

5. **Phase 1/Phase 2 migration model added.** Phase 1: live sync from Sheets. Phase 2: platform takes over, sync job decommissioned at August 31 cutoff.

### v1.10 Changes (prior version)

Financial aid gate eliminated, volunteer clearance corrected, UniFi integration added, IQ team creation corrected, IQ Coordinator role added.

1. **Financial aid gate eliminated.** The mandatory pre-registration financial aid prompt and registration lock are removed entirely. Financial aid is now a self-service request accessed via a link/callout within the registration form. Registration never locks for financial aid. Admin may adjust enrollment records retroactively after a request is submitted. `family_season.status = pending_financial_aid` removed from the status lifecycle.

2. **Admin program confirmation at acceptance.** When an applicant selected both programs or Not Sure, admin confirms or selects the final program at acceptance time, not as a separate post-acceptance step.

3. **Returning flows reframed as student-centric.** Returning flows are about returning students, not returning families. Each new student must apply. "Add sibling" removed as a self-service family action — siblings apply through the standard application flow. Adding a program requires admin pre-approval, not family self-service.

4. **Data migration elevated to Release 1 / Task 2a.** 2026 applications are mostly already in Sheets. Migration runs early in the build as part of Release 1, not at the end.

5. **Volunteer clearance corrected.**
   - Step 0 (volunteer role interest) removed — not part of the volunteer clearance process.
   - Policy acknowledgment (written confirmation for insurance) added as a required step in initial clearance.
   - Quiz framework designed to support additional quizzes beyond two current ones.
   - Cert expiry: volunteer loses door access and cannot supervise. Does NOT remove from Google Groups or Slack. This was incorrect in prior versions.
   - After auto-clearance: UniFi door credential provisioning via API (not a manual task).

6. **UniFi Access API integration added.** Credential provisioning on volunteer clearance, access revocation on cert expiry. API key server-side only. Confirm exact endpoints against specific controller before coding. CVE-2025-52665 noted — integration must be scoped minimally and never client-side.

7. **IQ team creation corrected.**
   - No division selection field — currently elementary school only.
   - No school name field — removed.
   - Coach provides: coach name, student first/last names, and parent email addresses for each student.
   - Magic links sent to parent emails (never student emails) after IQ Coordinator review/confirmation.
   - Admin (IQ Coordinator role) creates/updates team in events.vex.com — not the coach.
   - Financial aid: available as self-service request, never a gate.

8. **IQ Coordinator role added** as a named admin role variant for volunteer clearance and IQ team management workflows.

### v1.9 Changes (prior version)

Full UX/platform layer: Vercel, hub.placerrobotics.org, design system, Tasks 1.5/1.6, Goldman/Inter typography, color tokens, UX guardrails.

1. **Hosting platform changed from Netlify to Vercel.** Vercel is the deployment platform for this Next.js application. Netlify references replaced throughout.
2. **Production domain set to `hub.placerrobotics.org`.** Marketing site (placerrobotics.org) remains separate on Squarespace. IRL site remains separate.
3. **UX requirements document added as companion.** `ux_requirements_v1_0.md` is now a required companion document. No product screen shall be implemented until design system (Task 1.5) and static wireframe (Task 1.6) exist.
4. **Tasks 1.5 and 1.6 added to Codex build plan.** Design system and UX shell before any product screens. Static wireframe routes before data wiring.
5. **20 UX guardrails added** to developer guardrails (items 33–52) from UX requirements document.
6. **Typography specified.** Inter throughout the portal. No Goldman 1 in portal UI (Goldman 1 reserved for event/camp marketing materials).
7. **Design system and color palette added to PRD.** Core platform colors, functional status colors, program accent colors, and color usage rules now in spec.
8. **BR-025 updated.** Production infrastructure requirement now specifies Vercel.

### v1.8.1 Changes (prior version)

Schema corrections: family_season, team_member canonical, financial_aid expanded, payment_transaction unique constraint, APS reinstatement scope, sync_active flags, program=both removed, enrollment.team_id removed.

Schema corrections and model completeness pass based on external review. All changes are structural — no business rule decisions reversed.

1. **`family_season` table added.** Family-level season state (status, volunteer hours, notes) separated from permanent family record. Resolves ambiguous family-level gates for multi-student families.
2. **`family.payment_reference_code` removed.** Payment reference codes belong to `enrollment` and `team` records only.
3. **`family.status` simplified to account-only states.** `prospect/applied/registered` removed from family — those live in `family_season`, `student_application`, and `enrollment`.
4. **`program = both` removed from `program_selection` enum.** Students in multiple programs get one enrollment per program. Cleaner for billing, rosters, and future program variants (Combat PLANT, HS V5, etc.).
5. **`enrollment.team_id` deprecated.** `team_member` is now the canonical team assignment table. `enrollment.team_id` removed.
6. **`financial_aid` schema expanded.** Added `original_fundraising_target`, `fundraising_waived_amount`, `registration_fee_waiver_requested`, `registration_fee_waived`, `registration_fee_waiver_reason`, `registration_fee_waiver_admin_id`. Removes ambiguity between fundraising aid and fee waiver.
7. **`unique(source, source_payment_id)` constraint added** to `payment_transaction`. Prevents webhook/polling duplicate rows.
8. **APS webhook reinstatement scoped to `expired` only.** APS completion webhook may not reinstate `suspended` volunteers. Suspended volunteers require Super Admin action.
9. **APS threshold normalized.** Renewal required if `cert.expiration_date <= season_config.program_year_end`. Consistent throughout.
10. **Renewal open date normalized to July 1** everywhere. "Early August" references removed.
11. **`sync_active`, `registration_active`, `program_year_active` added to `season_config`.** Three independent flags control group sync, registration window, and active competition year. Prevents premature Google Group removal during season transitions.
12. **Student-authored application language corrected.** Parent/guardian is the submitting user. Section 3 answers should be in the student's own words — parent certifies authorization.
13. **GPA language normalized.** "Minimum GPA required" changed to "flagged for admin review — not auto-declined" everywhere.
14. **Organization account holder policy added.** `@placerrobotics.org` accounts assigned to minors require parent/guardian acknowledgment before activation. Addressed as a go-live operational requirement, not a system-enforced flow (provisioning happens in Google Workspace).
15. **Integration section 12.6 corrected.** events.vex.com checklist applies to V5 and IQ team records, not IQ only.
16. **Open question removed.** "Any scenario where $40 fee is automatically waived?" — answer is already in the spec: no automatic waiver. Super Admin manual override only.
17. **Release model introduced.** Full schema built from day one; Codex task sequence organized into six staged releases to reduce launch risk.
18. **Data migration moved earlier** in Codex build plan (Release 1, after schema/RLS).

### v1.8 Changes (prior version)

Returning family flows, IQ to V5 transition, volunteer renewal calendar, APS gate logic.


1. **Returning family flows fully specified.** Six distinct returning paths: same program/same team, same program/switch team, add a program, switch program, add a sibling, IQ to V5 transition. All returning families re-apply for financial aid and sign new waivers each season. Team assignment defaults to prior season team, admin updates.

2. **IQ to V5 transition confirmed as full re-application.** No automatic shortcut. Admin may use admin_waived path for known students.

3. **Volunteer renewal calendar fully specified.** `volunteer_renewal_open_at` and `volunteer_renewal_target_close_at` added to `season_config`. Standard: July 1 open, August 31 target. Configurable per season.

4. **APS expiration and renewal gate logic fully specified.** Early warning ~June 1 to volunteers whose cert expires before May 31. Renewal flow blocked from completion until APS webhook received when re-enrollment required. Auto-expire on cert expiration date. Auto-reinstatement on APS webhook. Early warning to volunteer only.

5. **FR-RENEW updated.** Renewal completion explicitly blocked if APS required and not complete. FR-RENEW-000 added for early warning. `season_config` fields added.

6. **BR-013 (Returning Families) expanded.** Full returning-family business rules now in spec.

### v1.7 Changes (see v1.7 document)

1. **events.vex.com registration requirement corrected to include V5.** Prior versions listed this as IQ-only. VEX V5 teams also require events.vex.com registration. Combat teams do not. `events_vex_com_registered` field on `team` table now applies to `program IN (vex_v5, vex_iq)` only.

2. **Coach onboarding workflow fully specified.** Three paths: IQ coach (self-service team creation + $1,200 fee + events.vex.com), V5 coach (admin-assigned + events.vex.com), Combat manager (admin-assigned, no external requirement). All three converge on the same 5-step volunteer clearance workflow. Clearance-pending state allows team to operate with CA hours cap (admin-enforced, not system-tracked).

3. **Annual volunteer renewal workflow added.** Full renewal sequence: August trigger, policy re-acknowledgment, conditional quiz retake if policy changed, conditional APS re-enrollment if cert expires before June 1, reinstatement flow.

4. **V5 team admin dashboard updated.** Now surfaces `events_vex_com_registered` checklist item for V5 teams, same as IQ.

5. **Schema correction: `events_vex_com_registered` scoped to VEX programs only.** Not shown or required for Combat teams.

6. **Companion documents referenced.** `functional_flow_v1_1.md` and `workflow_diagrams_v1_0` files are companion documents to this PRD.

### v1.6 Changes (prior version — see v1.6 document)

Application form redesigned, school autocomplete table, Not Sure triage workflow, admin application waiver, data migration approach, engagement_event tables, Cavitt-branded form, student self-authorship note.

### v1.5 Changes (see v1.5 document)

Complete identity/email model, Google Group sync architecture, group taxonomy, person_role table, compliance language, student consent model, Fusion 360 data capture, VolunteerLocal email field.

---

## 1. Executive Summary

Placer Robotics operates four programs — VEX V5, VEX IQ, Combat Robotics, and Summer Camps — serving 80+ students across 40+ teams with approximately 10 events per year. The organization currently manages registration, volunteer clearance, payment reconciliation, team assignment, and communications through Google Forms, Google Sheets, Apps Script, JotForm, a custom Python sync script, manual emails, and ad hoc admin tracking.

This platform replaces the entire operational backbone with a unified, maintainable web application. The sync script is retired. Google Sheets is no longer the source of truth. Supabase is.

Existing data is migrated via a one-time ETL script before go-live.

---

## 2. Build Philosophy

Supabase is the source of truth. Everything driven by Google Sheets is replaced by the database.

Automate everything the stack supports. Manual steps are documented exceptions.

The application form is the first impression. It should be welcoming, clear, and set accurate expectations. The long-answer questions are intentional — they are a filter for commitment, not a bureaucratic hurdle.

---

## 3. Core Business Rules

### BR-001 — Family Account Model (Permanent, Cross-Season)

The family is the permanent root account entity with no season field. Season context flows through `family_season`, `student_application`, `enrollment`, `financial_aid`, `payment_transaction`, and season-scoped waiver signatures. A returning family uses the same primary email and family record across all seasons.

---

### BR-002 — Guardian Login (Dual Access)

All guardians with `can_authenticate = true` may log into the portal independently using their own `login_email`. Magic link authentication resolves against all guardian email addresses in a family — not only the primary guardian.

Both parents in a family (married, partnered, or divorced) have equal and independent portal access by default. Either may complete registration, sign waivers, view payment status, and manage student information.

Students do not have portal accounts. Students are subjects of records, not system users.

---

### BR-002a — Notification Fan-Out Rule

Every notification sent by the system goes to ALL guardians in the family where `receives_notifications = true`.

This is a foundational rule with no exceptions. No notification ever goes to only one guardian. Acceptance emails, registration confirmations, payment receipts, financial aid decisions, volunteer clearance updates, team assignments — all fan out to all active guardians.

Default: `receives_notifications = true` for all guardians. A guardian may opt out (rare case) but the default is always all guardians receive all communications.

The `notification_log` records one entry per recipient per notification event.

---

### BR-003 — Application Before Registration (Softened)

A family may not begin student registration until either:
1. The relevant student application has been accepted by an authorized admin, or
2. A Registration Admin or Super Admin has explicitly waived the application requirement for that student.

The waiver creates an `admin_waived` application record with mandatory notes and an audit log entry. This is not a backdoor — it is a documented operational exception for known families, returning students, and data migration.

---

### BR-004 — Financial Assistance (Self-Service, Never a Gate)

Financial assistance is available as a self-service request and never blocks registration.

The registration form includes a callout: *"Need financial assistance? You can request it here before or after submitting registration."* The callout links to the financial aid request form.

Families may request financial aid at any time — before, during, or after registration. Registration is never locked pending financial aid resolution. Admin may adjust enrollment fundraising targets retroactively after a request is submitted and resolved.

The mandatory pre-registration financial aid prompt is eliminated. `family_season.status = pending_financial_aid` is not a valid state. The financial aid status lifecycle is: `pending → approved → denied → withdrawn`.

---

### BR-005 — Blind Application Review

Application review is completely separate from financial-aid review at the RLS layer. Registration Admins must not see financial aid information. Financial Aid Admins and Super Admins may.

---

### BR-006 — Minimum GPA Requirement

A minimum GPA threshold is configurable in `season_config`. Applications below the threshold are flagged in the admin queue. Admin makes the final acceptance decision — the system flags, it does not auto-decline.

The threshold is a flag, not a hard gate, because edge cases exist (new student, learning differences, improvement trajectory). Admin judgment is preserved.

---

### BR-007 — Fee and Fundraising Structure

All fee and fundraising values come from `season_config`. Nothing hardcoded.

**2026–2027 default seed values:**
- Student registration fee (V5, Combat): $40 per student.
- VEX IQ student registration fee: $0.
- VEX IQ team fee: $1,200 per team.
- One-program fundraising target (V5, Combat): $550 per student.
- Multi-program fundraising: $550 per program per student. A student enrolled in both V5 and Combat has two enrollment records each with a $550 target ($1,100 total across both enrollments).
- VEX IQ student fundraising target: $0 (manually adjustable).
- Fundraising deadline: July 31, 2026.
- Late acceptance grace period: 14 days.
- Volunteer hours required per family: 8.
- Minimum GPA threshold: configurable (default TBD — open question).

---

### BR-008 — Financial Aid Adjusts Fundraising Only

Hard rule. Financial aid adjusts fundraising target only. The $40 registration fee is always owed unless Super Admin explicitly overrides with mandatory audit entry. Automated financial aid resolution must never touch `registration_fee_status` or `registration_fee_amount`.

---

### BR-009 — Payment Transaction Ledger

All payments are rows in `payment_transaction`. The ledger is the source of truth.

---

### BR-010 — Zeffy Integration Model

1. Primary: Zeffy `payment.completed` webhook.
2. Fallback: scheduled Zeffy API polling.
3. Always available: manual admin override.

---

### BR-011 — Payment Reference Code

Each enrollment and IQ team registration has a generated payment reference code. Displayed on confirmation pages and payment instructions.

---

### BR-012 — Financial Aid Outcomes

Full Waiver / Partial Waiver / Denied. No payment plans. The words "payment plan" must not appear in the codebase.

---

### BR-013 — Returning Families

Returning families use the same permanent family record and primary email across all seasons. The system supports all of the following returning paths.

**What always resets each season (no carryover):**
- Financial aid: must re-apply every season. No prior approval carries forward. Prior season aid records exist in history for Super Admin reference but do not influence current season review.
- Waivers: new waivers required every season, no exceptions.
- Student communication consent: re-certified each season at registration.

**What carries forward:**
- Family record, guardian records, student records.
- Guardian contact information (pre-filled, editable).
- Prior season enrollment history (visible to admin).
- Volunteer clearance status (carries forward unless expired or suspended).

**Team assignment default:** A returning student's enrollment defaults to the same team as the prior season. Admin updates as needed. The student does not select their own team at registration (V5/Combat).

---

### BR-013a — Returning Family Paths

The system must support all of the following returning-family scenarios without requiring a new family record.

**Path 1 — Same program, same team:**
Returning student re-applies (or receives admin waiver), goes through financial aid gate, completes registration, signs new waivers. Team defaults to prior season team. Admin confirms or adjusts.

**Path 2 — Same program, different team:**
Same as Path 1. Team assignment updated by admin after registration. Student does not need to do anything different at registration.

**Path 3 — Add a program (e.g. V5 only → V5 + Combat):**
Student submits new application indicating both programs or the added program. Admin accepts. Financial aid gate re-runs per student application. Registration creates one enrollment per program. A student in both V5 and Combat has two enrollment records, each with a $550 fundraising target ($1,100 total). Each enrollment has its own payment reference code.

**Path 4 — Switch program (e.g. V5 → Combat):**
Student submits new application indicating new program. Prior season program enrollment is not carried forward. Admin accepts. Financial aid gate re-runs. New enrollment record created.

**Path 5 — Add a sibling:**
Parent logs in to existing family account. Initiates new application for the additional student. Application goes through the standard queue. A new student record is created under the existing family. Guardian records shared. Financial aid request may be submitted for the new student before their registration.

**Path 6 — IQ to V5 transition:**
Student must submit a full V5 application through the standard application form. No automatic pathway. Admin may use the admin_waived application status to fast-track a known IQ student, but this is a deliberate admin decision, not automatic. IQ enrollment history is preserved on the student record and visible to admin.

---

### BR-013b — Returning Volunteer Renewal Gate

All cleared volunteers must complete renewal each season regardless of clearance status continuity.

**Renewal open date:** Configurable in `season_config.volunteer_renewal_open_at`. Standard: July 1. May vary by season.

**Renewal target close date:** Configurable in `season_config.volunteer_renewal_target_close_at`. Standard: August 31.

**Early warning:** Volunteers whose APS cert expires before May 31 of the upcoming program year receive an early warning email approximately 90 days before their cert expiration date (configurable via `season_config.aps_early_warning_days_before`). For standard May 31 expiry certs, this triggers around June 1. Warning goes to volunteer only — no admin alert.

**APS completion gate:** If APS re-enrollment is required (cert expires before May 31), the renewal flow is blocked from final submission until the APS completion webhook is received. The volunteer may complete policy re-acknowledgment and quiz (if required) at any time, but cannot complete renewal until APS training is done. The APS training link is sent automatically by the system when renewal opens.

**Operational target:** All renewals complete by August 31. After August 31, the admin dashboard surfaces volunteers with incomplete renewal. No hard system lock after August 31 — admin manages operationally.

**On cert expiration without renewal:** `volunteer_status → expired`. Volunteer removed from Google Groups and Slack on next sync. Blocked from operating as cleared volunteer.

**Reinstatement after expiry:** Volunteer completes APS training at any time. APS webhook auto-reinstates `volunteer_status → cleared`. Groups and Slack restored on next sync. No admin action required for reinstatement.

---

### BR-014 — Multiple Students Per Family

One enrollment per student per season. Separate program selections and fundraising targets. Shared guardians. Family-level volunteer-hour requirement.

---

### BR-015 — Unified Team Model

One `team` table: VEX V5, VEX IQ, Combat. Team numbers admin-assigned after GRSF confirmation, never collected at team creation. IQ team must exist and fee confirmed before IQ students register. Team assignment for all programs is managed via `team_member` rows — `enrollment` has no `team_id` field.

**events.vex.com registration** is required for VEX V5 and VEX IQ teams. Not required for Combat. The `events_vex_com_registered` boolean field on `team` applies only when `program IN (vex_v5, vex_iq)`. Admin marks complete. Both V5 and IQ team dashboards surface teams where this is incomplete.

---

### BR-015a — Coach Onboarding Model

Coach and team manager onboarding follows three paths depending on program, all converging on the same 5-step volunteer clearance workflow.

**IQ Coach path:**
1. Coach creates team via public form at `/iq-team/create` (no login required).
2. Coach pays $1,200 team fee via Zeffy.
3. Payment Admin confirms payment. Team status → `active`.
4. Coach receives login link and clearance instructions.
5. Coach completes 5-step volunteer clearance (same as all volunteers).
6. Admin marks `events_vex_com_registered` when IQ team is registered at events.vex.com.
7. Admin assigns team number after GRSF/VEX confirmation.

**V5 Coach path:**
1. Admin creates team record and assigns coach/manager via admin dashboard.
2. Coach receives notification and login link.
3. Coach completes 5-step volunteer clearance.
4. Admin marks `events_vex_com_registered` when V5 team is registered at events.vex.com.
5. Admin assigns team number after GRSF confirmation.

**Combat Manager path:**
1. Admin creates team record and assigns manager via admin dashboard.
2. Manager receives notification and login link.
3. Manager completes 5-step volunteer clearance.
4. No external registration requirement. No team fee.
5. Admin assigns team identifier.

**Clearance-pending operation:** A team is active and students may register regardless of coach/manager clearance status. The admin dashboard surfaces a clearance-pending flag on any team with an uncleared coach or manager. The CA mandated volunteer hours cap applies operationally — not tracked by system, enforced by admin.

---

### BR-016 — Volunteer Clearance Model (Unified)

All coaches, managers, and cleared volunteers follow the same clearance workflow across all programs.

Steps: volunteer application → volunteer waiver → CA DOJ background check (admin marks complete) → APS/MinistrySafe youth protection (API) → Youth Protection quiz (in-system) → Lab Use quiz (in-system) → lab orientation (admin marks complete).

Clearance status: `pending → in_progress → cleared → expired → suspended`

CA mandated hours cap: not tracked by system. Clearance status is the single control surface.

---

### BR-016 — Volunteer Clearance Model (Unified)

All coaches, managers, and cleared volunteers follow the same clearance workflow.

**Clearance steps:**
1. Volunteer application (existing guardian in system — no new record creation needed for registered parents).
2. **Policy acknowledgment** — volunteer reviews and signs current season policies (youth protection, lab use, volunteer conduct). Written confirmation required for insurance purposes. Same evidence capture as waivers: typed name, checkboxes, timestamp, IP, version hash.
3. CA DOJ background check — admin marks complete (no API).
4. APS/MinistrySafe youth protection training — API enrollment, completion webhook.
5. Youth Protection Policy quiz — in-system, 90% threshold, unlimited retakes.
6. Lab Use Policy quiz — in-system, 90% threshold, unlimited retakes. Framework supports additional quizzes beyond these two — admin-configurable.
7. Lab orientation — admin marks complete.

**Clearance status lifecycle:** `pending → in_progress → cleared → expired → suspended`

**On cert expiry:** Volunteer loses door access (UniFi credentials revoked via API) and cannot supervise youth meetings. Volunteer is NOT removed from Google Groups or Slack — those remain active. Admin dashboard surfaces cert-expired volunteers. Operational supervision restriction is enforced via UniFi access revocation only.

**CA mandated volunteer hours cap:** Not tracked by system. Clearance status is the single control surface for system purposes.

**UniFi credential lifecycle:**
- On clearance granted: system provisions UniFi door credentials via UniFi Access API.
- On cert expiry: system revokes UniFi door credentials via UniFi Access API.
- On clearance reinstated: system re-provisions UniFi door credentials.
- On suspension: system revokes UniFi door credentials.
- All provisioning/revocation actions logged to `admin_action_log`.
- Exact UniFi Access API endpoints confirmed against the specific controller before coding.

---

### BR-016a — Annual Volunteer Renewal

Annual renewal opens according to `season_config.volunteer_renewal_open_at`. Standard: July 1. The system sends a renewal invitation to all volunteers with `volunteer_status = cleared`. Target completion date is `season_config.volunteer_renewal_target_close_at`. Standard: August 31.

**Renewal steps:**

1. **Policy re-acknowledgment:** Volunteer reviews the current season's youth protection policy and acknowledges it with a typed-name signature. Required every season regardless of other renewal steps.

2. **Quiz retake (conditional):** If the youth protection policy has changed since the volunteer's last acknowledgment (flagged by admin when updating the waiver template), the volunteer must retake the Youth Protection Policy quiz at 90%+ threshold. If policy is unchanged, quiz retake is not required.

3. **APS re-enrollment (conditional):** If the volunteer's APS youth protection certificate expires on or before May 31 of the program year, the volunteer must complete a new APS training. The system auto-enrolls via API and sends the training link. APS completion webhook marks this step complete. If the cert is valid through May 31, re-enrollment is not required.

**Renewal outcomes:**
- All required steps complete → `volunteer_status` remains `cleared`. Renewal confirmation sent.
- Steps incomplete by season start → admin notified. Volunteer may continue operating but admin tracks outstanding renewal.
- APS cert expires without renewal → `volunteer_status → expired` automatically. Google Group and Slack removal on next sync.

**Reinstatement after expiration:** Volunteer completes APS training. APS webhook fires. System restores `volunteer_status → cleared` automatically. Admin notified. Google Group and Slack access restored on next sync.

**Live Scan / CA DOJ:** One-time unless there is a break in service. Not repeated during annual renewal unless volunteer status was suspended or lapsed.

---

### BR-017 — Google Group Sync Model

Supabase is the source of truth. sync_script.py is retired. A scheduled sync job replaces it entirely. Board group excluded from automated sync.

---

### BR-018 — Slack Sync Model

Slack user group membership driven by enrollment, clearance status, and `person_role`. Two workspaces: `main` and `iq`.

---

### BR-019 — Person Role Model

Roles `steering_committee`, `camp_staff`, `board` stored in `person_role` table. Board is Super Admin managed manually.

---

### BR-020 — Identity / Email Model

Guardian email fields: `login_email` (required, unique), `communication_email`, `slack_email`, `google_email`, `fusion_education_email`, `volunteerlocal_email`.

Student email fields: `communication_email`, `slack_email`, `fusion_education_email`.

Google Group sync: `google_email` → fallback `login_email`.
Slack sync: `slack_email` → fallback `login_email`.

Email mapping sheet (sync_script.py) is eliminated. Identity resolved at data entry.

---

### BR-021 — Student Communication and Third-Party Consent

Student communication email requires parent certification of access. Separate opt-in for direct email and Slack. Re-collected each season. Under-13 Slack hard-blocked regardless of consent.

---

### BR-022 — Waiver Requirements

Student Participation Waiver (per student, per season). Parent Participation Waiver (scope pending insurance confirmation). Volunteer Waiver (during clearance). Prior season waivers never carry forward.

---

### BR-023 — Electronic Acknowledgment Evidence

Per waiver: template ID, type, version, text hash, family ID, guardian ID, student ID if applicable, typed name, consent checkboxes, authenticated email, IP, user agent, timestamp, source route.

Final waiver text and consent flow must be reviewed by counsel and insurance before go-live.

---

### BR-024 — Minor Data / COPPA

No student login. Parent submits all student data. Under-13 Slack hard-blocked. Minor-data flow reviewed before go-live.

---

### BR-025 — Admin Bootstrap

First Super Admin via SQL seed migration from `BOOTSTRAP_ADMIN_EMAIL` env var. Idempotent. No application-layer bootstrap.

---

### BR-026 — Production Infrastructure

**Hosting:** Vercel. Production domain: `hub.placerrobotics.org`. Vercel preview deployments required for all changes before production release.

**Database:** Supabase Pro or higher. Separate development and production Supabase projects. Production backups enabled.

**Email:** Transactional email provider with SPF/DKIM/DMARC configured.

**Secrets:** All secrets in environment variables. No secrets in Git. Production and preview environments use separate environment variables where appropriate.

**Marketing site** (placerrobotics.org) remains on Squarespace and is out of scope for this platform. The registration platform is `hub.placerrobotics.org` only.

---

### BR-027 — Data Migration

Existing registration and volunteer data migrated via one-time ETL script before go-live. Migrated families receive `admin_waived` application records. Migrated cleared volunteers receive clearance status intact. Migration script is version-controlled alongside the schema. See Section 18.

---

### BR-028 — "Not Sure" Application Triage

Applications with `program_interest = not_sure` are valid and accepted into a separate triage queue. Admin triages after engagement events (info nights, try-it-out sessions, camps). Status moves to `program_pending` after initial review. Admin updates `program_interest_final` and moves to `accepted` after program is determined. Normal registration flow proceeds.

---

### BR-029 — School Canonicalization

School names are backed by a `school` table. Application form uses autocomplete against this table with free-text fallback. Unrecognized school names submitted by families surface in admin dashboard for review and canonicalization. Admin may merge, accept, or mark as out-of-area.

---

## 4. Compliance Language Requirements

All required notices and certifications must appear verbatim (or as approved by counsel) in the final system.

### 4.1 Minor Data Collection Notice
Displayed on public application form before submission:

> Placer Advanced Robotics and Technology (Placer Robotics) collects information about student participants for the purpose of program registration, safety, team administration, and program communications. Student information is not sold, shared with advertisers, or used for purposes unrelated to program operations. By submitting this application, the parent or guardian certifies they are authorized to provide this information on behalf of the student.

### 4.2 Parent/Guardian Data Certification (Application)
Checkbox required at application submission:

> I certify that I am the parent or legal guardian of the student named above and am authorized to submit this application and provide the student's information to Placer Robotics.

### 4.3 COPPA / Under-13 Parental Consent Certification (Registration)
Checkbox required at registration if student may be under 13 (grade 6 or 7, or birthdate confirms under 13):

> I understand that my student is under 13 years of age. I consent to Placer Robotics collecting and storing my student's name, grade, school, and program participation information for the purpose of program registration and operations. I understand my student will not be provided a direct account or login to the Placer Robotics platform.

### 4.4 Student Communication Email Certification (Registration)
Displayed when parent provides student communication email:

> By providing a student communication email address, I confirm that I have access to this email account and can monitor communications sent to it. I understand this email may be used to send my student program updates, team communications, and event information from Placer Robotics.

Checkbox: *I confirm I have access to this email account.*

### 4.5 Student Direct Communication Consent (Registration, Optional)
> I consent to my student receiving direct program emails at the communication email address provided above.

Checkbox: *I consent to direct email communication with my student.*

### 4.6 Student Slack Consent (Registration, Optional)
> I consent to my student's email address being used to invite them to the Placer Robotics Slack workspace for team coordination, competition updates, and program announcements. I understand that Slack is a third-party platform and that my student must be 13 years of age or older to use Slack per Slack's Terms of Service.

Checkbox: *I consent to my student being invited to the Placer Robotics Slack workspace.*

Note: System hard-blocks this consent for students confirmed under 13.

### 4.7 Electronic Acknowledgment Consent (Waiver Section)
> By typing your name below and checking the boxes, you are providing an electronic signature acknowledging that you have read, understand, and agree to the terms above. You consent to the use of electronic acknowledgment in place of a handwritten signature. This electronic acknowledgment is legally binding.

### 4.8 Waiver Legal Review Notice (Internal — Go-Live Gate)
Must be confirmed by counsel and/or insurance before go-live: final waiver language, electronic signature flow, California Civil Code 1542 language, Parent Participation Waiver scope, minor data flow (COPPA, SOPIPA, AB 1584, CPPA).

### 4.9 Volunteer Data Notice
Displayed at volunteer application:

> Information collected during the volunteer clearance process is used solely for the purpose of verifying clearance status and administering the Placer Robotics volunteer program. Background check results are not stored in this system. Youth protection training completion is tracked by program ID and certificate only.

### 4.10 Financial Aid Confidentiality Notice
Displayed at financial aid request:

> Financial assistance information is kept strictly confidential. It is visible only to authorized financial aid reviewers and is not shared with program staff involved in student application review or team assignment.

---

## 5. Application Form — Canonical Field Set

This is the controlling specification for the student application form. The current Google Form is retired when the platform launches.

### Form Introduction
> Welcome to the Placer Robotics 2026–27 application. This program is a serious time commitment — most students spend 8–15 hours per week during the season. We want to make sure it's the right fit for you and your family.
>
> This form has 5 sections and takes about 15–20 minutes to complete. Sections 1–3 should be completed by the student. Section 4 is for parents/guardians.

### Section 1 — Student Information
| Field | Type | Required |
|---|---|---|
| Student first name | Text | Yes |
| Student last name | Text | Yes |
| Preferred name / nickname | Text | No |
| Grade entering Fall 2026 | Dropdown: 7, 8, 9, 10, 11, 12 | Yes |
| School attending (Fall 2026) | Autocomplete + free text fallback | Yes |
| City | Text | Yes |
| ZIP code | Text | Yes |
| Student email | Text | No — labeled: "We may use this to communicate with you directly. Optional." |
| Current overall GPA | Text | Yes |
| Most recent term GPA | Text | Yes |
| Who referred you to Placer Robotics? | Text | Yes — labeled: "Put N/A if none" |

### Section 2 — Program Interests
| Field | Type | Required |
|---|---|---|
| Which programs are you interested in? | Checkboxes: VEX V5 / Combat Robotics / Not Sure | Yes |
| Previous robotics experience | Checkboxes: VEX IQ / VEX V5 / Combat Robotics / FRC/FTC / FLL / PLTW / None | No |
| Skills you're excited about or already familiar with | Checkboxes: Coding (VEXcode, Python) / CAD (Fusion 360, Onshape) / Mechanical Building / Electrical Engineering / None yet | No |
| Any teammates you'd like to work with? | Long text | No |

### Section 3 — About You
Section note (not a question — displayed at top):
> *Please answer these questions in your own words. We want to hear from you directly.*

| Field | Type | Required |
|---|---|---|
| Tell us about yourself — your background, interests, and what draws you to robotics. | Long text | Yes |
| What are your goals for this season, and what are you willing to commit to make them happen? | Long text | Yes |
| What other activities are you involved in, and how much time do they take? | Long text | Yes |
| Are you available to help with summer camps or get an early start this summer? | Radio: Yes / Maybe / No | Yes |

### Section 4 — Parent / Guardian Information
| Field | Type | Required |
|---|---|---|
| Parent/Guardian 1 first name | Text | Yes |
| Parent/Guardian 1 last name | Text | Yes |
| Parent/Guardian 1 email | Email | Yes |
| Parent/Guardian 1 phone | Text | Yes |
| Parent/Guardian 2 first name | Text | No |
| Parent/Guardian 2 last name | Text | No |
| Parent/Guardian 2 email | Email | No |
| Parent/Guardian 2 phone | Text | No |
| Single guardian? | Checkbox | No — shown if G2 fields empty |
| Areas interested in volunteering | Checkboxes: Lab Supervision / General Activities & Events / Combat Advisor/Mentor / Robotics Center Operations/Facilities / VEX Equipment Manager / Fundraising/Grants/Sponsorships / Business/Marketing / Summer Camps | No |
| Your profession or field | Text | No — labeled: "Helps us match mentoring opportunities" |
| Volunteering comments or notes | Long text | No |

### Section 5 — Final Confirmation
| Field | Type | Required |
|---|---|---|
| Anything else we should know? | Long text | No |
| Minor Data Collection Notice (Section 4.1) | Display only | — |
| Parent/Guardian Data Certification | Checkbox | Yes |

### Cavitt Jr High Branded Form
Identical field set. Differences:
- Cover branding: Cavitt Jr High logo and colors, Placer Robotics co-branding.
- Intro text references the Placer Robotics / Cavitt partnership.
- School field: pre-filled as "Cavitt Jr High", read-only.
- Hidden field sets `source = cavitt_form` for admin tracking.

### Admin GPA Flag
Applications where `gpa_overall < season_config.min_gpa_threshold` OR `gpa_recent_term < season_config.min_gpa_threshold` are flagged in the admin application queue with a visual indicator. Admin makes the final decision. System does not auto-decline.

---

## 6. User Roles

### 6.1 Family User
May: view own family profile, update guardian contacts, view own students, submit applications, complete registration, request financial aid, sign waivers, view own status, view own team assignment, update student communication email (with re-consent flow), initiate volunteer application.

### 6.2 Super Admin
May: all records, all admin roles, financial aid, registration overrides, record corrections, all exports, season config, waiver templates, audit logs, registration fee waiver (mandatory audit), quiz management, volunteer clearance management, person roles, Board group membership.

### 6.3 Registration Admin
May: view applications (no financial-aid data), accept/decline/triage, waive application requirement (mandatory notes + audit), view registered students, assign teams, export rosters, view family/guardian contact info, view payment summary status, update `program_interest_final` for `program_pending` applications.

May not: financial-aid content, resolve financial aid, manage admin roles, modify season config.

### 6.4 Financial Aid Admin
May: view financial-aid queue and content, resolve aid, enter admin notes, view registration records for context.

### 6.5 Payment Admin
May: view payment/fundraising dashboard, enter manual transactions, match/unmatch/ignore, update enrollment fee and fundraising summary, record sponsorship credit, export payment reports. May not set registration fee to waived (Super Admin only).

### 6.6 Volunteer Admin
May: view volunteer clearance queue, mark CA DOJ complete, mark lab orientation complete, mark events.vex.com registration complete for V5 and IQ teams, view APS status, view quiz results, approve/suspend/expire clearance, send renewal reminders.

### 6.7 Communications Admin
May: send broadcasts to any defined group, view notification log, manage role-based group membership (Steering Committee, Camp Staff).

### 6.8 Student Director (Limited Admin)
Guardian of a `@placerrobotics.org` account granted this role by Super Admin. Not a student login.

May: send broadcasts to assigned program groups, view limited roster (student names, program, team — no financial data, no full guardian PII).

Scoped to assigned program by `program_scope` in `admin_role_assignment`.

### 6.9 Read-only Admin
May: view rosters and non-sensitive registration status, export limited roster CSV if explicitly allowed.

---

## 7. Identity and Email Model

### 7.1 Guardian Email Fields
```
login_email               text not null unique   -- magic link auth
communication_email       text nullable          -- what they actually check
slack_email               text nullable          -- Slack account email
google_email              text nullable          -- Google Drive/Group access
fusion_education_email    text nullable          -- Autodesk education license
volunteerlocal_email      text nullable          -- VolunteerLocal account
```

Sync resolution: Google Groups use `google_email` → `login_email`. Slack uses `slack_email` → `login_email`. Direct email uses `communication_email` → `login_email`.

### 7.2 Student Email Fields
```
communication_email       text nullable   -- parent-certified, optional at application
slack_email               text nullable   -- parent-certified
fusion_education_email    text nullable   -- Autodesk education license
```

Per-season consent flags on `enrollment` (reset each season):
```
parent_email_access_certified     boolean not null default false
student_communication_consent     boolean not null default false
student_slack_consent             boolean not null default false
```

---

## 8. Group Taxonomy

### 8.1 Enrollment-Driven (Auto-Synced)
| Group Email | Membership Driver | Slack | Drive |
|---|---|---|---|
| 295-hs-vex@placerrobotics.org | V5 + division=high | main | V5 Drive |
| 295-ms-vex@placerrobotics.org | V5 + division=middle | main | V5 Drive |
| iq-parents@placerrobotics.org | IQ enrollment (all) | iq | IQ Drive |
| combat-hs@placerrobotics.org | Combat + division=high | main | Combat Drive |
| combat-ms@placerrobotics.org | Combat + division=middle | main | Combat Drive |
| cavitt-vex@placerrobotics.org | V5 + school=Cavitt Jr High | main | — |
| part-everyone@placerrobotics.org | All enrolled families + cleared volunteers not in enrolled family | main | — |

### 8.2 Clearance-Driven (Auto-Synced)
| Group Email | Membership Driver | Slack | Drive |
|---|---|---|---|
| v5-hs-coaches@placerrobotics.org | Cleared + coach + V5 + HS | main | V5 Drive |
| v5-ms-coaches@placerrobotics.org | Cleared + coach + V5 + MS | main | V5 Drive |
| combat-hs-coaches@placerrobotics.org | Cleared + coach + Combat + HS | main | Combat Drive |
| combat-ms-coaches@placerrobotics.org | Cleared + coach + Combat + MS | main | Combat Drive |
| iq-coaches@placerrobotics.org | Cleared + coach + IQ | iq | IQ Drive |

Slack user group: `cleared-parents` → `volunteer_status=cleared` → main + iq workspaces.

### 8.3 Role-Driven (person_role, Admin-Managed)
| Group Email | Role | Slack | Drive |
|---|---|---|---|
| prsc@placerrobotics.org | steering_committee | main | SC Drive |
| campstaff@placerrobotics.org | camp_staff | main | Camp Drive |

### 8.4 Manual (Super Admin Only)
| Group Email | Who | Drive |
|---|---|---|
| board@placerrobotics.org | Board (5 members) | Board Drive |

### 8.5 Sync Architecture
Scheduled sync job replaces sync_script.py entirely. Runs on configurable schedule (default 15 minutes) and on-demand after enrollment, clearance, or role changes. Queries Supabase, fetches Google Group membership, computes diff, executes batch updates. Logs all changes to `sync_log`. Failures surfaced in admin dashboard.

---

## 9. Functional Requirements

### 9.1 Authentication
FR-AUTH-001 — Magic-link auth via Supabase Auth. Magic link resolves against `login_email` across ALL guardian records in a family — not just the primary guardian. Both parents can log in independently and see the same family dashboard.
FR-AUTH-002 — Magic links expire after 15 minutes.
FR-AUTH-003 — Family sessions persist up to 30 days.
FR-AUTH-004 — Admin sessions require re-auth after 8 hours.
FR-AUTH-005 — `/apply` and `/iq-team/create` excluded from auth middleware.
FR-AUTH-006 — Admin resend-login-link tool.
FR-AUTH-007 — Admin change-primary-email (Super Admin only).
FR-AUTH-008 — School-issued email domains warned, not blocked.
FR-AUTH-009 — Student Director admin profiles use `@placerrobotics.org` email.

---

### 9.2 Public Application — V5 and Combat

FR-APP-001 — No login required.
FR-APP-002 — Canonical field set per Section 5.
FR-APP-003 — School field: autocomplete against `school` table, free-text fallback. Unrecognized schools flagged for admin canonicalization.
FR-APP-004 — Displays Minor Data Collection Notice (Section 4.1).
FR-APP-005 — Requires Parent/Guardian Data Certification checkbox (Section 4.2).
FR-APP-006 — On submission: check for existing family by Guardian 1 email. If exists, associate new application with existing family. If not, create family, guardians, student, application. Write notification log. Send confirmation emails to both guardian emails.
FR-APP-007 — Initial status: `submitted`.
FR-APP-008 — `program_interest = not_sure` is valid. Application routed to triage sub-queue in admin dashboard.
FR-APP-009 — GPA fields: if below `season_config.min_gpa_threshold`, flag in admin queue. Do not auto-decline.
FR-APP-010 — Application queue sorted by submission date. No financial-aid data visible.
FR-APP-011 — Registration Admin or Super Admin: accept / decline / needs-follow-up / program-pending.
FR-APP-012 — `program_pending`: used for Not Sure applicants being triaged. Admin adds `triage_notes`. Admin updates `program_interest_final` when program determined, then moves to accepted.
FR-APP-013 — Admin application waiver: Registration Admin or Super Admin may create an `admin_waived` application record for any family without requiring a submitted application. Requires mandatory notes field. Writes `admin_action_log`. Family moves directly to financial-aid gate then registration.
FR-APP-014 — Acceptance: send login instructions directing family to financial-aid prompt.
FR-APP-015 — Decline: send notification, prevent registration.

---

### 9.3 VEX IQ Team Creation and Payment

FR-IQ-001 — IQ team creation is available from within the authenticated family dashboard. Coach must create a family account first (standard registration flow). Once logged in, coach sees "Create an IQ Team" option in their dashboard. `/iq-team/create` is an authenticated route — not a public form.
FR-IQ-002 — Team creation form (authenticated, within dashboard) collects: estimated team size, optional team name. For each student: student first name, last name, parent/guardian email address (not student email). No division field (IQ is currently elementary school only). No school name field. No team number field (admin assigns). Coach name and contact pulled from existing guardian record.
FR-IQ-003 — Parent/guardian emails collected for each student are used to send magic links after IQ Coordinator review. Student emails are never collected at this stage due to student age.
FR-IQ-004 — On submission: create or associate family/guardian for coach. Create team with `program=vex_iq`, `status=pending_payment`. Generate team payment reference code. Send confirmation with Zeffy IQ team payment link.
FR-IQ-005 — Zeffy payment match: update team `fee_status=paid`, `status=pending_admin_confirmation`, notify admin.
FR-IQ-006 — IQ Coordinator or Super Admin reviews team submission and confirms. Team status → `active`. System sends: (a) login link and clearance instructions to coach, (b) magic link registration invitations to each parent/guardian email provided for student roster.
FR-IQ-007 — IQ students may not register until team `status=active`.
FR-IQ-008 — IQ team record has `events_vex_com_registered boolean`. Admin marks complete. IQ team dashboard surfaces teams where incomplete.
FR-IQ-009 — Team number admin-assigned after GRSF/VEX confirmation. Not collected at creation.

---

### 9.3a V5 and Combat Coach Assignment

FR-COACH-001 — Registration Admin or Super Admin may create a team record for VEX V5 or Combat and assign a coach or manager by selecting an existing guardian record or entering a new guardian.

FR-COACH-002 — On coach assignment: system sends the assigned coach/manager a notification email with login link and instructions to begin volunteer clearance.

FR-COACH-003 — V5 team record has `events_vex_com_registered boolean`. Admin marks complete after confirming team registration at events.vex.com. V5 team dashboard surfaces teams where incomplete.

FR-COACH-004 — Combat team record does not require `events_vex_com_registered`. Field is not shown in admin dashboard for Combat teams.

FR-COACH-005 — Admin may reassign a coach or manager to a different team. Prior team role record is marked inactive. New team role record created. All changes write audit log.

---

### 9.4 Financial Aid (Self-Service, Never a Gate)

FR-FA-001 — Financial aid v1: PART's existing Google Form is linked from the registration form callout. The platform does not build a financial aid form in Release 1. Callout text: "Need financial assistance? Submit a request before completing registration." Links to existing Google Form. Future release replaces the Google Form with an in-platform form.

FR-FA-002 — The registration form includes a callout: *"Need financial assistance with fees or fundraising? You can submit a request before or after completing registration."* The callout links to `/financial-aid/request`.

FR-FA-003 — Financial aid request form collects: govt assistance program name or category, brief description of need, optional context, parent certification. Displays Financial Aid Confidentiality Notice (Section 4.10).

FR-FA-004 — Must not collect: income amounts, tax records, bank statements, uploads, SSNs.

FR-FA-005 — Submitting a financial aid request creates a `financial_aid` record with `status = pending`. Registration continues unaffected.

FR-FA-006 — Financial Aid Admin or Super Admin resolves: Full Waiver / Partial Waiver / Denied.

FR-FA-007 — Full Waiver: `fundraising_target=0`, `fundraising_status=waived`. Fee untouched.

FR-FA-008 — Partial Waiver: `fundraising_target=adjusted_fundraising_target`. Fee untouched.

FR-FA-009 — On resolution: notify family. If enrollment already exists, admin updates fundraising target on the enrollment record directly. No unlock step needed.

FR-FA-010 — Financial aid content not visible in application review (RLS-enforced).

FR-FA-011 — `family_season.status` does not include `pending_financial_aid`. Financial aid does not affect family season status.

---

### 9.5 Registration Form — V5 and Combat

FR-REG-001 — Gate: `cleared_to_register` only (accepted or admin_waived + financial aid resolved).
FR-REG-002 — Supports multiple students per family in one session.
FR-REG-003 — Form sections:
  1. Participant information (pre-filled from application).
  2. Guardian contacts (pre-filled, updateable; additional email fields).
  3. Student communication email + consent (Sections 4.4, 4.5, 4.6).
  4. Program selection.
  5. Fees and fundraising (from `season_config`).
  6. Volunteering and role interest.
  7. Student/family expectations acknowledgment.
  8. Youth protection policy summary.
  9. Robotics center use policy summary.
  10. Waiver acknowledgment (Section 4.7).
  11. Confirmation.

FR-REG-004 — Under-13 COPPA certification shown if grade ≤ 7 or birthdate confirms under 13 (Section 4.3).
FR-REG-005 — Student Slack consent hard-disabled for under-13 (server-side, not UI only).
FR-REG-006 — Fee/fundraising from `season_config`. Adjusted if financial aid applied.
FR-REG-007 — Guardian additional email fields clearly labeled with purpose. All optional.
FR-REG-007a — Guardian address UX: Guardian 1 address collected (street, city, state, ZIP). Guardian 2 section shows "Same address as Guardian 1?" checkbox, checked by default. If checked: Guardian 2 address fields hidden, Guardian 1 address copied on save. If unchecked: Guardian 2 address fields appear. Zero friction for same-household families, full flexibility for divorced families.
FR-REG-007b — Emergency contacts section: family may add one or more emergency contacts with name, phone, relationship, and call priority. Separate from guardian records. Optional at registration — can be added or updated from family dashboard at any time.
FR-REG-007c — Student email domain warning: if student email domain matches a known school domain (e.g. @rocklinusd.org, @sanjuan.edu, @gmail.com is safe), show warning: "School email addresses are often blocked — we recommend a personal email your student checks regularly. Are you sure you want to use this address?" User confirms to proceed. Not a hard block.
FR-REG-007d — T-shirt size pre-fill: returning students see prior season size pre-filled with prompt: "This is the size from last season — update if your student has grown."
FR-REG-008 — Waiver: typed name, consent checkboxes, auto-captured timestamp/IP/user agent/template hash.
FR-REG-009 — On submission: create enrollment, waiver signatures, generate payment reference code, send confirmation, show confirmation with Zeffy link and reference code.

---

### 9.6 Registration Form — VEX IQ Students

FR-IQ-REG-001 — Student selects active IQ team from confirmed list.
FR-IQ-REG-002 — Registration fee: $0. Fundraising target: $0 default. Optional donation Zeffy link.
FR-IQ-REG-003 — Same consent flow for student communication email and Slack.
FR-IQ-REG-004 — On submission: create enrollment with `team_id` set, zero fee, zero fundraising target. Waiver signatures created.
FR-IQ-REG-005 — Admin may manually set fundraising target on IQ enrollment.

---

### 9.7a Returning Family Registration

FR-RETURN-001 — A returning family logs in with their existing primary email. The system presents their family dashboard showing prior season enrollment history and any current-season outstanding actions.

FR-RETURN-002 — A returning student may be re-enrolled for a new season by submitting a new application (or receiving an admin waiver). The system creates a new `student_application` and subsequently a new `enrollment` record for the new season. It does not modify prior season records.

FR-RETURN-003 — Registration form pre-fills all existing guardian and student data. Family reviews and updates any information that has changed. All pre-filled data is editable.

FR-RETURN-004 — Team assignment for returning V5 and Combat students defaults to their prior season assignment. On new enrollment creation, the system creates a draft `team_member` row based on the prior season assignment, flagged as `status = draft` until admin confirms. Admin may update or clear any draft assignment.

FR-RETURN-005 — A returning family that selects a different or additional program submits a new application reflecting the updated program interest. The admin reviews and accepts. A new enrollment record reflects the new program. Fundraising target is recalculated based on the new program selection from `season_config`.

FR-RETURN-006 — A returning parent adding a sibling initiates a new application from their existing family account. A new `student` record is created under the existing `family`. The application goes through the standard queue.

FR-RETURN-007 — An IQ student transitioning to V5 must submit a full V5 application through the standard application form. No automatic pathway. Admin may use `admin_waived` status to fast-track a known student. IQ enrollment history is preserved on the student record and visible to admin.

FR-RETURN-008 — Financial aid must be re-requested every season. No prior season approval carries forward. The financial aid gate presents identically for returning families as for new families.

FR-RETURN-009 — Waivers must be re-signed every season. No prior season waiver satisfies current season requirements. The registration form displays and requires acknowledgment of the current season's active waiver templates.

FR-RETURN-010 — Student communication consent flags (`parent_email_access_certified`, `student_communication_consent`, `student_slack_consent`) reset to false each season on new enrollment creation. Must be re-certified at registration.

---

### 9.7 Student Communication Email Update (Mid-Season)

FR-EMAIL-001 — Parent updates `student.communication_email` from family dashboard.
FR-EMAIL-002 — Update requires: new email, re-certification, re-consent.
FR-EMAIL-003 — On update: consent flags reset, old Slack email removed, new email invited if re-consented, change logged, confirmation sent to guardian.
FR-EMAIL-004 — Admin may update directly with mandatory audit entry.

---

### 9.8 Payment and Fundraising

FR-PAY-001 — Zeffy webhook: validate, store raw payload, create transaction, attempt match.
FR-PAY-002 — Match order: reference code → Zeffy payment ID → donor email → name/amount/timing → manual.
FR-PAY-003 — Polling fallback: `GET /api/v1/payments` with `created[gte]`.
FR-PAY-004 — Unmatched queue: Payment Admin and Super Admin.
FR-PAY-005 — Manual entry: checks, Benevity, cash, corporate platforms.
FR-PAY-006 — Fee status: Unpaid / Paid / Waived (Waived = Super Admin + mandatory audit).
FR-PAY-007 — Fundraising status: Not Started / Partial / Complete / Waived.
FR-PAY-008 — Auto confirmation email after successful match.
FR-PAY-009 — All payment updates write `admin_action_log`.

---

### 9.9 Volunteer Clearance Workflow

FR-VOL-001 — Guardian initiates from family dashboard. Displays Volunteer Data Notice (Section 4.9).
FR-VOL-002 — Volunteer waiver collected at application.
FR-VOL-003 — Creates `volunteer_profile` and `volunteer_step` records for all 5 steps.
FR-VOL-004 — APS: create user, assign training, retrieve link, send email, receive completion webhook, store cert. Endpoints confirmed from APS sandbox before coding.
FR-VOL-005 — CA DOJ: admin marks complete. Date and notes recorded.
FR-VOL-006 — Quizzes: step marked complete on passing attempt.
FR-VOL-007 — Lab orientation: admin marks complete.
FR-VOL-008 — Auto-clearance: all steps complete → `cleared`. Notification sent. Slack workspace invite sent. Google Group sync triggered. UniFi door credentials provisioned via UniFi Access API.
FR-VOL-009 — APS cert expiration: 60-day reminder, 30-day reminder. On expiration: `volunteer_status → expired`. UniFi door credentials revoked via API. Volunteer cannot supervise youth meetings. Volunteer is NOT removed from Google Groups or Slack — those remain active.
FR-VOL-010 — Admin suspension: reason required, audit log entry.
FR-VOL-011 — Uncleared coach on any team: clearance-pending flag in admin dashboard.

---

### 9.9a Annual Volunteer Renewal

FR-FUND-001 — Fundraising deadline is `season_config.fundraising_deadline` (standard: August 31). Configurable.
FR-FUND-002 — System sends a series of fundraising reminder emails to families with outstanding balance. Schedule configurable in `season_config`. Default: 30-day warning, 14-day warning, 7-day warning, deadline-day notice.
FR-FUND-003 — After deadline: families who have not met fundraising target are flagged in admin dashboard for steering committee follow-up. No automatic lock.
FR-FUND-004 — Business sponsorships credited to family as fundraising credit via admin manual entry. `payment_transaction.transaction_type = sponsorship_credit`.

FR-RENEW-000 — Early warning: Approximately `season_config.aps_early_warning_days_before` days before their APS cert expiration date, volunteers whose cert expires before May 31 of the upcoming program year receive an early warning email. The email explains that their cert will expire this season and that they should complete APS training before or shortly after renewal opens. This notification goes to the volunteer only. No admin alert. System does not send this if cert is valid through May 31.

FR-RENEW-001 — Renewal opens on `season_config.volunteer_renewal_open_at` (standard: July 1). System sends renewal invitation email to all volunteers with `volunteer_status = cleared`. Invitation includes link to renewal flow in volunteer dashboard. Target completion: `season_config.volunteer_renewal_target_close_at` (standard: August 31).

FR-RENEW-002 — Renewal Step 1 (always required): Volunteer reviews current season youth protection policy and signs typed-name acknowledgment. System captures same evidence as a waiver signature (template ID, version, hash, typed name, consent checkbox, IP, timestamp).

FR-RENEW-003 — Renewal Step 2 (conditional): If youth protection policy has changed since volunteer's last acknowledgment (`waiver_template.version` changed), volunteer must retake the Youth Protection Policy quiz at 90%+ threshold. If unchanged, step skipped automatically.

FR-RENEW-004 — Renewal Step 3 (conditional): If volunteer's APS cert expires on or before May 31 of the program year, system auto-enrolls in new APS training via API when renewal opens and sends training link to volunteer. **The renewal flow is blocked from final submission until the APS completion webhook is received.** Volunteer may complete Steps 1 and 2 at any time but cannot complete renewal without APS. If cert is valid through May 31, step skipped automatically.

FR-RENEW-005 — Live Scan / CA DOJ is not repeated during annual renewal unless status was previously suspended or lapsed. System does not prompt for new background check on standard renewal.

FR-RENEW-006 — When all required steps complete: `volunteer_status` remains `cleared`. Renewal confirmation sent. Season renewal date recorded on `volunteer_profile`. Admin dashboard clears the renewal-outstanding flag for this volunteer.

FR-RENEW-007 — Target close date: `season_config.volunteer_renewal_target_close_at` (standard: August 31). After this date, admin dashboard surfaces all volunteers with incomplete renewal. No hard system lock — admin manages operationally.

FR-RENEW-008 — On APS cert expiration date: if APS training not complete, `volunteer_status → expired`. Volunteer removed from Google Groups and Slack on next sync. Volunteer receives expiration notification. Volunteer is blocked from operating as cleared volunteer.

FR-RENEW-009 — Reinstatement after expiration: volunteer may complete APS training at any time after expiration. On APS completion webhook: if `volunteer_status = expired`, system automatically restores `volunteer_status → cleared`. Google Groups and Slack restored on next sync. No admin action required. Admin notified of reinstatement.

**Critical:** APS completion webhook may only auto-reinstate from `volunteer_status = expired`. If `volunteer_status = suspended`, the APS webhook is recorded but does NOT trigger reinstatement. Suspended volunteers require Super Admin action regardless of APS completion status. This prevents APS training from bypassing a conduct, safety, or administrative suspension.

---

### 9.10 Quiz Engine

FR-QUIZ-001 — Admin-managed question bank: `youth_protection`, `lab_use`.
FR-QUIZ-002 — Question types: single correct, multiple correct.
FR-QUIZ-003 — Versioned. New version invalidates prior passing attempts.
FR-QUIZ-004 — 90% pass threshold, configurable.
FR-QUIZ-005 — Unlimited retakes. All attempts stored.
FR-QUIZ-006 — Pass: mark step complete, notify.
FR-QUIZ-007 — Admin: view attempt history per volunteer.

---

### 9.11 Team Management

FR-TEAM-001 — Unified `team` table. Program, division, team number (nullable, admin-assigned).
FR-TEAM-002 — `team_member` join table: enrollment or guardian, team role, active flag.
FR-TEAM-003 — V5/Combat: team assignment is managed via `team_member`. No team assignment is set at registration. Admin creates `team_member` rows post-registration when team numbers are confirmed.
FR-TEAM-004 — IQ: on student registration, a `team_member` row is created linking the enrollment to the selected IQ team with `team_role = student`. No `team_id` field exists on `enrollment`.
FR-TEAM-005 — All reassignments write audit log.

---

### 9.12 Google Group Sync

FR-SYNC-001 — Scheduled sync (default 15 min) and on-demand after enrollment/clearance/role changes.
FR-SYNC-002 — For each group: query desired membership, fetch current from Google Admin SDK, diff, batch add/remove.
FR-SYNC-003 — Email resolution: `google_email` → `login_email`.
FR-SYNC-004 — `sync_exclusion` table suppresses specified emails.
FR-SYNC-005 — All changes written to `sync_log`.
FR-SYNC-006 — Failures surfaced in admin dashboard.
FR-SYNC-007 — Board group excluded from automated sync.
FR-SYNC-008 — Admin may trigger manual sync.

---

### 9.13 Slack Integration

FR-SLACK-001 — On clearance: workspace invite to resolved email.
FR-SLACK-002 — On team confirmed: coach/manager invited to team channel.
FR-SLACK-003 — On team assignment + `student_slack_consent=true` + age ≥ 13: student invited to program channel.
FR-SLACK-004 — `cleared-parents` user group synced in both workspaces.
FR-SLACK-005 — Email resolution: `slack_email` → `login_email`.
FR-SLACK-006 — Failed invites logged and surfaced. Admin can resend.

---

### 9.14 Broadcasts

FR-BCAST-001 — Communications Admin and scoped Student Director may send broadcasts.
FR-BCAST-002 — Targets: defined groups, individual teams, custom recipient list.
FR-BCAST-003 — Sent via transactional email to resolved communication emails. Not sent to Google Group address directly.
FR-BCAST-004 — Logged in `notification_log`.
FR-BCAST-005 — Student Director scoped by `program_scope`. Cannot broadcast outside scope.

---

### 9.15 Engagement Events (Schema Defined, Admin UI Deferred)

FR-ENGAGE-001 — `engagement_event` and `engagement_attendance` tables defined in schema.
FR-ENGAGE-002 — Supports: try-it-out, info nights, RISE, Girl Powered, summer camp sessions, open labs, outreach events.
FR-ENGAGE-003 — Attendance records may reference an existing `student_application` (if applicant) or store name/email/grade/school for non-applicants.
FR-ENGAGE-004 — Admin UI for engagement events is deferred. A spreadsheet is used for tracking until the registration spine is stable.
FR-ENGAGE-005 — When admin UI is built: Registration Admin can see engagement attendance on `program_pending` application detail view. Admin can convert an attendance record to an application.

---

### 9.16 Fusion 360 Data Capture

FR-FUSION-001 — Guardian form: optional `fusion_education_email` field.
FR-FUSION-002 — Student registration: optional `fusion_education_email`. Requires `parent_email_access_certified=true`.
FR-FUSION-003 — Admin roster export includes Fusion education emails.
FR-FUSION-004 — No automated Fusion hub API integration. CAD lead manages hub invites manually.

---

### 9.17 Dashboards

FR-FDASH-001 — Family dashboard: registration status, payment status, financial-aid summary, volunteer clearance per guardian, team assignment, outstanding actions, Zeffy links, quiz links, APS training link.

FR-VDASH-001 — Volunteer dashboard: step status, APS link, quiz links, cert expiration, team assignments.

FR-ADMIN-001 — Admin dashboard sections: applications (with triage sub-queue for Not Sure), financial aid, registrations, IQ teams, V5 teams (including events.vex.com checklist), Combat teams, payments/fundraising, volunteer clearance (including annual renewal queue), team assignment, roster export, Google Group sync status, broadcast, unrecognized schools queue, season config, waiver templates, quiz management, admin user management, notification log, sync log, audit log.

---

### 9.18 Notifications

FR-NOTIFY-001 — Events: application submitted/accepted/declined/program-pending, financial-aid submitted/resolved, registration submitted, payment received/matched/unmatched, IQ team created/fee received/confirmed, volunteer step complete/cleared/cert expiring/expired/suspended, quiz passed, team assigned, Slack invite sent/failed, sync failure, school unrecognized, admin waiver used, student email updated.

FR-NOTIFY-001a — **Notification fan-out rule:** All notifications are sent to ALL guardian records in the family where `receives_notifications = true`. No notification ever goes to only one guardian. This is a foundational rule that applies to every notification type without exception.
FR-NOTIFY-002 — All notifications written to `notification_log` with one entry per recipient per notification event.
FR-NOTIFY-003 — Production email via transactional provider with SPF/DKIM/DMARC.

---

## 10. Data Model

All tables include `created_at timestamptz default now()`, `updated_at timestamptz` where mutable, indexes, foreign keys, RLS policies, and comments.

---

### 10.1 season_config
```
id                                uuid primary key
season                            text unique not null
application_open                  boolean not null default false
registration_open                 boolean not null default false
application_open_at               timestamptz nullable
application_close_at              timestamptz nullable
registration_open_at              timestamptz nullable
registration_close_at             timestamptz nullable
program_year_start                date not null
program_year_end                  date not null
fundraising_deadline              date not null
late_acceptance_grace_days        integer not null default 14
v5_combat_registration_fee        numeric not null default 40
iq_student_registration_fee       numeric not null default 0
iq_team_fee                       numeric not null default 1200
one_program_fundraising_target    numeric not null default 550
iq_default_fundraising_target     numeric not null default 0
min_gpa_threshold                 numeric nullable
volunteer_hours_required          integer not null default 8
zeffy_student_url                 text nullable
zeffy_iq_team_url                 text nullable
zeffy_donation_url                text nullable
student_waiver_template_id        uuid nullable
parent_waiver_template_id         uuid nullable
volunteer_waiver_template_id      uuid nullable
sync_schedule_minutes             integer not null default 15
volunteer_renewal_open_at         timestamptz nullable
volunteer_renewal_target_close_at timestamptz nullable
aps_early_warning_days_before     integer not null default 90
registration_active               boolean not null default false
sync_active                       boolean not null default false
program_year_active               boolean not null default false
active                            boolean not null default false
created_at
updated_at
```

**Season control flags (independent, Super Admin managed):**
- `registration_active` — registration form is open for families.
- `sync_active` — this season's enrollment drives Google Group and Slack group membership. Only one season should be `sync_active = true` at a time.
- `program_year_active` — the competition season is running. Used for display and operational context.
- `active` — this is the current platform season context (used for defaults and display).

Note: `both_programs_fundraising_target` removed. Students in multiple programs have one enrollment per program, each with its own fundraising target from `one_program_fundraising_target`. A student in V5 and Combat will have two enrollment records with two fundraising targets.

Note: `volunteer_renewal_open_at` standard = July 1. `volunteer_renewal_target_close_at` standard = August 31. `aps_early_warning_days_before` = 90 (approximately June 1 for May 31 expiry certs).

---

### 10.2 school
```
id              uuid primary key
name            text unique not null     -- canonical: "Cavitt Jr High"
short_name      text nullable            -- "Cavitt"
district        text nullable
city            text nullable
active          boolean not null default true
verified        boolean not null default false
created_at
updated_at
```

Note: Schools submitted via free-text that don't match existing records are created with `verified=false` and surfaced in admin dashboard for canonicalization.

---

### 10.3 family
Permanent. No season field.
```
id              uuid primary key
primary_email   text unique not null
secondary_email text nullable
status          family_status not null default 'active'
display_name    text nullable
admin_notes     text nullable
created_at
updated_at
```
**Enum family_status:** `active | suspended | archived`

Note: `display_name` derived from Guardian 1 last name ("Miller Family") on family creation. Editable by admin. Display label only — not a database key or unique constraint.

Note: `prospect`, `applied`, `registered` removed from family — those states live in `family_season.status`, `student_application.status`, and `enrollment` respectively. `family.status` represents the account state only.

---

### 10.3a family_season

Season-level family state. One record per family per season. Holds family-level gates and volunteer hour tracking that are season-specific but apply to the family as a whole rather than to a specific student enrollment.

```
id                          uuid primary key
family_id                   uuid not null references family(id)
season                      text not null
status                      family_season_status not null default 'prospect'
volunteer_hours_required    integer not null default 8
volunteer_hours_completed   integer not null default 0
financial_aid_prompt_shown  boolean not null default false
financial_aid_prompt_answer family_aid_prompt_answer nullable
current_season_notes        text nullable
created_at
updated_at
```

**Unique constraint:** `(family_id, season)`

**Enum family_season_status:**
`prospect | applied | accepted | cleared_to_register | registered | declined | suspended`

Note: `pending_financial_aid` removed. Financial aid never gates family season status.

**Enum family_aid_prompt_answer:** `yes | no`

Note: `family_season.status` drives the family-level registration gate. For a family with two students, this status represents the family's overall season state. Each student's application status lives on `student_application`. The family can be in `cleared_to_register` even if one student's application is still pending, provided the other student's application was accepted.

`financial_aid_prompt_shown` and `financial_aid_prompt_answer` track whether the family has answered the financial aid prompt for this season, preventing duplicate prompts across multiple student registrations in one session.

---

### 10.4 guardian
```
id                        uuid primary key
family_id                 uuid not null references family(id)
first_name                text not null
last_name                 text not null
relationship              text nullable
login_email               text not null
communication_email       text nullable
slack_email               text nullable
phone                     text not null
street_address            text nullable
city                      text nullable
state                     text nullable
zip_code                  text nullable
role                      guardian_role not null
can_authenticate          boolean not null default true
employer                  text nullable
employer_match_pct        numeric nullable
occupation                text nullable
volunteer_interests       text[] nullable
slack_user_id             text nullable
slack_invite_status       slack_invite_status nullable
last_login_at             timestamptz nullable
created_at
updated_at
```
**Enum guardian_role:** `primary | secondary | single_guardian | extended_family | other`

Note: `single_guardian_duplicate` removed. If a single guardian, one record with `role = single_guardian`.

Note: `relationship` is free text — "parent", "stepparent", "grandparent", "aunt", "foster parent", etc. Not an enum due to the variety of family structures.

Note: `is_emergency_contact` removed from guardian. Emergency contacts who are not program participants (grandparents called in emergencies only) live in the `emergency_contact` table. Guardians with `role = primary | secondary | single_guardian` are always reachable via their phone and are de facto emergency contacts.

Note: `can_authenticate = true` by default for all guardians. Magic link auth resolves against `login_email` across ALL guardian records in the family — not just the primary guardian. Either parent can log in independently.

Note: `receives_notifications = true` by default. **All notifications go to ALL guardians where `receives_notifications = true`.** This is a foundational rule — no notification ever goes to only one parent. A guardian may opt out (rare) but the default is always all guardians.

**Unique constraint:** `login_email` must be unique across guardian records. Two guardians cannot share the same login email.

Note: `slack_email` — once set, changes require admin action. The Slack API cannot rename or merge accounts. Users should be warned on first entry: "This email will be used for your Slack invitation. Contact your admin if you need to change it later."

**Slack invite status:** `not_sent | sent | accepted | failed`

---

### 10.4a emergency_contact

Emergency-only contacts who have no program involvement — grandparents, aunts/uncles, neighbors called in emergencies. No portal access, no program notifications.

```
id              uuid primary key
family_id       uuid not null references family(id)
student_id      uuid nullable references student(id)
first_name      text not null
last_name       text not null
phone           text not null
relationship    text nullable
priority        integer not null default 1
notes           text nullable
created_at
updated_at
```

Note: `student_id` nullable — an emergency contact may be for the whole family or for a specific student (e.g. in split-custody situations where different contacts apply to different custody periods).

Note: `priority` = call order. 1 = call first, 2 = call second, etc.

Note: Emergency contacts are never duplicated from guardian records. If a grandparent is both an emergency contact AND a cleared volunteer, they have a `guardian` record (for program access) AND may have an `emergency_contact` record if the family wants them on the emergency call list with a specific priority order.

---

### 10.5 student
```
id                          uuid primary key
family_id                   uuid not null references family(id)
first_name                  text not null
last_name                   text not null
preferred_name              text nullable
communication_email         text nullable
slack_email                 text nullable
fusion_education_email      text nullable
phone                       text nullable
street_address              text nullable
city                        text not null
state                       text nullable
zip_code                    text not null
grade                       integer not null
school_id                   uuid nullable references school(id)
school_raw                  text nullable
birthdate                   date nullable
under_13_confirmed          boolean nullable
tshirt_size                 tshirt_size nullable
status                      student_status not null default 'pending'
created_at
updated_at
```
**Enum student_status:** `pending | active | suspended | withdrawn | aged_out`

Note: `street_address` and `state` added. Student address = primary residence. `city` and `zip_code` are `not null`. `street_address` and `state` collected at registration.

Note: `fusion_education_email` is on the student record only — not on guardian. This is the student's Fusion 360 education account email.

Note: `school_id` is set when admin canonicalizes the school. `school_raw` stores the original submitted value and is never overwritten.

---

### 10.5a emergency_contact

Emergency-only contacts with no program involvement. No portal access. No program notifications.

```
id              uuid primary key
family_id       uuid not null references family(id)
student_id      uuid nullable references student(id)
first_name      text not null
last_name       text not null
phone           text not null
relationship    text nullable
priority        integer not null default 1
notes           text nullable
created_at
updated_at
```

Note: `student_id` nullable — may be family-wide or student-specific (split custody situations).
Note: `priority` = call order (1 = call first).
Note: Never duplicated from guardian records. A grandparent who is both an emergency contact AND a volunteer has both a `guardian` record and an `emergency_contact` record.

---

### 10.6 student_application
Season context lives here.
```
id                        uuid primary key
family_id                 uuid not null references family(id)
student_id                uuid not null references student(id)
season                    text not null
program_interest          program_selection not null
program_interest_final    program_selection nullable
status                    application_status not null default 'submitted'
gpa_overall               numeric nullable
gpa_recent_term           numeric nullable
gpa_flagged               boolean not null default false
referral_source           text nullable
previous_experience       text[] nullable
skills_interest           text[] nullable
teammate_preference       text nullable
motivation_background     text nullable
motivation_goals          text nullable
extracurriculars          text nullable
summer_availability       summer_availability nullable
triage_notes              text nullable
source                    application_source not null default 'platform'
reviewed_by               uuid nullable references admin_profile(id)
reviewed_at               timestamptz nullable
review_notes              text nullable
waived_by                 uuid nullable references admin_profile(id)
waived_at                 timestamptz nullable
waiver_notes              text nullable
submitted_at              timestamptz not null default now()
created_at
updated_at
```
**Unique:** `(student_id, season)`
**Enum application_status:** `submitted | needs_follow_up | program_pending | accepted | declined | withdrawn | admin_waived`
**Enum program_selection:** `vex_v5 | combat | vex_iq | not_sure`
**Enum application_source:** `platform | google_form_sync | admin_waived | migration`

Note: `source = google_form_sync` identifies applications synced from the Google Form during Phase 1 (through August 31, 2026). `source = platform` identifies applications submitted through `/apply`. `source = admin_waived` identifies admin-created bypass records. `source = migration` identifies records from the historical ETL.

Note: `both` has been removed from program_selection. Students enrolled in multiple programs receive one enrollment record per program.
**Enum summer_availability:** `yes | maybe | no`

---

### 10.7 financial_aid
One record per student per season. Financial aid is per student application, not per family.
```
id                              uuid primary key
family_id                       uuid not null references family(id)
student_application_id          uuid nullable references student_application(id)
enrollment_id                   uuid nullable references enrollment(id)
season                          text not null
status                          financial_aid_status not null default 'pending'
govt_program_name               text nullable
need_description                text nullable
resolution_type                 financial_aid_resolution nullable
original_fundraising_target     numeric nullable
adjusted_fundraising_target     numeric nullable
fundraising_waived_amount       numeric nullable
registration_fee_waiver_requested boolean not null default false
registration_fee_waived         boolean not null default false
registration_fee_waiver_reason  text nullable
registration_fee_waiver_admin_id uuid nullable references admin_profile(id)
registration_fee_waiver_at      timestamptz nullable
admin_notes                     text nullable
requested_at                    timestamptz not null default now()
resolved_by                     uuid nullable references admin_profile(id)
resolved_at                     timestamptz nullable
created_at
updated_at
```
**Enum financial_aid_status:** `pending | approved | denied | withdrawn`
**Enum financial_aid_resolution:** `full_waiver | partial_waiver | denied`

**Field notes:**
- `original_fundraising_target`: copied from `season_config` at time of financial aid request. Preserved for audit even if season_config changes later.
- `adjusted_fundraising_target`: the amount still owed after waiver. Set by Financial Aid Admin on partial or full waiver.
- `fundraising_waived_amount`: `original - adjusted`, computed and stored for clarity.
- `registration_fee_waiver_requested`: family may request fee waiver as part of aid request. Does not grant it.
- `registration_fee_waived`: true only when Super Admin explicitly grants fee waiver. Automated financial aid resolution may never set this.
- `registration_fee_waiver_reason`: required if `registration_fee_waived = true`.
- `registration_fee_waiver_admin_id`: Super Admin who granted the fee waiver.

Note: "Any scenario where $40 fee is automatically waived?" — the answer is no. This field exists solely for explicit Super Admin override with full audit trail. Removed from open questions.

---

### 10.8 team
```
id                            uuid primary key
season                        text not null
program                       team_program not null
division                      division not null
team_number                   text nullable
team_name                     text nullable
school_org                    text not null
status                        team_status not null default 'pending'
team_fee_amount               numeric nullable
team_fee_status               team_fee_status nullable
team_payment_reference_code   text unique nullable
events_vex_com_registered     boolean not null default false
slack_channel_id              text nullable
slack_channel_name            text nullable
created_at
updated_at
```
**Enum team_program:** `vex_v5 | vex_iq | combat`
**Enum division:** `middle | high`
**Enum team_status:** `pending | pending_payment | pending_admin_confirmation | active | suspended | withdrawn`
**Enum team_fee_status:** `not_applicable | unpaid | paid`

---

### 10.9 enrollment
Season context lives here. One record per student per program per season. A student enrolled in both V5 and Combat has two enrollment records.
```
id                              uuid primary key
family_id                       uuid not null references family(id)
student_id                      uuid not null references student(id)
student_application_id          uuid nullable references student_application(id)
season                          text not null
program                         program_selection not null
division                        division not null
payment_reference_code          text unique not null
registration_fee_amount         numeric not null
registration_fee_status         registration_fee_status not null default 'unpaid'
registration_fee_paid_at        timestamptz nullable
fundraising_target              numeric not null
fundraising_collected           numeric not null default 0
fundraising_status              fundraising_status not null default 'not_started'
sponsorship_credit              numeric not null default 0
financial_aid_id                uuid nullable references financial_aid(id)
waiver_status                   waiver_status not null default 'pending'
parent_email_access_certified   boolean not null default false
student_communication_consent   boolean not null default false
student_slack_consent           boolean not null default false
submitted_at                    timestamptz nullable
submission_ip                   text nullable
created_at
updated_at
```
**Unique:** `(student_id, season, program)`

Note: `team_id` removed. Team assignment is canonical on `team_member`. A student in both V5 and Combat will have two `enrollment` records and two `team_member` rows (one per program team). The unique constraint is now `(student_id, season, program)` to support multi-program enrollment.

**Enum registration_fee_status:** `unpaid | paid | waived`

Note: `waived` requires Super Admin action with mandatory audit entry. Registration fee waiver details tracked on `financial_aid` record.

**Enum fundraising_status:** `not_started | partial | complete | waived`
**Enum waiver_status:** `pending | complete | needs_review`

---

### 10.10 team_member
Canonical team assignment table for both students and coaches/managers.
```
id              uuid primary key
team_id         uuid not null references team(id)
enrollment_id   uuid nullable references enrollment(id)
guardian_id     uuid nullable references guardian(id)
student_id      uuid nullable references student(id)
season          text not null
team_role       team_role not null
program         program_selection not null
status          team_member_status not null default 'confirmed'
created_at
updated_at
```
**Enum team_role:** `student | coach | manager | assistant`
**Enum team_member_status:** `draft | confirmed`

Note: Returning V5/Combat students may receive a `draft` team_member row based on prior season assignment. Admin confirms or updates. IQ student assignments created as `confirmed` at registration time.

Note: `student_id` added for direct reference in addition to `enrollment_id`. Constraint: at least one of `enrollment_id` or `guardian_id` must be non-null. For student rows, both `enrollment_id` and `student_id` should be set. For coach/manager rows, `guardian_id` is set. `program` field enables correct Google Group routing for multi-program students.

---

### 10.11 person_role
```
id                  uuid primary key
guardian_id         uuid not null references guardian(id)
role                person_role_type not null
season              text nullable
granted_by          uuid nullable references admin_profile(id)
granted_at          timestamptz not null default now()
revoked_at          timestamptz nullable
active              boolean not null default true
created_at
updated_at
```
**Enum person_role_type:** `steering_committee | camp_staff | board`

---

### 10.12 payment_transaction
```
id                      uuid primary key
family_id               uuid not null references family(id)
enrollment_id           uuid nullable references enrollment(id)
team_id                 uuid nullable references team(id)
season                  text not null
source                  payment_source not null
source_payment_id       text nullable
amount                  numeric not null
payment_type            payment_type not null
donor_name              text nullable
donor_email             text nullable
payment_reference_code  text nullable
received_at             timestamptz not null
matched_status          matched_status not null default 'unmatched'
matched_by              uuid nullable references admin_profile(id)
matched_at              timestamptz nullable
notes                   text nullable
raw_payload             jsonb nullable
created_by              uuid nullable references admin_profile(id)
created_at
```
**Enum payment_source:** `zeffy | check | benevity | corporate_platform | cash | manual_adjustment | other`
**Enum payment_type:** `registration_fee | iq_team_fee | fundraising | sponsorship | in_kind | unknown`
**Enum matched_status:** `unmatched | auto_matched | manually_matched | ignored | needs_review`

**Constraint:** `UNIQUE (source, source_payment_id) WHERE source_payment_id IS NOT NULL` — prevents duplicate rows from webhook/polling race conditions on the same external payment.

---

### 10.13 volunteer_profile
```
id                  uuid primary key
guardian_id         uuid unique not null references guardian(id)
family_id           uuid not null references family(id)
status              volunteer_status not null default 'pending'
applied_at          timestamptz nullable
cleared_at          timestamptz nullable
suspended_at        timestamptz nullable
suspension_reason   text nullable
aps_user_id         text nullable
aps_training_url    text nullable
slack_invited               boolean not null default false
unifi_credential_id         text nullable
unifi_credential_status     unifi_credential_status nullable
unifi_provisioned_at        timestamptz nullable
unifi_revoked_at            timestamptz nullable
created_at
updated_at
```
**Enum volunteer_status:** `pending | in_progress | cleared | expired | suspended | withdrawn`
**Enum unifi_credential_status:** `not_provisioned | provisioned | revoked`

---

### 10.14 volunteer_step
```
id              uuid primary key
volunteer_id    uuid not null references volunteer_profile(id)
step            volunteer_step_type not null
status          step_status not null default 'pending'
completed_at    timestamptz nullable
completed_by    uuid nullable references admin_profile(id)
notes           text nullable
created_at
updated_at
```
**Unique:** `(volunteer_id, step)`
**Enum volunteer_step_type:** `policy_acknowledgment | background_check | aps_youth_protection | youth_protection_quiz | lab_use_quiz | lab_orientation | custom`

Note: `custom` step type supports admin-added quizzes or acknowledgments beyond the standard set.
**Enum step_status:** `pending | in_progress | complete | waived`

---

### 10.15 youth_protection_cert
```
id                    uuid primary key
volunteer_id          uuid not null references volunteer_profile(id)
aps_cert_id           text nullable
cert_url              text nullable
issued_date           date not null
expiration_date       date not null
reminder_60_sent      boolean not null default false
reminder_30_sent      boolean not null default false
expired_processed     boolean not null default false
created_at
updated_at
```

---

### 10.16 quiz
```
id              uuid primary key
quiz_type       quiz_type not null
title           text not null
version         text not null
pass_threshold  numeric not null default 0.90
active          boolean not null default true
created_by      uuid nullable references admin_profile(id)
created_at
updated_at
```
**Unique:** `(quiz_type, version)`
**Enum quiz_type:** `youth_protection | lab_use`

---

### 10.17 quiz_question
```
id              uuid primary key
quiz_id         uuid not null references quiz(id)
question_text   text not null
question_type   question_type not null
options         jsonb not null
correct_answers jsonb not null
order_index     integer not null
created_at
updated_at
```
**Enum question_type:** `single_correct | multiple_correct`

---

### 10.18 quiz_attempt
```
id              uuid primary key
volunteer_id    uuid not null references volunteer_profile(id)
quiz_id         uuid not null references quiz(id)
quiz_version    text not null
answers         jsonb not null
score           numeric not null
passed          boolean not null
attempted_at    timestamptz not null default now()
created_at
```

---

### 10.19 waiver_template
```
id              uuid primary key
waiver_type     waiver_type not null
version         text not null
title           text not null
body_markdown   text not null
body_hash       text not null
effective_date  date not null
retired_at      timestamptz nullable
active          boolean not null default false
created_by      uuid nullable references admin_profile(id)
created_at
updated_at
```
**Unique:** `(waiver_type, version)`
**Enum waiver_type:** `student_participation | parent_participation | volunteer | expectations_agreement | youth_protection_summary | center_use_summary`

---

### 10.20 waiver_signature
Append-only.
```
id                          uuid primary key
waiver_template_id          uuid not null references waiver_template(id)
family_id                   uuid not null references family(id)
guardian_id                 uuid not null references guardian(id)
student_id                  uuid nullable references student(id)
enrollment_id               uuid nullable references enrollment(id)
volunteer_id                uuid nullable references volunteer_profile(id)
season                      text not null
waiver_type                 waiver_type not null
waiver_version              text not null
body_hash                   text not null
typed_name                  text not null
electronic_consent_checked  boolean not null
read_and_agree_checked      boolean not null
authenticated_email         text not null
ip_address                  text not null
user_agent                  text nullable
signed_at                   timestamptz not null default now()
created_at
```

---

### 10.21 engagement_event
```
id              uuid primary key
season          text not null
event_type      engagement_event_type not null
event_name      text nullable
event_date      date not null
location        text nullable
notes           text nullable
created_by      uuid nullable references admin_profile(id)
created_at
updated_at
```
**Enum engagement_event_type:** `try_it_out | info_night | rise | girl_powered | summer_camp | outreach | open_lab | other`

---

### 10.22 engagement_attendance
```
id                          uuid primary key
engagement_event_id         uuid not null references engagement_event(id)
student_application_id      uuid nullable references student_application(id)
name                        text nullable
email                       text nullable
grade                       integer nullable
school_id                   uuid nullable references school(id)
school_raw                  text nullable
attended                    boolean not null default true
notes                       text nullable
created_at
updated_at
```

Note: `student_application_id` is null for non-applicants. When an applicant is identified, admin links the attendance record to their application. Admin may convert an attendance record to a new application.

---

### 10.23 sync_exclusion
```
id              uuid primary key
email           text unique not null
reason          text nullable
added_by        uuid nullable references admin_profile(id)
created_at
updated_at
```

---

### 10.24 sync_log
```
id              uuid primary key
sync_type       sync_type not null
group_email     text nullable
slack_group     text nullable
action          sync_action not null
email           text not null
resolved_from   text nullable
success         boolean not null
error_message   text nullable
created_at      timestamptz not null default now()
```
**Enum sync_type:** `google_group | slack_user_group | slack_channel_invite`
**Enum sync_action:** `add | remove | invite`

---

### 10.25 admin_profile
```
id              uuid primary key
auth_user_id    uuid unique not null
email           text unique not null
display_name    text nullable
active          boolean not null default true
created_at
updated_at
```

---

### 10.26 admin_role_assignment
```
id                  uuid primary key
admin_profile_id    uuid not null references admin_profile(id)
role                admin_role not null
program_scope       program_selection nullable
granted_by          uuid nullable references admin_profile(id)
granted_at          timestamptz not null default now()
revoked_at          timestamptz nullable
created_at
```
**Enum admin_role:** `super_admin | registration_admin | financial_aid_admin | payment_admin | volunteer_admin | iq_coordinator | program_lead | board_member | communications_admin | student_director | read_only_admin`

Note: `program_lead` — scoped to one program (V5 or Combat). Access to all data for their program only. `board_member` — read-only access to financial summaries and org-level dashboards. Full role permission matrix to be defined in Release 5.

Note: `iq_coordinator` role has access to IQ team management, IQ team confirmation, IQ student roster, events.vex.com checklist, and volunteer clearance queue for IQ coaches. Functions as a scoped Volunteer Admin + Registration Admin for IQ programs only.

---

### 10.27 notification_log
```
id                  uuid primary key
family_id           uuid nullable references family(id)
volunteer_id        uuid nullable references volunteer_profile(id)
recipient_email     text not null
notification_type   text not null
subject             text nullable
provider            text nullable
provider_message_id text nullable
status              notification_status not null default 'queued'
error_message       text nullable
sent_at             timestamptz nullable
created_at
```
**Enum notification_status:** `queued | sent | failed | skipped`

---

### 10.28 admin_action_log
Append-only. Server-side writes only.
```
id              uuid primary key
actor_admin_id  uuid nullable references admin_profile(id)
actor_email     text not null
action_type     text not null
target_table    text not null
target_id       uuid not null
old_values      jsonb nullable
new_values      jsonb nullable
notes           text nullable
created_at      timestamptz not null default now()
```

---

## 11. Row-Level Security Summary

RLS at database layer. Application-layer checks required but not sufficient.

**Family:** own records only. Cannot access other families, admin notes, financial-aid admin content, audit logs, sync logs.

**Super Admin:** all records.

**Registration Admin:** applications (no financial-aid content), family/student/enrollment, rosters, team assignment, school canonicalization queue, `program_pending` triage, engagement attendance.

**Financial Aid Admin:** financial-aid records, family/student context.

**Payment Admin:** payment transactions, enrollment fee/fundraising, team fee fields.

**Volunteer Admin:** volunteer profiles, steps, certs, quiz attempts, IQ team checklist.

**Communications Admin:** notification log, sync log (read), group membership queries.

**Student Director:** limited roster for assigned program only.

**Read-only Admin:** limited roster/status.

`waiver_signature`, `admin_action_log`, `sync_log`: insert only, no update or delete, server-side path only.

---

## 12. Integrations

### 12.1 Zeffy
REST API, Bearer token, server-side only. Webhook `payment.completed`. Polling fallback. Manual override always available.

### 12.2 APS / MinistrySafe
Full integration. Exact endpoints confirmed from APS sandbox before coding.

### 12.3 Google Admin SDK
Service account with domain-wide delegation. Replaces sync_script.py. Board group excluded.

### 12.4 Slack API
Two bot tokens: `SLACK_BOT_TOKEN_MAIN`, `SLACK_BOT_TOKEN_IQ`.

### 12.5 CA DOJ
No API. Admin marks complete.

### 12.6 events.vex.com
No API. Admin checklist item on VEX V5 and VEX IQ team records. Admin marks `events_vex_com_registered = true` after confirming external registration. Combat teams have no events.vex.com requirement.

### 12.7 Fusion 360
No API. Education emails stored and exported. CAD lead manages hub manually.

### 12.8 VolunteerLocal
No integration. Email stored for future use.

---

## 13. Non-Functional Requirements

**Performance:** 3s page load on LTE, 50 concurrent users, 500 families in admin, 1,000 records CSV export, full sync cycle under 5 minutes.

**Security:** HTTPS/TLS 1.2+, no payment card data, no background check results, no student login, RLS at DB layer, all secrets in env vars, never in Git, append-only audit tables, no direct client writes to audit/sync logs, under-13 Slack hard-blocked server-side.

**Privacy:** collect only necessary data, no SSNs/financial documents/LiveScan results, student email requires parent certification, data deletion/export process documented before go-live, COPPA/SOPIPA review before go-live.

**Reliability:** Supabase Pro backups, separate dev/prod, migration-based schema, rollback procedure documented, notification and sync failures visible to admin, manual payment fallback always available.

**Maintainability:** TypeScript, database migrations, README, no hardcoded season values, Git + CI/CD.

**Accessibility:** WCAG 2.1 AA, mobile responsive, 375px viewport, no app download required.

---

## 14. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, TypeScript, React, Tailwind, Goldman (display headings), Inter (body/UI) |
| Hosting | Vercel (hub.placerrobotics.org) |
| Database / Auth | Supabase Postgres, Supabase Auth, Supabase RLS |
| Email | Resend, SendGrid, or Postmark |
| Payments | Zeffy (webhook + API + manual) |
| Volunteer certs | APS / MinistrySafe API |
| Messaging | Slack API (nonprofit free, main + iq) |
| Group sync | Google Admin SDK (service account) |
| Repo | GitHub, protected main, preview deploys, Supabase migrations |

---

## 15. Codex Build Plan

One task at a time. Typecheck after each. The full schema is built in Release 1 — all tables, even those needed for later releases. Features are built and deployed in staged releases to reduce launch risk.

### Release Model

| Release | Scope | Go-Live Gate |
|---|---|---|
| **Release 1 — Registration Spine** | Schema, RLS, auth, application, financial aid, registration form, manual payment, roster export, data migration | Families can apply, get accepted, register, and pay. Admin can manage roster. |
| **Release 2 — Payment Automation + IQ** | Zeffy webhook + polling, IQ team creation + payment, IQ student registration | Payments auto-reconcile. IQ teams functional. |
| **Release 3 — Volunteer Clearance** | Volunteer application, CA DOJ tracking, APS API, quizzes, lab orientation, auto-clearance, cert expiration | Coaches and volunteers can clear. |
| **Release 4 — Google/Slack Sync** | Scheduled sync job, Google Admin SDK, Slack invitations, sync_log, exclusion table | Supabase replaces sync_script.py. |
| **Release 5 — Dashboards + Broadcasts** | Family dashboard, volunteer dashboard, broadcasts, student director role, advanced admin views | Self-service visibility for families and volunteers. |
| **Release 6 — Renewal Automation** | Annual renewal flow, APS re-enrollment, early warning emails, renewal gate | Volunteer renewal fully automated. |

The schema for all releases is built in Task 2. Do not build only the Release 1 tables — building the complete schema once is cheaper than schema migrations mid-release.

---

**Task 0 — Repo and Docs**
Create all docs files and README.

**Task 1 — Scaffold**
Next.js + TypeScript + Tailwind + Supabase. Inter font configured globally. Routes: `/login`, `/apply`, `/iq-team/create`, `/register`, `/dashboard`, `/volunteer`, `/admin`. Public routes excluded from auth. Env var validation. Deploy to Vercel, configure `hub.placerrobotics.org`.

**Task 1.5 — Design System and UX Shell** *(Release 1 — before any product screens)*
```
Implement the base design system before building product screens.

CSS custom properties (in globals.css or design-tokens.css):
--color-navy-deep: #0E2558
--color-navy-darker: #071A3D
--color-charcoal: #16181E
--color-gold: #F2C352
--color-gold-dark: #D9A820
--color-gold-light: #F8E4A3
--color-blue-gray: #7E8FB9
--color-bg-light: #F5F6F8
--color-surface: #FFFFFF
--color-border: #DDE2E8
--color-text-primary: #1F2933
--color-text-muted: #5F5D60
--color-success: #2E7D32
--color-warning: #B7791F
--color-error: #C62828
--color-info: #2563EB
--color-program-v5: #2563EB
--color-program-iq: #F2C352
--color-program-combat: #D95B3D
--color-program-general: #7E8FB9

Create reusable components:
- PublicShell (unauthenticated: /apply, /iq-team/create)
- FamilyShell (authenticated family pages)
- AdminShell (authenticated admin pages)
- PageHeader
- StepChecklist, StepChecklistItem
- StatusBadge (always includes text, never color alone)
- ActionCard
- FormSection, FormField
- InfoAlert, WarningAlert, ErrorAlert, SuccessAlert
- PaymentReferenceCard (with copy button)
- AdminQueueTable, AdminDetailPanel
- AuditTrailCard
- EmptyState, LoadingState, PermissionNotice
- PrimaryButton, SecondaryButton, DangerButton

Typography: Inter. Body 15-16px. Labels 12-13px medium weight.
Do not expose raw database terminology to family users.
Family pages: action/checklist-oriented.
Admin pages: queue-oriented.
```

**Task 1.6 — Static Wireframe Routes** *(Release 1 — before data wiring)*
```
Create static, non-functional wireframe pages using mock data only.
Do not connect to Supabase yet.

Required routes:
- /apply
- /financial-aid
- /register
- /registration/confirmation
- /dashboard
- /admin

Recommended additional routes:
- /admin/applications
- /admin/financial-aid
- /admin/payments
- /volunteer
- /iq-team/create

Each page must demonstrate:
- Family checklist UX (action-first, plain English, no database terms)
- Queue-based admin UX (Needs Attention home, not a table)
- Payment and fundraising separation (always separate, never combined)
- Payment reference code with copy button
- Financial aid gate privacy language
- Mobile-first single-column layout at 375px
- Navy/gold/white visual system
- Program accent badges for VEX V5, VEX IQ, Combat
- Status badges with text (never color alone)

These pages allow non-technical stakeholders to review the product before database wiring begins.
No product screen shall be wired to live data until its static wireframe has been reviewed.
```

**Task 2 — Database Migration (complete schema)**
Full schema per Section 10 — all tables including those needed for later releases. Enums, constraints, indexes, triggers, comments. Seed `season_config` (with `sync_active = true` for 2026-27) and `school` table. Bootstrap migration from `BOOTSTRAP_ADMIN_EMAIL`. Idempotent.

**Task 2a — Phase 1 Application Sync Job** *(Release 1 — immediate priority)*
```
Build the live sync job that reads from Google Sheets registration sheet
and upserts records into Supabase.

This is the highest priority task after schema deployment.
2026-27 applications are actively coming in and must be visible
in the platform admin dashboard.

Source: REGISTRATION_SHEET_ID (same sheet as sync_script.py)
Target: Supabase via REST API

Behavior:
- Run every 15 minutes (configurable)
- Upsert logic on guardian email (family key) + student name
- Create family_season record with status=applied, season=2026-27
- Field mapping per PRD Section 18.3
- Set student_application.source = google_form_sync
- Do NOT set consent flags (parent_email_access_certified etc.)
- Fuzzy match school names against school table
- Unknown schools: create with verified=false, surface in admin queue
- Dry-run mode default
- Idempotent
- Error log per row, continue on errors
- Summary report output

Sunset: August 31, 2026. After this date the sync job is decommissioned.

Also build the one-time historical ETL script for prior-season data
(2025-26 enrolled students, cleared volunteers) per PRD Section 18.4.
This runs once after schema deployment, before Phase 1 sync goes live.
```

**Acceptance:** Sync job runs. New Google Form submissions appear in Supabase admin dashboard within 15 minutes. Historical data imported. Dry-run mode works. Summary report outputs correctly.

**Task 3 — RLS Policies**
Per Section 11. Financial aid separated at row policy. Append-only enforced. Server-side audit path only. `family_season` RLS: family users access only their own records.

**Task 4 — Authentication**
Magic-link login. Role detection and redirect. Admin route protection. Student Director path via `@placerrobotics.org`.

**Task 5 — Public Application (V5/Combat)**
Canonical form per Section 5. School autocomplete. GPA threshold flag. Compliance notices. Creates `family_season` record on first application for the season. Duplicate email handling.

**Task 6 — IQ Team Creation and Payment** *(Release 2)*
Public form at `/iq-team/create`. Coach family/guardian. Team record. Payment reference code. Zeffy link. School autocomplete.

**Task 7 — Admin Application Review**
Queue with sub-queues: standard, Not Sure/program-pending, GPA-flagged. Accept/decline/triage/program-pending. Admin application waiver. School canonicalization. Audit log. Updates `family_season.status`.

**Task 8 — Financial Aid Gate**
Prompt, request, lock. Uses `family_season.financial_aid_prompt_shown/answer` to prevent duplicate prompts for multi-student families. Financial Aid Admin resolution. Captures `original_fundraising_target`. Fee untouched. Audit log.

**Task 9 — Registration Form (V5/Combat)**
Gate: `family_season.status = cleared_to_register`. All sections. Creates one enrollment per program (no `program = both`). Team assignment via `team_member`. Compliance notices. Waiver evidence. Consent flags on enrollment.

**Task 10 — IQ Student Registration** *(Release 2)*
Team selection. Zero fee. Consent flow. Enrollment.

**Task 11 — Manual Payment Dashboard** *(Release 1 for manual entry, Release 2 for automation)*
Manual payment entry. Unmatched queue. Fee status. Fundraising status. Audit log. Payment reference code on enrollment.

**Task 11a — Zeffy Payment Automation** *(Release 2)*
Webhook endpoint. Polling fallback. Automated matching. `UNIQUE (source, source_payment_id)` enforced. IQ team fee handling.

**Task 12 — Volunteer Clearance Workflow** *(Release 3)*
Application, waiver, APS API, CA DOJ admin-mark, quizzes linked, orientation, auto-clearance, cert expiration scheduler, Slack invite trigger, suspension. APS webhook reinstatement scoped to `expired` only.

**Task 13 — Quiz Engine** *(Release 3)*
Question bank, versioning, attempts, pass/fail, step completion trigger.

**Task 14 — Google Group Sync** *(Release 4)*
Scheduled sync job. Google Admin SDK. Email resolution. Diff. Batch. `sync_log`. Exclusion table. Manual trigger. Board excluded. Reads `sync_active` from `season_config` — only syncs the active sync season.

**Task 15 — Slack Integration** *(Release 4)*
Clearance invite. Team channel invite. Student program invite. `cleared-parents` sync. Both workspaces. Failed invite handling.

**Task 16 — Family Dashboard** *(Release 5)*
Registration status, payment status, financial-aid summary, volunteer clearance, team assignment, outstanding actions, student email update flow.

**Task 17 — Volunteer Dashboard** *(Release 5)*
Step status, APS link, quiz links, cert expiration, team assignments.

**Task 18 — Team Admin Dashboards** *(Release 1 for basic, Release 5 for full)*
Clearance queue, step management, uncleared coach flags. IQ team confirmation, team number, external checklist. V5 team dashboard with events.vex.com checklist. Coach assignment tool.

**Task 18a — Annual Volunteer Renewal** *(Release 6)*
August renewal trigger. Policy re-acknowledgment. Conditional quiz retake. Conditional APS re-enrollment with completion gate. Renewal queue. August 31 target dashboard. Post-expiry reinstatement (from `expired` only).

**Task 19 — Team Assignment and Broadcast** *(Release 1 for assignment, Release 5 for broadcasts)*
Bulk team assignment via `team_member`. Team number assignment. Broadcast tool (scoped by role).

**Task 20 — Roster Export and Fusion Export**
CSV roster. Fusion education email export. Financial aid excluded from standard export.

**Task 21 — Production Readiness**
All docs: deployment, bootstrap, email setup, Google sync setup, APS notes, Zeffy notes, Slack setup, go-live checklist. README complete.


---

## 15a. Organization Account Holder Policy

Some Placer Robotics participants — including student directors and other program leads — receive `@placerrobotics.org` Google Workspace accounts. These may be minors. This is separate from the platform's family login system.

**Policy (go-live operational requirement, not system-enforced):**

1. `@placerrobotics.org` accounts assigned to minors require parent/guardian acknowledgment before account activation. This acknowledgment is documented outside the platform (Google Workspace admin, email confirmation, or signed form).
2. Account provisioning happens in Google Workspace by the Super Admin — the platform does not provision Google Workspace accounts.
3. When a minor holding a `@placerrobotics.org` account is granted a Student Director or other limited admin role in this platform, the Super Admin documents the parent/guardian acknowledgment in the admin action log at time of role grant.
4. Accounts are provisioned on an as-needed, season-by-season basis. The platform's admin role assignment records when roles were granted and by whom.

This is an operational compliance item, not a system feature. Document the process before go-live.

---

## 16. Open Questions Before Go-Live

### Legal / Insurance
1. Does insurance require Parent Participation Waiver from all parents or only participating parents?
2. Final waiver language approved?
3. Typed-name acknowledgment approved by counsel/insurance?
4. California Civil Code 1542 language approved?
5. COPPA posture reviewed for under-13 7th graders?
6. Does PART's nonprofit extracurricular status subject student data to SOPIPA or AB 1584?
7. Is parent certification sufficient for 13–15 student communication email and Slack consent?
8. Organization account holder policy for minors with `@placerrobotics.org` accounts — documented and acknowledged?

### Application
1. Minimum GPA threshold confirmed? (Needed for `season_config.min_gpa_threshold` seed value.)
2. Is "Not Sure" program interest available for IQ applications, or V5/Combat only?
### Payment / Fundraising
1. Does Zeffy provide a webhook signing secret?
2. Does Zeffy support custom fields for reference code capture?
3. How should business sponsorships be credited to families?
4. IQ coach who is also a parent on the team: how is $1,200 team fee handled in family payment records? (Recommendation: team fee belongs to the team record, not the student's fundraising. If coach is also a parent, it appears as a team payment in the family dashboard, not as student fundraising credit.)

### Operations
1. Fundraising deadline: **August 31** (confirmed).
2. Registration opening date: ASAP — days, not weeks (confirmed).
3. T-shirt sizes: same as last season XS/S/M/L/XL (confirmed — provide sheet if enum needs updating).
4. Combat team/pod size limits per team? (open)
5. When will `sync_active` flip from 2025-26 to 2026-27? Kevin decides. (open)
6. Zeffy: does your current Zeffy account have a webhook signing secret available? (open — confirm before Task 11a)
7. School domain blocklist for student email warning — provide list of known school domains in your area. (open)

### Technical
1. Transactional email provider: **not yet selected**. Options: Resend (recommended for Next.js), SendGrid, Postmark. Decide before Task 4.
2. Production domain: **hub.placerrobotics.org** (confirmed).
3. APS: fetch works manually, polling/webhook not yet implemented. Confirm sandbox credentials available before Task 12.
4. Google Admin SDK service account: needs to be created with domain-wide delegation before Task 14.
5. `BOOTSTRAP_ADMIN_EMAIL`: **kevin.miller@placerrobotics.org** (confirmed).
6. Supabase Pro: confirmed.
7. Slack apps: can be created for both workspaces (confirmed).
8. Zeffy API key: available (confirmed). Webhook signing secret: check dashboard.
9. Google Admin user email for SDK delegation: confirm before Task 14.
10. Fusion 360: verify no API exists before finalizing integration section.

---

## 17. Developer Guardrails

1. One Codex task at a time. Typecheck after each.
2. No `season` field on `family` table. Season context flows through `family_season`, `student_application`, and `enrollment`.
3. Automated financial aid resolution never touches `registration_fee_status`, `registration_fee_amount`, `registration_fee_waived`, or any registration fee field. Those are Super Admin only.
4. Bootstrap is SQL only. No "first person to sign in becomes admin."
5. No hardcoded season values or magic numbers anywhere.
6. No RLS bypass via client-side filtering.
7. No secrets in code or Git.
8. No direct client writes to `admin_action_log`, `sync_log`, or `waiver_signature`.
9. Registration Admin cannot see financial-aid content.
10. Board group excluded from automated Google Group sync.
11. Student Slack consent hard-blocked for under-13 — server-side check, not UI only.
12. No team numbers collected at team creation.
13. APS endpoint names confirmed from sandbox docs before coding.
14. Zeffy webhook field names confirmed from live dashboard before coding.
15. No payment plans. Words "payment plan" must not appear in codebase.
16. `/apply` and `/iq-team/create` excluded from auth middleware.
17. Email resolution for Google Groups: `google_email` → `login_email`. No external mapping sheet.
18. Email resolution for Slack: `slack_email` → `login_email`.
19. Student Director role scoped by `program_scope`. Cannot broadcast outside scope.
20. No student login of any kind.
21. `school_raw` is never overwritten after submission. Canonicalization sets `school_id` only.
22. GPA threshold flags applications — it never auto-declines.
23. `admin_waived` application status requires mandatory notes and audit log entry.
24. Migration script must have dry-run mode and be idempotent.
25. `program = both` does not exist. Multi-program students have one enrollment per program.
26. `enrollment.team_id` does not exist. All team assignments live in `team_member`.
27. `family.payment_reference_code` does not exist. Payment codes belong to `enrollment` and `team`.
28. `payment_transaction` must have `UNIQUE (source, source_payment_id) WHERE source_payment_id IS NOT NULL`. Enforce at schema level.
29. APS completion webhook may only auto-reinstate from `volunteer_status = expired`. Never from `suspended`.
30. Google Group sync only runs for the season where `sync_active = true`. Never drop families based on calendar date.
31. Only one season should have `sync_active = true` at a time. Enforce in application logic — Super Admin manages this.
32. `family_season` must be created when a family first applies for a season. Not on family account creation.

**UX Guardrails (from ux_requirements_v1_0.md):**

33. Do not expose raw database terminology to family users.
34. Do not build family pages as CRUD screens.
35. Do not build admin home as one giant table.
36. Do not combine registration fee and fundraising into one payment amount.
37. Do not place waivers at the beginning of registration.
38. Do not make financial aid feel stigmatizing.
39. Do not show financial-aid details to Registration Admin.
40. Do not rely on color alone for status — always include text in status badges.
41. Do not use black/gold as the dominant web-app theme.
42. Do not make VEX V5, VEX IQ, and Combat feel like separate websites.
43. Do not use program accent colors beyond badges, chips, small markers, and filters.
44. Do not build a product screen against live data until the corresponding static wireframe exists.
45. Do not assume Netlify-specific or Cloudflare edge runtime behavior — deploy target is Vercel.
46. Do not create a family-level payment reference code unless family-level billing is explicitly added.
47. Do not frame student-written answers as direct student submission.
48. Do not implement Google/Slack sync as family-facing complexity.
49. Do not use Goldman 1 or event/camp display fonts in the portal UI — Inter throughout.
50. Program accent colors: VEX V5 = `#2563EB`, VEX IQ = `#F2C352`, Combat = `#D95B3D`, General = `#7E8FB9`. No other program colors.
51. Family status labels must use plain English (see ux_requirements_v1_0.md Section 6.1). Never raw enum values.
52. Admin home must always show a "Needs Attention" queue as the landing view, not a table.
53. Financial aid is never a gate — registration must never be locked pending financial aid resolution.
54. `family_season.status` must not include `pending_financial_aid` — that state does not exist.
55. Volunteer clearance Step 0 (role interest) does not exist — policy acknowledgment is Step 1.
56. Cert expiry revokes UniFi door access only — never removes from Google Groups or Slack.
57. UniFi API credentials must be server-side environment variables only — never client-side.
58. APS webhook reinstatement restores UniFi credentials only if prior revocation reason was cert expiry, not suspension.
59. IQ team creation collects parent emails, not student emails.
60. IQ Coordinator (not the coach) creates/updates the team in events.vex.com.
61. Adding a program requires admin pre-approval — families cannot self-initiate.
62. Each new student must apply — there is no self-service "add sibling" family action.
63. Phase 1 sync job must not set consent flags (`parent_email_access_certified`, `student_communication_consent`, `student_slack_consent`) — those are collected at registration.
64. Phase 1 sync job must set `student_application.source = google_form_sync` on all synced records.
65. Phase 1 sync job hard sunset: August 31, 2026. Decommission after this date.
66. Historical ETL script and Phase 1 sync job both require dry-run mode as default. Never run in live mode without reviewing dry-run output first.
67. Magic link auth must resolve against ALL guardian login_email values in a family — not just the primary guardian record.
68. No notification ever goes to only one guardian — always fan out to all guardians where receives_notifications = true.
69. `single_guardian_duplicate` role does not exist — use `single_guardian`.
70. `is_emergency_contact` field does not exist on guardian — emergency contacts live in the `emergency_contact` table.
71. Same-address UX: Guardian 2 address defaults to same as Guardian 1 with one checkbox. Unchecking reveals separate address fields.
72. Volunteer ETL must not run without `include_in_migration = yes` filter — Kevin must scrub the list first.
73. Volunteer migration sets `policy_acknowledgment` step to pending for all records — never complete.
74. Volunteer migration does not automate UniFi — surfaces cert expiration report for admin review only.
75. `receives_notifications` field does not exist on guardian — all guardians always receive all notifications.
76. `volunteerlocal_email` field does not exist anywhere in the schema — VolunteerLocal has no API.
77. `fusion_education_email` exists on `student` only, not on `guardian`.
78. `family.display_name` is a display label only — never used as a database key or unique constraint.
79. Slack channel names are stored on the `team` record, admin-managed. Never auto-generated from team number alone.
80. At least one of `team.team_number` OR `team.team_name` must be non-null — enforce as DB check constraint.
81. IQ team creation requires authenticated session — `/iq-team/create` is NOT a public route.
82. $1,200 IQ team fee is NOT a donation — Zeffy automatic receipts must be DISABLED for the IQ fee campaign.
83. Student email school domain warning is a warning, not a block — user confirms to proceed.
84. Financial aid v1 links to existing Google Form — platform does not build financial aid form in Release 1.

---

## 18. Data Migration and Live Sync Approach

### 18.1 Two-Phase Model

**Phase 1 — Live sync (now through August 31, 2026)**

The existing Google Form and Sheets-based application process is retained for the 2026-27 application season. A scheduled sync job reads from the Google Sheets registration sheet and upserts records into Supabase. The new platform admin dashboard surfaces all applications including synced ones during this period.

Hard cutoff: **August 31, 2026**. After this date, the Google Form is retired and all new applications go through `/apply` on the platform. The sync job is decommissioned.

**Phase 2 — Platform live (September 1, 2026 onward)**

All new applications, registrations, and data entry go through the platform. Historical records from Phase 1 are already in Supabase. The Google Sheets registration sheet becomes read-only historical reference.

---

### 18.2 Phase 1 Sync Job

**Source:** Google Sheets registration sheet (REGISTRATION_SHEET_ID), same sheet used by sync_script.py.

**Target:** Supabase via REST API or direct Postgres connection.

**Schedule:** Runs every 15 minutes (same cadence as Google Group sync job, configurable).

**Behavior:**
- Upsert logic on unique fields (guardian email → family, student name + guardian email → student).
- Creates `family_season` record with `status = applied`, `season = 2026-27` on first sync of each applicant.
- Best-effort field mapping per Section 18.4.
- Flags records with mapping ambiguities for admin review (unrecognized school, unparseable DOB, etc.).
- Dry-run mode available for testing.
- Idempotent — safe to run repeatedly without creating duplicates.
- Error logging per row. Script continues on row-level errors.
- Summary report: records created, updated, skipped, errors, flags.

**Sync job is separate from the Google Group sync job** but shares the same Google Sheets API credentials and scheduling infrastructure.

---

### 18.3 Field Mapping — Google Form to Supabase Schema

| Google Form Field | Schema Target | Notes |
|---|---|---|
| Student First Name | `student.first_name` | Clean |
| Student Last Name | `student.last_name` | Clean |
| Preferred Name / Nickname | `student.preferred_name` | Clean |
| Student Email | `student.communication_email` | Sync as-is. Consent collected at registration — family may remove. No consent flags set on synced records. |
| Student Phone | `student.phone` | Clean |
| Date of Birth | `student.birthdate` | Normalize to ISO date format. Flag unparseable values. |
| Home Address (City, State, ZIP) | `student.city`, `student.zip_code` | Split on comma. Flag if format unexpected. |
| Grade Entering (Fall 2026) | `student.grade` | Clean integer. |
| School Attending | `student.school_raw` + fuzzy match → `student.school_id` | Fuzzy match against `school` table. Unrecognized schools: create `school` record with `verified=false`, surface in admin canonicalization queue. |
| Current Overall GPA | `student_application.gpa_overall` | Clean numeric. |
| Most Recent GPA (last term) | `student_application.gpa_recent_term` | Clean numeric. |
| Which programs are you interested in? | `student_application.program_interest` | Map checkboxes: VEX V5 → `vex_v5`, Combat → `combat`, Not Sure → `not_sure`. |
| Previous Robotics Experience | `student_application.previous_experience` | Array of strings. |
| Skills excited about | `student_application.skills_interest` | Array of strings. |
| List teammates you'd like to work with | `student_application.teammate_preference` | Clean text. |
| Student Background (Tell us about yourself) | `student_application.motivation_background` | Concatenate with "Why join" and "Why competitive robotics" answers, separated by `\n\n---\n\n` |
| Why do you want to join Placer Robotics? | `student_application.motivation_background` | See above — concatenated |
| Why do you want to be on a competitive robotics team? | `student_application.motivation_background` | See above — concatenated |
| Personal goals for the season | `student_application.motivation_goals` | Clean text. |
| Other extracurriculars + hours/week | `student_application.extracurriculars` | Clean text. |
| Summer camp availability | `student_application.summer_availability` | Map yes/maybe/no → enum. |
| Who referred you? | `student_application.referral_source` | Clean text. |
| Parent/Guardian 1 Name | `guardian.first_name`, `guardian.last_name` | Split on first space. Flag if unparseable. |
| Parent/Guardian 1 Email | `guardian.login_email` (primary) | Family record keyed on this. |
| Parent/Guardian 1 Phone | `guardian.phone` | Clean. |
| Parent/Guardian 2 Name | `guardian.first_name`, `guardian.last_name` | Second guardian record, `role = secondary`. |
| Parent/Guardian 2 Email | `guardian.login_email` | Second guardian record. |
| Parent/Guardian 2 Phone | `guardian.phone` | Clean. |
| Volunteer interests (parents) | `guardian.volunteer_interests` | Array. Applied to Guardian 1. |
| Parent Occupation | `guardian.occupation` | Clean. Applied to Guardian 1. |
| Anything else we should know? | `student_application.motivation_background` | Append to concatenated field if present. |

**Sync job sets on all synced applications:**
- `student_application.status = submitted`
- `student_application.season = 2026-27`
- `student_application.source = google_form_sync`
- `family_season.status = applied`
- `family_season.season = 2026-27`

**Sync job does NOT set:**
- `parent_email_access_certified`, `student_communication_consent`, `student_slack_consent` — all remain `false` until registration consent flow
- Any payment or enrollment fields
- Any waiver fields

---

### 18.3a Volunteer Data Migration

Volunteer data migrated from the volunteer registration sheet (`VOLUNTEER_REG_SHEET_ID`).

**Pre-migration requirement:** Kevin adds an `include_in_migration` column (yes/no) to the volunteer sheet and manually marks each volunteer before the ETL runs. The ETL only processes rows where `include_in_migration = yes`. This is a human judgment call — volunteers not returning, volunteers whose students have aged out, etc. are excluded.

**Field mapping:**

| Sheet Column | Schema Target | Notes |
|---|---|---|
| First Name, Last Name | `guardian.first_name/last_name` | Match to existing guardian by email first. Create new guardian + family if no match. |
| Email Address | `guardian.login_email` | Primary match key. |
| Cell Phone | `guardian.phone` | Clean. |
| Submission Date | `volunteer_profile.applied_at` | |
| UserID / ExternalID | `volunteer_profile.aps_user_id` | Use whichever is non-null. |
| APS/Cert Date | `youth_protection_cert.issued_date` | |
| Certificate Expiration Date | `youth_protection_cert.expiration_date` | First occurrence (APS cert). |
| DOJ Clear | `volunteer_step` background_check → complete | Only if marked clear. |
| RC Quiz | `volunteer_step` lab_use_quiz → complete | Only if passed. |
| AB506 YP Quiz | `volunteer_step` youth_protection_quiz → complete | Only if passed. |
| Finished Orientation | `volunteer_step` lab_orientation → complete | Only if complete. |
| Approved! | `volunteer_profile.status = cleared` | Only if true. |
| Door access status | `volunteer_profile.unifi_credential_status` | Informational only — no automated UniFi action at migration time. |
| Program(s) involved with | `guardian.volunteer_interests` | Array. |

**Do not migrate:** IQ/V5 coach columns (handled via team schema), Mandated Reporter columns (no longer accepted), APS score, guardian street address, Signature (insufficient evidence), all script control columns, Ready to Approve.

**Initial state for all migrated volunteers:**
- `volunteer_step policy_acknowledgment` → `status = pending` (must complete at first renewal — all volunteers redo this season)
- All other completed steps → `status = complete` per sheet data
- `volunteer_profile.status = cleared` if Approved! = true

**Volunteers with no students in system:**
Create standalone `family` + `guardian` records. No `family_season` record. They appear in volunteer admin dashboard. They log in via their guardian email when volunteer module goes live.

**Migration summary report must include:**
- Total rows in sheet
- Rows skipped (include_in_migration ≠ yes)
- Rows processed
- Matched to existing guardian vs. new guardian created
- Cert already expired at time of migration (expiration_date < migration date)
- Cert expiring before May 31, 2027 (require APS renewal this season)
- Cert valid through May 31, 2027 (policy acknowledgment only at renewal)

UniFi access: not automated at migration. Admin reviews expired-cert report and handles manually.

---

### 18.4 Historical Data Migration (Prior Seasons)

For prior season enrolled students and cleared volunteers not captured by the Phase 1 sync, a one-time historical ETL script runs after the schema is deployed.

**Source:**
- Registration Sheet: enrolled students from 2025-26, guardian info, program, team, payment status.
- Volunteer Registration Sheet: cleared volunteers, clearance status.

**Targets:**

| Source | Target |
|---|---|
| Guardian email rows | `family` + `guardian` records |
| Student rows | `student` records |
| Program/team data | `enrollment` records (season = 2025-26) |
| Cleared volunteer rows | `volunteer_profile` with `status = cleared` |
| Payment status | `enrollment` fee/fundraising summary fields |

Prior-season enrolled students receive `admin_waived` application records for 2025-26:
- `status = admin_waived`
- `waived_by = migration_admin_profile_id`
- `waiver_notes = "Migrated from legacy Google Sheets registration — [date]"`

---

### 18.5 Sync and Migration Script Requirements

Both the Phase 1 sync job and the historical ETL script share these requirements:

- Written in Python, consistent with sync_script.py conventions.
- Google Sheets API read-only scope.
- Supabase REST API or direct Postgres connection for writes.
- Dry-run mode: logs all intended changes without executing. Default for first run.
- Idempotent: upsert logic on unique fields. Safe to run repeatedly.
- Exclusion-aware: respects `sync_exclusion` table.
- School canonicalization: fuzzy match against `school` table. Unknown schools created with `verified=false`.
- Error logging per row. Continues on row-level errors.
- Summary report: records created, updated, skipped, errors, admin flags.

---

### 18.6 Deployment Sequence

**Release 1 (immediate priority):**
1. Deploy schema (Task 2).
2. Run historical ETL script (dry-run, then live) — prior season data.
3. Deploy Phase 1 sync job — begins ingesting new 2026-27 applications from Google Sheets.
4. Verify admin dashboard shows synced applications correctly.

**August 31, 2026:**
5. Google Form retired.
6. Phase 1 sync job decommissioned.
7. All new applications go through platform `/apply`.

**Ongoing:**
8. Admin reviews school canonicalization queue.
9. Admin reviews flagged sync records.


---

## 19. Definition of Done

1. New family can apply (V5/Combat). Compliance notices displayed. GPA flagged if below threshold. Certifications collected.
2. Returning family applies without duplicate family record.
3. "Not Sure" applicant routed to triage sub-queue.
4. Admin can triage Not Sure applicant, set `program_interest_final`, move to accepted.
5. Admin can waive application for known family with mandatory notes and audit entry.
6. Admin accepts/declines without seeing financial aid.
7. Accepted or waived family can log in.
8. Family requests and receives financial aid resolution. Fundraising adjusts. Fee unchanged.
9. Super Admin can manually waive fee with mandatory audit entry.
10. V5/Combat student completes registration. Enrollment and waiver signatures created. Consent collected.
11. Under-13: COPPA cert shown. Slack consent hard-blocked.
12. IQ coach creates team, pays via Zeffy, receives confirmation.
13. IQ team confirmed by admin. IQ students register and attach.
14. IQ external checklist tracked.
15. Zeffy webhook receives payments, creates transactions, auto-matches.
16. Zeffy polling runs as fallback.
17. Unmatched payments surface in queue.
18. Manual payment entry works.
19. Volunteer applies. APS email sent. CA DOJ marked by admin. Steps tracked. Auto-clearance fires. Cert expiration handled.
20. Quizzes completable. Pass marks step. Fail allows retake.
21. Lab orientation marked by admin.
22. Cleared volunteer receives Slack workspace invite.
23. Google Group sync runs on schedule and on-demand. Email resolution uses `google_email`/`login_email`. No mapping sheet consulted.
24. Board group not touched by sync.
25. Sync failures surfaced in admin dashboard.
26. Coach receives Slack channel invite on team confirmation.
27. Student program channel invite respects consent and age gate.
28. `cleared-parents` synced in both workspaces.
29. School autocomplete works. Free-text fallback creates unverified school. Admin can canonicalize.
30. Student email update resets consent flags and re-syncs Slack.
31. Family and volunteer dashboards show correct status and outstanding actions.
32. Admin assigns V5/Combat teams and team numbers post-registration.
33. Broadcasts sent by Communications Admin and scoped Student Director.
34. Roster CSV exports correctly. Financial aid excluded from standard export. Fusion emails included.
35. Migration script runs in dry-run mode without errors. Live mode imports existing families, students, volunteers with correct records and `admin_waived` application status.
36. RLS prevents cross-family access.
37. Admin role restrictions enforced at database layer.
38. Audit, notification, and sync logs recording correctly.
39. No season values hardcoded.
40. Bootstrap Super Admin via SQL migration.
41. Production on Supabase Pro with backups.
42. All go-live legal/insurance/minor-data questions resolved or explicitly accepted by leadership.

---

*This document supersedes all prior versions. v1.1 through v1.12 are retired.*
