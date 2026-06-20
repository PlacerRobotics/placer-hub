# PLACER ROBOTICS
## Registration Platform — Functional Flow Document
**Version 1.6**

| Field | Value |
|---|---|
| Organization | Placer Advanced Robotics and Technology, dba Placer Robotics |
| Document Type | Functional Flow / Business Process Narrative |
| Companion Documents | product_requirements_v1_11.md, ux_requirements_v1_0.md, workflow_diagrams_v1_1.html |
| Version | 1.6 |
| Status | Draft — Pre-Implementation |
| Owner | Kevin Miller, Executive Director |
| Classification | Confidential — Internal Use Only |

---

## Version History

### v1.6 Changes (this version)
1. Phase 1 application sync model added — Google Form retained through August 31, 2026.
2. Field mapping from Google Form to Supabase schema documented.
3. Student email from form synced to communication_email; consent collected at registration.
4. Data migration section updated to reflect two-phase model.

### v1.5 Changes (prior version)
Financial aid gate removed, volunteer clearance corrected, UniFi added, IQ team corrected.

1. Financial aid gate removed from all flows — financial aid is self-service via registration form callout, never a mandatory step.
2. Volunteer clearance Step 0 (role interest) removed. Policy acknowledgment added as Step 1.
3. Cert expiry: UniFi door access revoked, NOT Google Groups or Slack.
4. UniFi credential provisioning added to auto-clearance flow.
5. IQ team creation corrected: parent emails collected (not student emails), IQ Coordinator sends magic links, admin handles events.vex.com.
6. Returning flows reframed as student-centric — each new student applies, program addition requires admin pre-approval.
7. Admin program confirmation added to acceptance step for multi-program/Not Sure applicants.

### v1.4 Changes (prior version)
Companion documents updated, Both removed, sync_active rollover, renewal calendar normalized.

1. Companion documents updated to product_requirements_v1_11.md, ux_requirements_v1_0.md, workflow_diagrams_v1_1.html.
2. "V5, Combat, or Both" replaced throughout — both programs creates separate enrollments.
3. Season rollover sync language updated — Google Group removal governed by sync_active flag, not calendar date.
4. Renewal "early August" replaced with July 1 standard / August 31 target language throughout.
5. Domain updated to hub.placerrobotics.org.

### v1.3 Changes (prior version)
Student-authored language corrected, GPA language normalized, multi-program enrollment language, payment end-state softened.

1. Student-authored application language corrected — parent/guardian is the submitting user; Section 3 answers should be in student's own words, parent certifies authorization.
2. GPA language normalized — "minimum GPA required" replaced with "flagged for admin review, not auto-declined" throughout.
3. Returning family section updated — `program = both` removed; multi-program students get one enrollment per program.
4. References updated to product_requirements_v1_11.md and functional_flow_v1_6.md.
5. Payment flow updated — unmatched/offline payments note added; Zeffy webhook is happy path, not guaranteed.

### v1.2 Changes (prior version)
Returning family six paths, annual renewal with APS gate, renewal calendar.

1. Returning family flows fully specified (Part 1.9) — six distinct paths: same program/team, switch team, add program, switch program, add sibling, IQ to V5 transition.
2. Annual renewal flow updated with early warning, renewal open date, APS completion gate, August 31 target, and post-expiry reinstatement detail.
3. Renewal calendar table added to Part 3.8.
4. Appendix A expanded with returning family and renewal decisions.

### v1.1 Changes (prior version)
1. Formal Trigger / Actors / Preconditions / Steps structure added to major workflows.
2. Financial aid resolution outcome table added.
3. Annual volunteer renewal workflow added.
4. V5 coach onboarding and Combat manager onboarding workflows added.
5. events.vex.com requirement corrected — applies to both V5 and IQ.

---

## How to Read This Document

This document describes how the Placer Robotics registration platform works from the perspective of every person who uses it. It is not a technical specification — that is product_requirements_v1_11.md. This document answers the question: *what actually happens, step by step, for each person involved?*

Flows are described in plain language. Where the system makes an automated decision or sends an automated communication, it is noted. Where a human admin must act, it is noted. Where a family or volunteer must act, it is noted.

Decision points are shown as **Decision:** blocks. Automated system actions are shown as **System:** blocks. Human actions are shown as the actor's name followed by the action.

---

## Part 1 — Family Flows

---

### 1.1 New Family — V5 or Combat Application

A parent hears about Placer Robotics through a school info night, a friend referral, a Granite Oaks or Cavitt info session, a summer camp, or the website. They navigate to `placerrobotics.org/apply` (or the Cavitt-branded form if referred through Cavitt).

The form opens without any login required.

**The parent begins Section 1 — Student Information.**

They enter the student's first and last name, preferred nickname if any, grade entering in Fall 2026, and school. The school field shows suggestions as they type from Placer Robotics' known school list. If their school isn't in the list, they type it as-is and it is accepted. They enter city and ZIP code so Placer Robotics can confirm the student is in the service area. Student email is optional — if the student has an email they use independently, they can provide it here. The form notes this may be used to communicate with the student directly.

They enter the student's current overall GPA and most recent term GPA. These are used as part of the acceptance review. A GPA is reviewed as part of application. Applications below the configured threshold are flagged for admin review but are not automatically declined. They enter who referred them to Placer Robotics, or N/A if none.

**The parent and student move to Section 2 — Program Interests.**

They select which programs the student is interested in: VEX V5, Combat Robotics, or Not Sure. They check any previous robotics experience and any skills the student already has or wants to develop. If the student has teammates in mind they'd like to work with, they can note them here.

**Section 3 — About You is completed by the student.**

A note at the top of this section reads: *Section 3 should be answered in the student's own words. The parent or guardian is the submitting user and certifies they are authorized to provide this information. We want to hear the student's voice directly in these answers.*

The student answers two long-form questions: one about their background, interests, and what draws them to robotics; one about their goals for the season and what they are willing to commit to make them happen. They also describe their other activities and how much time those take. Finally they answer whether they are available to help with summer camps or get an early start this summer.

Placer Robotics reads these responses carefully. Students who cannot explain why they want to join are unlikely to succeed in a program that requires 8–15 hours per week of commitment. The long-form questions are a filter, not a formality.

**Section 4 — Parent / Guardian Information is completed by the parent.**

The parent enters their own name, email, and phone. If there is a second guardian, they enter that information as well. If they are a single guardian, they note that. They select any areas they are interested in volunteering — lab supervision, events, combat mentoring, equipment management, fundraising, business/marketing, summer camps. They optionally share their profession or field, which helps Placer Robotics match mentoring opportunities with their background.

**Section 5 — Final Confirmation.**

The parent may add anything else they want Placer Robotics to know. They read the minor data collection notice, which explains how student information is used and protected. They check a certification box confirming they are the parent or legal guardian and are authorized to submit this application.

**System:** On submission, the system checks whether a family account already exists for the guardian's email address.

**Decision:** If a family account exists, the new application is associated with the existing family. No duplicate family record is created. If no family account exists, a new family record is created along with guardian records and the student record.

**System:** A `student_application` record is created with status `submitted`. A confirmation email is sent to both guardian emails. The application appears in the admin application queue.

If the student's school name was not recognized, it is flagged in the admin dashboard for canonicalization — an admin will confirm or correct the school name, which ensures the student appears in the right mailing list and Google Group later.

If the student's GPA is below the configured minimum threshold, the application is flagged in the admin queue with a visual indicator. The admin makes the final acceptance decision — the system does not auto-decline.

The family receives a confirmation email acknowledging receipt and explaining that they will hear back after admin review.

---

### 1.2 Admin Reviews the Application

A Registration Admin logs into the admin dashboard and opens the application queue. Applications are sorted by submission date. The queue shows student name, grade, school, program interest, guardian names, and submission date.

**The Registration Admin opens the application.**

They can see everything the family submitted: student information, GPA, program interest, previous experience, skills interest, teammate preferences, all three long-form answers, extracurriculars, summer availability, guardian information, and volunteer interests.

They cannot see anything related to financial aid — that information does not exist yet at this stage, and even if it did, Registration Admins are blocked from seeing it by design.

**The Registration Admin makes a decision.**

They may accept the application, decline it, mark it as needs follow-up, or — if the student selected Not Sure — move it to program pending for triage after an engagement event.

**If accepted:**
**System:** Application status updates to `accepted`. Family account status updates. An acceptance email is sent to both guardian emails. The email includes a login link and instructions directing the family to complete a financial assistance prompt before they can begin registration.

**If declined:**
**System:** Application status updates to `declined`. A decline notification is sent if configured. The family cannot proceed to registration for this application.

**If needs follow-up:**
The admin adds a note and the application stays in the queue for further action. This is used when information is missing or contact is needed before a decision can be made.

**If program pending (Not Sure applicants):**
The admin adds triage notes and the application moves to the program pending sub-queue. The family is not yet accepted or declined. See Section 1.3 for the Not Sure triage flow.

---

### 1.3 "Not Sure" Applicant Triage

Some students apply without knowing which program they want to join. This is expected and welcome. The process is designed to give them time and exposure before they commit.

After initial admin review, a Not Sure application moves to `program_pending`. The admin adds notes about the student — what they've said, what Placer Robotics knows about them so far, what engagement events they should attend.

**The student attends one or more engagement events:** an info night, a try-it-out session, an open lab, a summer camp, or a RISE or Girl Powered event. Attendance at these events is optionally tracked by admin in the system's engagement attendance records.

Over time, through these interactions, the student and their family get a sense of which program fits. Coaches and student directors may weigh in. The admin follows up.

**When the program is determined:**
The Registration Admin opens the application, updates `program_interest_final` to the confirmed program (V5, Combat, or Both), adds a triage note explaining how the decision was reached, and moves the application to `accepted`.

**System:** Acceptance email sent with login link and financial aid prompt instructions. Normal registration flow proceeds from here.

If the student never commits to a program, the application stays in program pending indefinitely or is eventually declined.

---

### 1.4 Admin Waiver of Application Requirement

For known returning families, coach-referred students, or families being migrated from the legacy system, a Registration Admin or Super Admin may bypass the formal application entirely.

The admin navigates to the family's record (or creates a new family record if the family is not yet in the system), finds or creates the student record, and creates an `admin_waived` application. They must enter a mandatory notes field explaining why the waiver was granted — for example: "Returning family, 3rd season, application waiver per Kevin" or "Migrated from 2025-26 Google Sheets registration."

**System:** An `admin_waived` application record is created. The action is written to the audit log with the admin's identity, the timestamp, and the notes. The family moves directly to the financial aid gate and then to registration, skipping the application queue entirely.

This is not a backdoor. It is a documented operational decision with a mandatory paper trail.

---

### 1.5 Financial Aid Gate

After acceptance (or admin waiver), the family logs in for the first time using the magic link sent in the acceptance email.

Before they can access the registration form, the system presents a single required question:

*Do you need to request financial assistance before completing registration?*

**Decision:** If the family answers No, they are marked cleared to register and proceed immediately to the registration form.

**Decision:** If the family answers Yes, they are presented with the financial assistance request form.

The financial aid form asks for: the name or category of any government assistance program the family participates in (SNAP, Medi-Cal, free/reduced lunch, etc.); a brief description of the family's financial situation and why assistance is needed; and any additional context they want to share. The form displays a confidentiality notice explaining that this information is seen only by financial aid reviewers and is never shared with the staff who review applications or assign teams.

The form does not ask for income amounts, tax returns, bank statements, or any document uploads.

**System:** A `financial_aid` record is created with status `pending`. The family's registration is locked. A notification is sent to Financial Aid Admins. The family sees a confirmation that their request has been received and will be reviewed.

**The Financial Aid Admin reviews the request.**

The Financial Aid Admin logs into a separate section of the admin dashboard that Registration Admins cannot access. They see the family's need description and program information. They decide:

**Financial Aid Resolution Outcomes:**

| Resolution | Fundraising Target | Registration Fee | Admin Notes Required | Registration |
|---|---|---|---|---|
| Full Waiver | Set to $0 | Unchanged ($40) | No | Unlocked |
| Partial Waiver | Set to adjusted amount entered by admin | Unchanged ($40) | Yes — adjusted amount | Unlocked |
| Denied | Unchanged (full target) | Unchanged ($40) | Optional | Unlocked |

**System:** The financial aid record is updated with the resolution. The family is notified of the outcome. If approved or partially approved, registration is unlocked. The family proceeds to the registration form.

The $40 registration fee is never automatically waived by financial aid resolution. Only a Super Admin may waive the registration fee, and doing so requires entering a reason and is permanently recorded in the audit log.

---

### 1.6 Registration — V5 and Combat

The family logs in and reaches the registration form. The form is pre-filled with everything submitted in the application — student name, grade, school, guardian contact information. They review and update anything that has changed.

**The registration form has the following sections:**

**Participant Information:** The family confirms or updates the student's name, grade, school, and division (Middle School or High School — determined by grade). They provide a t-shirt size. If the student has a direct communication email they want to use, it is collected here with the parent consent flow (see Section 1.7).

**Guardian Contacts:** The family reviews and updates their contact information. They are prompted to provide additional email addresses if relevant — a different email they actually check day-to-day, the email associated with their Slack account, the email associated with their Google account (for Shared Drive access), a Fusion 360 education license email if they do CAD work with students, and a VolunteerLocal email if they use VolunteerLocal. All of these are optional and clearly labeled with their purpose.

**Program Selection:** The family selects VEX V5, Combat Robotics, or Both. Team assignment is not part of registration — students are assigned to teams by admin after registration closes and team numbers are confirmed with GRSF.

**Fees and Fundraising:** The form displays the registration fee ($40) and the fundraising target for the selected program(s) — $550 for one program, $1,100 for both. If financial aid was approved, the adjusted fundraising target is shown instead. The payment reference code is generated and displayed. Instructions explain how to pay via Zeffy and how to submit offline payments (checks, Benevity, corporate matches).

**Volunteering and Role Interest:** The family confirms their volunteer interest and intent. They note how they plan to fulfill the 8-hour family event volunteer requirement. They indicate their intended fundraising approach — Zeffy donation, employer match, sponsorship, check — and their intended amount. If an employer match is involved, they provide the employer name.

**Expectations Acknowledgment:** The family reviews the student and family expectations for the season. The parent acknowledges the expectations and certifies that the student has reviewed them. The student's name is typed as acknowledgment within the parent-authenticated session.

**Policy Summaries:** The family acknowledges the youth protection policy summary and the robotics center use policy summary with checkboxes.

**Waiver Acknowledgment:** The active Student Participation Waiver and Parent Participation Waiver for the season are displayed in full. The parent types their name as an electronic signature, checks the electronic consent checkbox, and checks the read-and-agree checkbox. The system automatically records the timestamp, IP address, user agent, and the exact version and hash of the waiver text that was signed.

**Confirmation:** The family reviews a summary of their registration and submits.

**System:** An enrollment record is created. Waiver signature records are created with all evidence fields. A confirmation email is sent to both guardian emails. The confirmation page shows the Zeffy payment link, the payment reference code, the registration fee, the fundraising target, the deadline, and offline payment instructions.

**System:** Google Group sync is triggered. The student's family is added to the appropriate program and division mailing lists. The family's guardian email is added to `part-everyone`.

Team assignment is not shown — V5 and Combat students are assigned to teams by admin after registration closes.

---

### 1.7 Student Communication Email and Slack Consent

During registration, the parent is prompted to provide a direct communication email for the student. This step is optional.

The form explains: *We'd like to be able to communicate with your student directly — especially for high school students — for team updates, competition information, and program news. This is optional.*

If the parent provides a student email, they must:
1. Certify that they have access to that email account and can monitor it.
2. Optionally consent to Placer Robotics sending direct program emails to that address.
3. Optionally consent to that email being used to invite the student to the Placer Robotics Slack workspace.

If the student is confirmed to be under 13 (grade 6 or 7, or birthdate confirms it), the Slack consent checkbox is disabled. Slack's Terms of Service require users to be 13 or older. The system enforces this on the server side as well — it is not only a UI restriction.

These consent choices are re-collected each season. They do not carry forward from a prior registration.

If a parent needs to change the student's communication email mid-season, they do so from the family dashboard. The update form requires them to re-certify access and re-consent. The old email is removed from any Slack channels it was invited to. The new email is invited if consent is re-granted. The change is permanently recorded in the audit log, and a confirmation is sent to the parent's login email.

---

### 1.8 Registration — VEX IQ Students

VEX IQ registration follows the same path through application, financial aid, and the registration form — with two differences.

First, the registration fee for IQ students is $0. The team fee of $1,200 is paid by the coach, not the family. IQ families owe nothing by default, though they are shown an optional donation link.

Second, IQ students must select their team during registration. The form shows a list of active, confirmed IQ teams for the season. The student selects their team. Team assignment is set at registration, not by admin afterward.

If no IQ teams have been confirmed yet when a family tries to register, they must wait. The admin is responsible for ensuring IQ teams are active before opening IQ student registration.

---

### 1.9 Returning Family — New Season

Returning families are the majority of registrations each season. The system handles six distinct returning paths. In all cases, the family uses the same login email and the same family record — no new account is ever created for a returning family.

**What always resets each season:**
- Financial aid must be re-applied for every season. No prior approval carries forward.
- Waivers must be re-signed every season. No exceptions.
- Student communication consent must be re-certified at registration.

**What carries forward:**
- Family record, guardian records, student records, contact information (all pre-filled and editable).
- Volunteer clearance status (unless expired or suspended).
- Prior season enrollment history (visible to admin, not editable).

---

**Path 1 — Same Program, Same Team**

The most common returning path.

The family logs in and sees their dashboard showing prior season data. They initiate a new application for the returning student (or receive an admin waiver if admin fast-tracks them). They go through the financial aid gate — must answer fresh even if they received aid last season. They complete the registration form, which is pre-filled with all their existing information. They sign new waivers for the current season. The system pre-populates the team assignment with their prior season team. Admin confirms or adjusts after registration closes.

---

**Path 2 — Same Program, Different Team**

Identical to Path 1 from the family's perspective. The family registers for the same program. The system pre-populates the prior season team as the default. Admin updates the team assignment after registration — the family does not need to do anything different. The family will see the updated team assignment reflected in their dashboard once admin makes the change.

---

**Path 3 — Add a Program (e.g. V5 only → V5 + Combat)**

The family submits a new application indicating both programs or the newly added program. Admin reviews and accepts. The financial aid gate re-runs — a new season means new fees and potentially different financial circumstances. The registration form reflects the updated program selection. The fundraising target for each program enrollment is the one-program amount ($550 per program) from `season_config`. A student in both V5 and Combat has two enrollment records, each with a $550 fundraising target. A new enrollment record is created for the current season. Team assignment for the added program starts as unassigned — admin assigns after registration.

---

**Path 4 — Switch Program (e.g. V5 → Combat only)**

The family submits a new application indicating the new program. The prior season enrollment for the old program is preserved in history but does not carry forward. Admin reviews and accepts the new application. Financial aid gate re-runs. New enrollment created for the new program. Fundraising target reflects the one-program amount.

---

**Path 5 — Add a Sibling**

The parent logs into their existing family account. From the family dashboard or the application form, they initiate a new application for the additional student. A new `student` record is created under the existing `family` record — no new family account needed. Guardian records are shared. The new student's application goes through the standard review queue. Financial aid for the new student is handled separately in the financial aid gate before their registration.

---

**Path 6 — IQ to V5 Transition**

A student moving from VEX IQ to VEX V5 must submit a full V5 application through the standard application form. There is no automatic transition pathway. The prior IQ enrollment history is preserved on the student record and is visible to admin during application review — this gives the reviewer useful context about the student's experience.

Admin may use the `admin_waived` application status to fast-track a known IQ student whose transition is not in question, but this is a deliberate admin decision, not automatic. The student then proceeds through the financial aid gate and V5 registration. The registration fee ($40) and V5 fundraising target apply — IQ's $0 fee does not carry forward.

---

### 1.10 Returning Family — Dashboard Experience

When a returning family logs in at the start of a new season, their dashboard shows:

- Prior season enrollment records marked as prior season.
- Current season status: outstanding actions if any (application needed, financial aid pending, registration incomplete, payment outstanding).
- Volunteer clearance status for any guardian who is cleared or in progress.
- A prompt to begin the current season's process if they haven't started.

The dashboard never shows a blank slate to a returning family — their history is always visible and their current-season path is clearly indicated.

---

## Part 2 — VEX IQ Coach Flow

---

### 2.1 IQ Coach — Team Creation and Payment

A VEX IQ coach — typically a parent at a school who wants to start or continue an IQ team — navigates to `placerrobotics.org/iq-team/create`. No login is required.

The form collects: school or organization name, the coach's name, email, and phone, the division (Middle School or High School), an estimated team size, and an optional internal team name. There is no team number field — team numbers are assigned by admin after GRSF and VEX registration confirms them.

**System:** On submission, the system checks whether a family account already exists for the coach's email. If it does, the new team is associated with the existing family. If not, a new family and guardian record is created for the coach. A team record is created with `status = pending_payment`. A team payment reference code is generated.

A confirmation email is sent to the coach with the Zeffy IQ team payment link, the payment reference code, and instructions. The email explains that the team will be activated after payment is confirmed by admin.

**The coach pays $1,200 via Zeffy.**

**System:** Zeffy sends a `payment.completed` webhook. The system receives the webhook, creates a payment transaction record, and attempts to match it to the team using the payment reference code, the Zeffy payment ID, or the coach's email. On a successful match, the team `fee_status` updates to `paid` and the team `status` updates to `pending_admin_confirmation`. A Payment Admin is notified that a team payment has been received and is awaiting confirmation.

**Payment Admin or Super Admin reviews and confirms the team.**

The IQ Coordinator (or Super Admin) reviews the team submission and payment. On confirmation, team status → `active`. The system sends: (a) login link and clearance instructions to the coach, (b) magic link registration invitations to each parent/guardian email provided in the student roster. IQ student families may now complete registration and attach to this team.

**The admin also notes two outstanding items on the team record:**

1. **events.vex.com registration:** The IQ team must register separately at events.vex.com. This is an external requirement outside the platform. The admin marks `events_vex_com_registered = true` on the team record once they have confirmed this is done. The IQ team dashboard surfaces teams where this is incomplete.

2. **Team number:** The team number is assigned after GRSF/VEX confirms it. The admin enters the team number on the team record when it becomes available.

---

### 2.2 IQ Coach — Clearance

After team confirmation, the IQ coach proceeds through the standard volunteer clearance workflow. This is identical to the V5 coach and Combat team manager clearance process. See Part 3 — Volunteer Flows.

The coach's team is active and students may register regardless of the coach's clearance status. However, the admin dashboard surfaces a clearance-pending flag on any team where the coach is not yet cleared. Uncleared coaches are subject to California's mandated volunteer hours cap — the system does not track this, but admin is responsible for enforcing it operationally.

---

### 2.3 V5 Coach Onboarding

**Trigger:** Admin creates a VEX V5 team record and assigns a coach.

**Actors:** Registration Admin or Super Admin, Coach (guardian), System.

**Preconditions:** The guardian record for the coach exists or is created at assignment time. Team creation is admin-initiated — V5 coaches do not self-register teams.

**Step-by-Step Flow:**

1. Registration Admin or Super Admin opens the team management dashboard and creates a new V5 team record. They enter: school/organization name, division (MS/HS), optional team name. Team number is left blank — assigned after GRSF confirmation.

2. Admin selects the coach from existing guardian records or enters a new guardian (name, email, phone). The guardian is added to `team_member` with `team_role = coach`.

3. **System:** Sends the coach a notification email with a login link and instructions to begin volunteer clearance from their family dashboard.

4. Coach logs in and navigates to the volunteer section of their family dashboard. Coach initiates clearance. See Part 3 — Volunteer Flows for the 5-step clearance process.

5. While clearance is pending: team is active. Students may register and be assigned to the team. Admin dashboard shows clearance-pending flag on the team.

6. **Admin:** When the V5 team is registered at events.vex.com, marks `events_vex_com_registered = true` on the team record. The V5 team dashboard surfaces teams where this is incomplete.

7. **Admin:** When GRSF confirms the team number, enters it on the team record.

8. On clearance completion: coach is added to the appropriate V5 coach Google Group (`v5-hs-coaches` or `v5-ms-coaches`) and Slack workspace on the next sync cycle.

**Outcome table:**

| Step | Who Acts | System Response |
|---|---|---|
| Team created, coach assigned | Admin | Coach notification email sent |
| Coach initiates clearance | Coach | Volunteer profile created, 5 steps opened |
| Clearance pending | — | Clearance-pending flag on team in dashboard |
| events.vex.com registered | Admin marks | Flag cleared in V5 team dashboard |
| Team number confirmed | Admin enters | Team record updated |
| Clearance complete | System (auto) | Coach added to Google Group + Slack |

---

### 2.4 Combat Team Manager Onboarding

**Trigger:** Admin creates a Combat team record and assigns a manager.

**Actors:** Registration Admin or Super Admin, Manager (guardian), System.

**Preconditions:** Guardian record for the manager exists or is created at assignment time. No team fee. No external registration requirement.

**Step-by-Step Flow:**

1. Registration Admin or Super Admin creates a Combat team record. Enters: school/organization, division (MS/HS), optional team name/identifier. No team fee. No events.vex.com requirement.

2. Admin assigns manager from existing guardian records or creates new guardian. Added to `team_member` with `team_role = manager`.

3. **System:** Sends manager notification email with login link and clearance instructions.

4. Manager logs in and initiates volunteer clearance from family dashboard. Same 5-step clearance process as all volunteers. See Part 3.

5. While clearance is pending: team is active, students may be assigned. Clearance-pending flag shown in admin dashboard.

6. No external checklist items. No team number from GRSF — admin assigns a team identifier internally.

7. On clearance completion: manager added to appropriate Combat coach Google Group and Slack workspace on next sync.

**Key difference from V5/IQ:** No events.vex.com step. No external registration. No team fee. Admin creates the team entirely — manager does not self-register.

---

## Part 3 — Volunteer Flows

---

### 3.1 Parent Volunteer — Initiating Clearance

A parent who has completed registration for their student, or who is a Placer Robotics family member interested in volunteering, may initiate the volunteer clearance process from their family dashboard.

The family dashboard shows a section for each guardian who has not yet started clearance, with a prompt: *Interested in volunteering? Start your clearance here.*

The guardian clicks to begin. The system displays the Volunteer Data Notice, which explains how clearance information is used and stored. Background check results are not stored in the system — only the fact of completion and the date.

**The guardian initiates clearance from the family dashboard.** For parents already in the system through a student application, no new guardian record is created — the existing record is used. The system displays the Volunteer Data Notice.

**Step 1 — Policy Acknowledgment (required, replaces old "volunteer waiver")**

The volunteer reviews the current season's youth protection policy, lab use policy, and volunteer conduct policy in full. They type their name as an electronic acknowledgment and check the consent and read-and-agree checkboxes. The system captures the same evidence as a waiver signature — template version, hash, typed name, IP, timestamp. This written confirmation is required for insurance purposes.

**System:** A volunteer profile is created for the guardian with `status = pending`. Five volunteer steps are created, all with `status = pending`:
1. Background check
2. APS youth protection training
3. Youth Protection Policy quiz
4. Lab Use Policy quiz
5. Lab orientation

---

### 3.2 Background Check (CA DOJ)

California Department of Justice background checks are processed through the CA DOJ Live Scan portal. There is no API. This step is entirely manual.

The volunteer is directed to complete a Live Scan fingerprinting appointment through an authorized provider. This happens outside the platform. Placer Robotics receives the results through the DOJ portal.

When the background check clears, a Volunteer Admin logs into the admin dashboard, opens the volunteer's clearance record, marks the background check step complete, and enters the date and any relevant notes.

**System:** The `background_check` volunteer step updates to `complete`. If all other steps are also complete, auto-clearance is triggered. See Section 3.6.

---

### 3.3 APS / MinistrySafe Youth Protection Training

After the volunteer application is submitted, the system automatically initiates APS/MinistrySafe enrollment.

**System:** The system calls the APS API to create a user account for the volunteer and assign the youth protection training. The system retrieves the training link from the APS API and sends it to the volunteer's email. The volunteer's APS user ID and training link are stored on their volunteer profile.

**The volunteer completes the training** on the APS/MinistrySafe platform at their own pace. This happens outside the Placer Robotics platform.

**System:** When the volunteer completes the training, APS sends a completion webhook to the Placer Robotics platform. The system receives the webhook, stores the certificate URL, issue date, and expiration date on the `youth_protection_cert` record, and marks the `aps_youth_protection` volunteer step complete automatically. The volunteer is notified by email.

The volunteer does not need to do anything in the Placer Robotics platform for this step — the APS webhook handles it.

---

### 3.4 Youth Protection Policy Quiz

After receiving their APS training link, the volunteer sees the Youth Protection Policy quiz available in their volunteer dashboard.

The quiz is administered entirely within the Placer Robotics platform. It presents a set of questions about Placer Robotics' youth protection policies, drawn from the admin-managed question bank. Questions may be single-answer or multiple-answer.

The volunteer must achieve a score of 90% or higher to pass. They may retake the quiz as many times as needed — there is no penalty for failing and retaking. Each attempt is recorded with the questions presented, the answers given, the score, and whether it passed.

**System:** On a passing attempt, the `youth_protection_quiz` volunteer step is marked complete. The volunteer is notified. If all other steps are also complete, auto-clearance is triggered. See Section 3.6.

---

### 3.5 Lab Use Policy Quiz and Lab Orientation

The Lab Use Policy quiz follows the same model as the Youth Protection quiz. It covers Placer Robotics' robotics center rules, equipment policies, safety procedures, and expectations. 90% pass threshold, unlimited retakes, all attempts recorded.

Lab orientation is an in-person step. The volunteer visits the Placer Robotics facility and receives an orientation from a staff member or cleared senior volunteer.

When orientation is complete, a Volunteer Admin logs into the admin dashboard and marks the `lab_orientation` step complete for that volunteer.

---

### 3.6 Auto-Clearance

When all five clearance steps are complete — background check, APS youth protection, Youth Protection quiz, Lab Use quiz, and lab orientation — the system automatically grants clearance.

**System:** `volunteer_status` updates to `cleared`. A clearance notification sent. Slack workspace invite sent. Google Group sync triggered — volunteer added to `cleared-parents` user group and program-specific coach groups. **UniFi door credentials provisioned via UniFi Access API.**

From this point, the volunteer may operate in their full capacity as a cleared volunteer with no hours restrictions.

---

### 3.7 Certificate Expiration and Renewal

APS youth protection certificates have an expiration date. The system monitors expiration dates and sends renewal reminders automatically.

**60 days before expiration:** The volunteer receives an email reminder that their youth protection certificate is expiring soon and that they need to renew through APS/MinistrySafe.

**30 days before expiration:** A second reminder is sent.

**On the expiration date:** The volunteer's status automatically updates to `expired`. They are removed from cleared-volunteer Slack groups and Google Groups by the next sync cycle. A Volunteer Admin is notified. The volunteer may no longer operate as a cleared volunteer.

To renew, the volunteer completes a new APS training. The APS completion webhook updates their certificate record and resets their clearance status to `cleared` automatically.

---

### 3.8 Annual Volunteer Renewal

**Trigger:** `volunteer_renewal_open_at` in `season_config` (standard: July 1). System sends renewal invitation to all cleared volunteers.

**Actors:** Volunteer, System, Volunteer Admin (for dashboard monitoring only).

**Preconditions:** Volunteer has `volunteer_status = cleared`.

**Renewal Calendar:**

| Date | Event |
|---|---|
| ~June 1 (90 days before May 31 cert expiry) | Early warning email sent to volunteers whose APS cert expires before May 31 of upcoming program year. Volunteer only — no admin alert. |
| July 1 (standard) | Renewal opens per `season_config.volunteer_renewal_open_at`. Invitation email sent to all cleared volunteers. APS link auto-sent to those who need re-enrollment. |
| August 31 (standard target) | Admin dashboard surfaces volunteers with incomplete renewal. No hard lock — admin manages operationally. |
| APS cert expiration date | If APS not complete: volunteer status auto-expires. Groups and Slack removed. |
| Any time after expiration | Volunteer may still complete APS training. Auto-reinstates on APS webhook. |

Note: Both dates are configurable in `season_config`. This season's schedule may differ from the standard.

**Step 1 — Policy Re-Acknowledgment (always required)**

The volunteer logs in and sees the renewal prompt in their volunteer dashboard. They are shown the current season's youth protection policy in full. They type their name as an electronic acknowledgment, check the consent and read-and-agree checkboxes, and submit. The system records the acknowledgment with the same evidence as a waiver signature — template version, hash, typed name, IP, timestamp.

This step is required every season. No exceptions.

**Step 2 — Quiz Retake (conditional)**

**Decision:** Has the youth protection policy changed since this volunteer's last acknowledgment?

- If **yes** — volunteer must retake the Youth Protection Policy quiz at 90%+. Unlimited retakes. On passing, step marked complete.
- If **no** — step skipped automatically.

**Step 3 — APS Re-Enrollment (conditional)**

**Decision:** Does this volunteer's APS cert expire on or before May 31 of the current program year?

- If **yes** — when renewal opens, system automatically calls the APS API to enroll the volunteer and sends the training link by email. The volunteer completes training on the APS/MinistrySafe platform at their own pace. When complete, APS sends a completion webhook. System stores new cert URL, issue date, and expiration date. Step marked complete automatically. **The renewal flow is blocked from final submission until this webhook is received.** The volunteer may complete Steps 1 and 2 at any time, but cannot finish renewal without APS completion.
- If **no** — step skipped automatically.

**Live Scan / CA DOJ:** Not repeated on standard annual renewal. One-time unless volunteer's status was previously suspended or lapsed.

**Renewal Outcomes:**

| Scenario | What Happens |
|---|---|
| All required steps complete | Status remains Cleared. Renewal confirmation sent. Season renewal date recorded. Admin renewal-outstanding flag cleared. |
| APS required but not yet done | Renewal flow blocked. Volunteer can complete Steps 1 and 2. Must complete APS to finish. |
| August 31 passes, renewal incomplete | Admin dashboard flags volunteer as renewal-outstanding. No hard lock. Admin manages operationally. |
| APS cert expires without APS completion | Status → Expired. Removed from Google Groups and Slack on next sync. Blocked from operating as cleared volunteer. |
| Volunteer reinstates after expiry | Completes APS training at any time. APS webhook auto-reinstates status → Cleared. Groups and Slack restored on next sync. No admin action required. Admin notified of reinstatement. |

**Note for this season:** A large cohort of volunteers have certs expiring. Early warning emails will go out ~June 1. Encourage completion before July 31 to avoid August bottleneck.

---

### 3.9 Volunteer Suspension

A Volunteer Admin or Super Admin may suspend a volunteer at any time. The admin must enter a reason. The suspension is permanently recorded in the audit log with the admin's identity, the timestamp, and the reason.

**System:** `volunteer_status` updates to `suspended`. UniFi door credentials revoked. Volunteer is NOT removed from Google Groups or Slack — those remain active. Reinstatement requires Super Admin action.

---

## Part 4 — Admin Flows

---

### 4.1 Registration Admin — Daily Operations

The Registration Admin's primary work is the application queue and team assignment.

**Application queue:** Each morning during application season, the admin reviews new applications. They read the long-form answers, check GPA flags, note program interest, and make accept/decline/triage decisions. For Not Sure applicants, they add triage notes and plan engagement event outreach. For applications with GPA flags, they review the full context and make a judgment call — the system flags, it never auto-declines.

**School canonicalization:** Occasionally a student submits a school name that doesn't match any known school. The admin reviews these in the unrecognized schools queue, confirms or corrects the school name, and marks it verified. This ensures the student appears in the right Google Group and mailing list.

**Application waivers:** For known families or data migration scenarios, the admin creates an admin_waived application with mandatory notes. The audit log permanently records who waived it and why.

**Team assignment:** After registration closes and GRSF confirms team numbers, the admin bulk-assigns V5 and Combat students to teams. The team assignment dashboard shows all registered students and their current team status (assigned or unassigned). Admin assigns teams, enters team numbers, and the system triggers Slack channel invites for coaches and team members.

---

### 4.2 Financial Aid Admin — Operations

The Financial Aid Admin operates in a completely separate section of the admin dashboard that Registration Admins cannot access.

When a family submits a financial aid request, the Financial Aid Admin receives a notification. They open the request in the financial aid queue, read the family's description of need, and make a resolution decision — full waiver, partial waiver, or denied.

For partial waivers, the admin enters the adjusted fundraising target. The system updates the enrollment record. The $40 registration fee is never changed by financial aid resolution.

The Financial Aid Admin adds admin notes to each case for internal record-keeping. These notes are never visible to the family or to other admin roles.

After resolution, the system notifies the family and unlocks registration.

---

### 4.3 Payment Admin — Operations

The Payment Admin's work is payment reconciliation and fundraising tracking.

**Automated payments:** When Zeffy receives a donation or payment, the webhook fires and the system creates a payment transaction record and attempts to match it to an enrollment or IQ team using the payment reference code, Zeffy payment ID, or donor email. Successfully matched payments update the enrollment's fee and fundraising summary automatically, and a confirmation email is sent to the family.

**Unmatched payments:** Payments that cannot be automatically matched appear in the unmatched payment queue. The Payment Admin reviews these, identifies the correct family or enrollment, and manually matches them. Common reasons for unmatched payments include grandparent or employer payments, Benevity corporate matches, and payments where the reference code was not included.

**Manual entry:** Checks, cash payments, and payments received through channels other than Zeffy are entered manually by the Payment Admin. They create a payment transaction record with the source, amount, donor information, and payment type.

**Registration fee waiver:** If a family's $40 registration fee needs to be waived — a rare exception — only a Super Admin may do this. They navigate to the enrollment record, update the registration fee status to waived, enter a required reason, and the action is permanently recorded in the audit log.

**Reporting:** The Payment Admin can view the full payment and fundraising dashboard showing fee status, fundraising collected, sponsorship credits, and remaining amounts for every enrollment. CSV exports are available for external reporting.

---

### 4.4 Volunteer Admin — Operations

The Volunteer Admin manages the clearance pipeline.

**Clearance queue:** The admin dashboard shows all volunteers in progress, their step completion status, and any outstanding actions. Steps that require admin action are highlighted: background check pending (admin must mark complete after DOJ result), lab orientation pending (admin must mark complete after in-person visit).

**VEX team checklists:** The Volunteer Admin manages external registration requirements for VEX V5 and IQ teams. For each V5 and IQ team, the dashboard shows whether events.vex.com registration has been completed. The admin marks this when confirmed. Combat teams have no external registration requirement and this checklist item does not appear for Combat teams.

**Uncleared coaches:** Any team — V5, IQ, or Combat — where the coach or manager is not yet cleared is flagged with a clearance-pending indicator. The admin monitors these and coordinates with coaches to complete their clearance before they exceed their unchecked volunteer hours.

**Expiration management:** The admin reviews the certificate expiration report to see which volunteers have certs expiring in the next 60–90 days. The system sends reminders automatically, but the admin may follow up directly with volunteers who have not started renewal.

**Suspension:** When a volunteer needs to be suspended, the admin enters a reason and the system handles all downstream effects — status update, group removal, notifications.

---

### 4.5 Communications Admin — Broadcasts

The Communications Admin sends program-wide and group-specific email communications.

They log into the admin dashboard and navigate to the broadcast tool. They select a recipient group — a defined Google Group membership set (e.g., all V5 HS families, all Combat MS families, all cleared volunteers, all IQ coaches), a specific team, or a custom list. They compose the email subject and body.

**System:** The broadcast is sent via the transactional email provider to the resolved communication email of each recipient. It is not sent to the Google Group address directly — this avoids spam filtering issues while still reaching the right people. The broadcast is logged in the notification log.

A Communications Admin can broadcast to any group. A Student Director can only broadcast to the program they are assigned to.

---

### 4.6 Super Admin — Operations and Overrides

The Super Admin has access to everything. Their unique responsibilities beyond other admin roles are:

**Season configuration:** Before each new season, the Super Admin updates `season_config` — opening and closing dates, fee amounts, fundraising targets, GPA threshold, Zeffy URLs, and waiver template assignments. Nothing is hardcoded. All season-specific values come from this configuration.

**Waiver template management:** When waiver language changes — new season, insurance update, legal review — the Super Admin creates a new waiver template version. The prior version is retired. All future signatures capture the new version and hash. Prior signatures are preserved with the version they were signed against.

**Admin user management:** The Super Admin creates admin profiles, assigns roles, and revokes access. Student Director roles are scoped to a specific program. All role grants and revocations are recorded in the audit log.

**Registration fee waivers:** Only the Super Admin may waive the $40 registration fee. They navigate to the specific enrollment, update the fee status, enter a required reason, and the action is permanently recorded.

**Record corrections:** If data needs to be corrected — a guardian email changed, a student record updated, a waiver record that needs admin review — the Super Admin handles it. All corrections are logged.

**Board Google Group:** The Board Google Group is not managed by the automated sync system. The Super Admin manages it manually in Google Workspace. The platform stores board member person_role records for reference but does not touch the board Google Group.

**Bootstrap:** The first Super Admin account is created via a SQL migration seed before the platform launches. No application-layer logic creates admin accounts. The bootstrap email is supplied via environment variable.

---

## Part 5 — System Flows

---

### 5.1 Google Group Sync

Google Groups are the access control layer for Placer Robotics' Shared Drives and mailing lists. The platform maintains their membership automatically.

A scheduled sync job runs every 15 minutes (configurable). It also runs on-demand whenever a significant event occurs — a registration is submitted, a volunteer is cleared, a person role is assigned or revoked, or an admin triggers a manual sync.

**For each auto-synced group**, the sync job:
1. Queries Supabase for the current desired membership based on the group's membership rule (enrollment-driven, clearance-driven, or role-driven).
2. Fetches the current membership from the Google Admin SDK.
3. Computes the difference — who needs to be added, who needs to be removed.
4. Executes the batch add/remove via the Google Admin SDK.
5. Logs every change to the sync log — group, action, email, which field the email was resolved from, timestamp, success or failure.

**Email resolution:** For each guardian, the system uses `google_email` if provided, otherwise falls back to `login_email`. This replaces the manual email mapping spreadsheet (sync_script.py's "DL Email Substitutions" sheet) entirely. The mapping problem is solved at data entry, not at sync time.

**Exclusion list:** Emails in the `sync_exclusion` table are suppressed from all sync operations regardless of membership rules. This replaces the "Dropped Emails" sheet.

**The Board group is never touched by the sync job.** It is managed exclusively by Super Admin in Google Workspace.

Sync failures — API errors, permission issues, unresolvable emails — are logged and surfaced in the admin notification dashboard. The admin can review failures and trigger a manual resync.

---

### 5.2 Slack Sync and Invitations

Slack group membership is driven by the same database state as Google Groups, but the mechanics are different. Google Groups are managed by batch sync. Slack is managed by event-driven invitations and periodic user group sync.

**Workspace invitations** happen when a volunteer is cleared. The system sends a Slack workspace invite to the volunteer's Slack email (or login email as fallback). The guardian's `slack_invite_status` is updated. If the invite fails — email not found in Slack, invite limit reached, other API error — it is logged and surfaced in the admin dashboard for manual follow-up.

**Channel invitations** happen when a team is confirmed and team numbers are assigned. Coaches and team managers are invited to their team's Slack channel. Students with Slack consent and confirmed age ≥ 13 are invited to their program channel.

**User group sync** — the `cleared-parents` Slack user group in both the main and IQ workspaces — is updated whenever a volunteer's clearance status changes. Cleared volunteers are added. Suspended or expired volunteers are removed.

Placer Robotics operates two Slack workspaces: `main` (all V5, Combat, and general program communications) and `iq` (IQ-specific). IQ coaches are added to the IQ workspace. Cleared volunteers generally appear in both.

---

### 5.3 Zeffy Payment Flow

Zeffy is the payment platform for student registration fundraising and IQ team fees.

**At registration confirmation**, the family receives:
- Their enrollment payment reference code (e.g., `PR-2026-MILLER-7F3K`)
- The Zeffy donation/payment link for their program
- The fundraising target and deadline
- Instructions for offline payments (check, Benevity, corporate match)

**When a payment is made via Zeffy:**
1. Zeffy sends a `payment.completed` webhook to the platform.
2. The platform validates the payload, stores the raw payload, and creates a `payment_transaction` record.
3. The system attempts to automatically match the payment to an enrollment or IQ team.

**Matching happens in this order:**
1. If a payment reference code is present in a Zeffy custom field, match on that.
2. If the Zeffy payment ID is already in the ledger (polling found it first), skip duplicate.
3. If the donor email matches a family's login, communication, or guardian email, match on that.
4. If name, amount, and timing are consistent with a known enrollment, flag as a probable match for admin review.
5. If none of the above, place in the unmatched queue for Payment Admin review.

**If matched:**
The enrollment's fundraising collected and fee status are updated. An automated payment confirmation email is sent to the family.

**Zeffy API polling** runs on a schedule as a fallback. It retrieves recent payments from the Zeffy API and creates transaction records for any not already in the ledger. This handles cases where the webhook was not delivered.

**Manual payments** (checks, Benevity, corporate matches) are entered by the Payment Admin directly. They create the transaction record, match it to the enrollment, and update the fundraising summary. All manual entries are recorded in the audit log.

---

### 5.4 Engagement Events

Placer Robotics runs a variety of outreach and engagement events — try-it-out sessions, info nights, RISE, Girl Powered, open labs, summer camps, and community outreach events. These events are important for converting interested students into applicants, and for helping Not Sure applicants find their program.

The platform stores a schema for engagement events and attendance records. The admin UI for this is deferred — a spreadsheet is used for now.

When the admin UI is built, it will allow:
- Creating an event record (type, date, name, location, notes).
- Recording attendance — either linking to an existing student application (for applicants who attended) or recording name, email, grade, and school for non-applicants.
- Viewing engagement history on a `program_pending` application detail — which events has this student attended, what notes were recorded?
- Converting an attendance record to a new application with one admin action — pre-filling the application with whatever was captured at the event.

---

### 5.5 Data Migration (One-Time, Pre-Launch)

Before the platform launches, existing family, student, volunteer, and enrollment data is migrated from the legacy Google Sheets system into Supabase.

**The migration script:**
- Reads from the existing registration sheet and volunteer registration sheet using the Google Sheets API (read-only).
- Maps each row to the new schema — family records, guardian records, student records, enrollment records, volunteer profile records.
- For cleared volunteers, creates volunteer profile records with `status = cleared` and all clearance steps marked complete.
- For each migrated student, creates an `admin_waived` application record with a migration note — this allows migrated families to proceed directly to registration for the new season without going through the application queue.
- Handles school name canonicalization — maps known legacy school name variants to canonical school records. Unknown school names are created as unverified schools for admin review.
- Is idempotent — safe to run multiple times without creating duplicates.
- Has a dry-run mode that logs all intended changes without executing them.
- Outputs a migration summary report showing records created, records skipped, errors, and schools requiring canonicalization.

**Migration sequence:**
1. Database schema migrations are run.
2. The `school` table is seeded with known feeder schools.
3. Season config is seeded for 2026-27.
4. The migration script is run in dry-run mode. The summary report is reviewed.
5. Any blocking errors are resolved.
6. The migration script is run in live mode.
7. Admin reviews the unrecognized schools queue and canonicalizes.
8. Admin reviews migrated family records for accuracy.
9. Platform goes live for new season registration.

The email mapping sheets (DL Email Substitutions, Slack Role Sync Email Mappings) are not migrated. They are replaced by the guardian email fields (`google_email`, `slack_email`) in the new schema. Families are prompted to provide these during their first registration in the new system.

---

### 5.6 New Season Rollover

At the start of each new season, the Super Admin:

1. Creates a new `season_config` record for the new season with updated dates, fees, fundraising targets, and Zeffy URLs.
2. Creates or updates waiver templates for the new season if language has changed.
3. Sets the new season as active.
4. Opens the application window.

Returning families retain their family records, guardian records, and student records. Their prior season enrollments and waivers are preserved in history. New season applications, enrollments, and waivers are created fresh against the same family records.

The Google Group sync continues without interruption — group membership is always based on current-season enrollment and clearance status, so prior-season families who have not yet enrolled for the new season fall out of program-specific groups at the start of the new season. They remain in `part-everyone` until explicitly removed.

Volunteer clearance status carries forward unless a cert has expired or the volunteer has been suspended. Expired certs trigger the renewal flow automatically.


### 5.7 Phase 1 Application Sync (Now through August 31, 2026)

The existing Google Form remains active for 2026-27 applications. A scheduled sync job reads from the Google Sheets registration sheet every 15 minutes and upserts records into Supabase.

**For families applying via the Google Form:**
The experience is unchanged — they fill out the form, get a confirmation email, and wait to hear back. They do not interact with the platform until they receive an acceptance email with a login link.

**Behind the scenes:**
The sync job creates family, guardian, student, student_application, and family_season records in Supabase. The admin dashboard shows these applications alongside any submitted through the platform's `/apply` route — they look identical to reviewers. Applications sourced from the Google Form are tagged `source = google_form_sync` internally but this is not visible in the family-facing UI.

**Student email handling:**
Student emails collected on the Google Form are synced to `student.communication_email`. No consent flags are set at sync time. When the family completes registration on the platform, they review the student email and complete the consent flow — they may update or remove it at that point.

**Sunset:**
August 31, 2026. After this date the Google Form is retired and the sync job decommissioned. All new applications go through `/apply` on the platform.

---
## Part 6 — Student Director Flow

---

### 6.1 Student Director — Role and Access

Student directors are Placer Robotics students who hold leadership positions — for example, the V5 Director, the IQ Director, or the Outreach Director. They are minors. They do not have student logins. They do not have family logins.

Student directors who have been granted a `@placerrobotics.org` Google Workspace account by the Executive Director may be granted a Student Director admin profile in the platform. This is not a student account — it is a limited admin account tied to their org email address.

The Super Admin creates the admin profile and assigns the `student_director` role scoped to a specific program. A V5 student director can only act within the V5 program scope. They cannot access other programs, financial data, volunteer clearance records, or guardian PII beyond what is needed for team communication.

**What a Student Director can do:**
- Send broadcasts to families and students in their assigned program.
- View a limited roster showing student names, program, team assignment, and communication email (if consent was granted). No financial data. No guardian phone numbers or addresses.

**What a Student Director cannot do:**
- View financial aid, payment records, or waiver details.
- Accept or decline applications.
- Access volunteer clearance records.
- Manage admin roles or season configuration.
- Broadcast outside their assigned program scope.

Student directors operate primarily through Slack and email for day-to-day team communication. The platform broadcast tool is for program-wide announcements, not routine team chat.

---

## Appendix A — Key Decision Points Summary

| Decision Point | Who Decides | System Behavior |
|---|---|---|
| Accept or decline application | Registration Admin or Super Admin | Manual — system does not auto-decide |
| GPA below threshold | Registration Admin or Super Admin | System flags, never auto-declines |
| Not Sure program triage | Registration Admin or Super Admin | Manual — program determined after engagement |
| Financial aid resolution | Financial Aid Admin or Super Admin | Manual — full waiver, partial waiver, or denied |
| Registration fee waiver | Super Admin only | Manual — mandatory notes + audit log |
| Payment matching | System (auto) or Payment Admin (manual) | Auto-match first, unmatched queue for manual |
| Background check clearance | Volunteer Admin | Manual — admin marks complete after DOJ result |
| APS training completion | System (auto via webhook) | Automatic on APS webhook receipt |
| Quiz pass/fail | System (auto) | Automatic on 90% threshold |
| Lab orientation completion | Volunteer Admin | Manual — admin marks complete after in-person |
| Auto-clearance | System (auto) | Automatic when all 5 steps complete |
| Certificate expiration | System (auto) | Automatic on expiration date |
| Team assignment (V5/Combat) | Registration Admin or Super Admin | Manual — assigned post-registration |
| Team assignment (IQ) | Student selects at registration | Set at registration time |
| Team number assignment | Registration Admin or Super Admin | Manual — assigned after GRSF confirmation |
| Google Group sync | System (scheduled + on-demand) | Automatic, Board group excluded |
| Slack invite | System (event-driven) | Automatic on clearance or team assignment |
| Board group membership | Super Admin | Manual only, outside platform sync |

---

## Appendix B — Email Communications Reference

| Trigger | Recipient | Sent By |
|---|---|---|
| Application submitted | Guardian 1 + Guardian 2 | System |
| Application accepted | Guardian 1 + Guardian 2 | System |
| Application declined | Guardian 1 | System (if configured) |
| Financial aid request received | Financial Aid Admin | System |
| Financial aid resolved | Guardian 1 + Guardian 2 | System |
| Registration submitted | Guardian 1 + Guardian 2 | System |
| Payment matched | Guardian 1 + Guardian 2 | System |
| IQ team payment received | Payment Admin | System |
| IQ team confirmed active | Coach | System |
| Volunteer clearance initiated | Volunteer | System |
| APS training link | Volunteer | System |
| APS training complete | Volunteer | System |
| Volunteer cleared | Volunteer | System |
| APS cert expiring (60-day) | Volunteer | System |
| APS cert expiring (30-day) | Volunteer | System |
| APS cert expired | Volunteer + Volunteer Admin | System |
| Volunteer suspended | Volunteer | System |
| Quiz passed | Volunteer | System |
| Team assigned | Guardian 1 + Guardian 2 | System |
| Student email updated | Guardian 1 (login email) | System |
| Broadcast | Selected group | Communications Admin or Student Director |
| Magic link (login) | Requesting user | System |
| Admin resend login link | Family or admin | Admin-triggered via system |

---

*This document describes the platform as designed in product_requirements_v1_11.md. It is a living document and should be updated as the platform evolves.*
