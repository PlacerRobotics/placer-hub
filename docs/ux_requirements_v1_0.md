# Placer Robotics Registration Platform
## UX, Platform, and Deployment Requirements
**Version 1.0**

| Field | Value |
|---|---|
| Organization | Placer Advanced Robotics and Technology, dba Placer Robotics |
| System | Registration, Family Portal, Volunteer Clearance, Admin Operations Platform |
| Audience | PRD creator, Codex/Cursor/Claude Code implementation workflow, UX designer, technical reviewer |
| Status | Controlling UX document — required before product screen implementation |
| Companion | product_requirements_v1_9.md, functional_flow_v1_3.md |

---

## Core Principle

The platform should feel like a guided checklist, not a database front-end.

Families should never need to understand internal data-model concepts such as `family_season`, `enrollment`, `waiver_template`, `payment_transaction`, or `team_member`.

Admins should see more operational structure, but admin UX should still be queue-based, not raw-table-based.

---

## 1. Deployment Platform

### 1.1 Hosting Platform

The registration platform shall be deployed on **Vercel**.

Reasons:
1. The application is a Next.js app.
2. Vercel and Next.js are built by the same company — native, zero-adapter deployment.
3. Lowest-friction path for server actions, route handlers, webhooks, preview deploys, and Codex/Cursor-generated apps.
4. Supabase auth, server-side route handlers, webhook endpoints, and scheduled jobs all deploy without runtime constraint issues.

Netlify and Cloudflare Pages are not prohibited but are not the default for this project.

### 1.2 Domain

**Preferred production domain:** `hub.placerrobotics.org`

Rationale: the platform is broader than registration — it includes family dashboard, volunteer clearance, payments, team management, renewals, and admin workflows. `register.placerrobotics.org` would feel too narrow once the product expands.

**Acceptable alternative:** `register.placerrobotics.org` — only if the organization wants the initial mental model to be narrowly registration-focused.

### 1.3 Domain Architecture

```
placerrobotics.org              — existing Squarespace marketing/public site (separate)
hub.placerrobotics.org       — new Vercel registration/family/admin platform
impactroboticsleague.org        — separate brand/site unless later consolidated
```

The registration platform does not replace or become the Placer Robotics marketing site in this release. Website migration is out of scope.

### 1.4 Vercel Project Structure

**Project name:** `placer-robotics-hub`

| Environment | URL |
|---|---|
| Production | hub.placerrobotics.org |
| Preview | Vercel preview deployments per branch/PR |
| Development | Local |

Production and development must use **separate Supabase projects**.

### 1.5 Deployment Requirements

- Hosting platform: Vercel.
- All secrets and configuration via environment variables.
- Vercel preview deployments required for review before production release.
- Production and preview deployments use separate environment variables where appropriate.
- Webhook routes implemented as server-side Next.js route handlers compatible with Vercel deployment.

### 1.6 Deployment Guardrails

The implementation shall not:
1. Assume Netlify-specific deployment behavior.
2. Assume Cloudflare edge runtime compatibility.
3. Store secrets in source code.
4. Use one Supabase project for both dev and production.
5. Deploy production without configured environment variables.
6. Deploy production without confirming Supabase RLS is enabled.
7. Deploy production without transactional email domain configuration.

---

## 2. UX Architecture

### 2.1 Scope

**Option D-lite:**
1. Design system (colors, type, spacing, components).
2. Wireframe-level UX specification for every major route.
3. Visual/static wireframes for the most important family-facing screens.
4. Screen inventory and layout rules for admin, volunteer, and IQ coach screens.
5. Codex implementation rules that prevent generic CRUD UI.

### 2.2 Build Order Requirement

No product screen shall be implemented until the design system and static wireframe routes exist.

Codex given only schema and business rules will generate: CRUD dashboards, generic forms, raw enum labels, admin-looking family pages, confusing status names, too many buttons, too little explanation, pages that expose the database model instead of the user journey.

The UX system prevents this.

### 2.3 Required Documents and Tasks

`/docs/ux_requirements_v1_0.md` — this document (exists)

**Codex Task 1.5 — Design System and UX Shell** (before any product screens)
**Codex Task 1.6 — Static Wireframe Routes** (before data wiring)

---

## 3. Core UX Principles

1. Every user always sees the next action first.
2. Families never see internal data-model language.
3. Admins work from queues, not raw database tables.
4. Financial aid is private and never casually exposed.
5. Payment and fundraising are separate concepts with separate UI.
6. Returning families review and confirm, not retype.
7. Waivers are signed at the end of registration, not the beginning.
8. Student voice is allowed, but parent/guardian is always the submitting user.
9. Sync/integration failures are admin-facing, not family-facing.
10. Every external dependency has a manual fallback visible to admin.
11. Mobile family UX is more important than desktop admin polish in the first release.
12. The app must feel like a guided checklist, not a database front end.
13. The platform should feel like Placer Robotics, but calmer than event/camp marketing graphics.

---

## 4. User Experience Model

### 4.1 Family UX Model

Family users should always know:
1. Where am I?
2. What do I need to do next?
3. What is Placer Robotics reviewing or handling?
4. What is complete?
5. What is blocked?

Family pages are action-oriented and checklist-based.

**Example family dashboard:**
```
2026–27 Registration
Maya Miller
Application:       Accepted
Financial aid:     Not requested
Registration:      Not started
Waivers:           Not signed
Payment:           Not paid
Team:              Pending

Next step
Before registration, please tell us whether you need financial assistance.
[Continue]
```

**Family pages shall never show:**
- `family_season`, `student_application`, `enrollment`
- `payment_transaction`, `waiver_template`, `team_member`
- RLS, `admin_action_log`
- Raw enum values or database field names

### 4.2 Admin UX Model

Admin UX is queue-based.

Admins land on a "Needs Attention" dashboard, not a raw table.

**Example admin home:**
```
Needs attention
12   applications to review
3    financial aid requests
8    registrations submitted but unpaid
4    unmatched payments
2    sync failures
5    volunteers waiting on background check
```

Admin queues answer:
1. What needs action?
2. Who owns it?
3. How long has it been waiting?
4. What is the next decision?
5. What changed recently?
6. What is blocked?

### 4.3 Volunteer UX Model

Volunteer UX is checklist-based.

**Example volunteer clearance:**
```
Volunteer Clearance
Step 1: Volunteer application      — Complete
Step 2: Background check           — Waiting for admin confirmation
Step 3: APS training               — Not started
Step 4: Youth protection quiz      — Not started
Step 5: Lab orientation            — Not scheduled
```

Each step shows:
1. Status.
2. Who owns the next action.
3. What the volunteer should do.
4. What Placer Robotics will do.
5. Whether the step blocks clearance.

---

## 5. Design System

### 5.1 Visual Direction

The platform should feel:
- Placer Robotics branded
- Trustworthy and institutional but warm
- Clean and mobile-first
- Low-friction and parent-friendly
- Calmer than event/camp marketing graphics
- Not flashy, not kid-gamey, not dense

**Context for the visual decisions:**
- Public program graphics use navy, gold, white, energetic robotics imagery, bold calls to action.
- Core apparel identity is black and gold.
- The platform UX needs readability, calmness, trust, and form usability.

**Therefore:** Navy + white + gold as the web-app foundation. Black + gold as brand/apparel/event reference, used sparingly. Program accent colors only as small identifiers.

### 5.2 Color Palette

#### Core Platform Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-navy-deep` | `#0E2558` | Main header, navigation, section headers |
| `--color-navy-darker` | `#071A3D` | Admin shell header, hover states |
| `--color-charcoal` | `#16181E` | Apparel/event identity, footer, high-contrast blocks |
| `--color-gold` | `#F2C352` | Primary public CTA, brand accents, dividers |
| `--color-gold-dark` | `#D9A820` | Hover state for gold buttons |
| `--color-gold-light` | `#F8E4A3` | Subtle gold backgrounds, highlights |
| `--color-blue-gray` | `#7E8FB9` | Secondary panels, program-neutral badges |
| `--color-bg-light` | `#F5F6F8` | Page background, dashboard background |
| `--color-surface` | `#FFFFFF` | Cards, forms, detail panels |
| `--color-border` | `#DDE2E8` | Borders, dividers |
| `--color-text-primary` | `#1F2933` | Body text |
| `--color-text-muted` | `#5F5D60` | Help text, secondary labels |

#### Functional Status Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#2E7D32` | Complete, cleared, paid |
| `--color-warning` | `#B7791F` | Pending, needs attention |
| `--color-error` | `#C62828` | Failed, expired, blocked |
| `--color-info` | `#2563EB` | Informational, in progress |
| `--color-neutral` | `#6B7280` | Inactive, not started |

#### Program Accent Colors

Used **only** in badges, chips, small section markers, dashboard filters, program labels, team cards, and subtle left-border accents. Never for entire page themes.

| Program | Hex | Token |
|---|---|---|
| VEX V5 | `#2563EB` | `--color-program-v5` |
| VEX IQ | `#F2C352` | `--color-program-iq` |
| Combat Robotics | `#D95B3D` | `--color-program-combat` |
| General / All | `#7E8FB9` | `--color-program-general` |

#### Color Usage Rules

**Deep Navy (`#0E2558`):** Main header, public/family portal top navigation, admin shell header, important section headers.

**Primary Navy (`#071A3D`):** Primary buttons when gold would be too loud, active nav states, key dashboard labels.

**Placer Gold (`#F2C352`):** Primary public call-to-action accent, thin dividers, important highlights, brand accent areas, select primary buttons on public-facing pages.

**Charcoal (`#16181E`):** Apparel/event identity, footer, high-contrast brand blocks — **not** the main background for long forms.

**White:** Cards, forms, review summaries, admin detail panels.

**Light Background (`#F5F6F8`):** Page background, dashboard background, form wizard background.

**Blue Gray (`#7E8FB9`):** Secondary panels, program-neutral badges, subtle borders.

#### Color Don'ts

- Do not use black/gold as the dominant web-app page theme.
- Do not put long forms on dark backgrounds.
- Do not overuse gold for every button, border, and heading.
- Do not make every program feel like a separate website.
- Do not rely on color alone to communicate status.

### 5.3 Typography

**Display / heading font:** Goldman (Google Fonts) — used for page titles, hero text, and major section headers. Signals Placer Robotics brand identity immediately.

**Body / UI font:** Inter — used for all body text, form fields, labels, buttons, help text, status badges, and dashboard content.

**Fallback:** System sans-serif (`system-ui, -apple-system, sans-serif`)

Typography serves two purposes: Goldman establishes brand presence in key visual moments; Inter maintains readability and usability throughout operational flows.

| Element | Size | Weight |
|---|---|---|
| Page title | 28–36px | Bold (700) |
| Section title | 20–24px | Semibold (600) |
| Card title | 16–18px | Semibold (600) |
| Body text | 15–16px | Regular (400) |
| Help text | 13–14px | Regular (400) |
| Status labels | 12–13px | Medium (500) |

Note: Goldman is used for display headings only (page titles, hero text, major section headers). Inter is used for all body text, form fields, labels, buttons, and operational UI. This combination gives the portal clear Placer Robotics identity without sacrificing form usability.

### 5.4 Layout

**Family/public pages:**
- Single-column on mobile
- Card-based sections
- Large buttons (min 44px touch targets)
- Clear progress indicators
- Minimal table usage
- Sticky or obvious Save/Continue where appropriate

**Admin pages:**
- Desktop-first but responsive
- Queue cards at top
- Tables inside queues
- Detail drawer or detail page for record review
- Clear role-based permission messages

### 5.5 Component Library

All components must be defined before product screens are built. Codex must use these components consistently.

**Shell components:**
- `AppShell` — root layout
- `PublicShell` — unauthenticated pages (/apply, /iq-team/create)
- `FamilyShell` — authenticated family pages
- `AdminShell` — authenticated admin pages

**Navigation and structure:**
- `PageHeader` — page title + breadcrumb + actions
- `StepChecklist` — ordered step list with status
- `StepChecklistItem` — individual step with owner/action/status

**Status and feedback:**
- `StatusBadge` — colored label with text (never color alone)
- `InfoAlert` — informational message block
- `WarningAlert` — pending/attention message block
- `ErrorAlert` — failure/blocked message block
- `SuccessAlert` — completion message block

**Content blocks:**
- `ActionCard` — primary next-action card with CTA
- `ReviewSummaryCard` — human-readable pre-submit summary
- `PaymentReferenceCard` — reference code display with copy button
- `AuditTrailCard` — admin audit history display

**Form components:**
- `FormSection` — labeled section within a form
- `FormField` — labeled input with help text and error state

**Buttons:**
- `PrimaryButton` — gold on public, navy on admin
- `SecondaryButton` — outlined
- `DangerButton` — red, destructive actions only

**Admin components:**
- `AdminQueueTable` — queue with sort, filter, bulk actions
- `AdminDetailPanel` — record detail with actions and audit

**States:**
- `EmptyState` — empty queue or no results
- `LoadingState` — skeleton or spinner
- `PermissionNotice` — role-restricted message

### 5.6 Program Accent Usage

Program colors appear **only** in: badges, chips, small section markers, dashboard filters, program labels, team cards, subtle left-border accents.

Program colors do **not** change the entire page theme.

**Badge examples:**
```
[VEX V5]           — blue background
[VEX IQ]           — gold background
[Combat Robotics]  — red-orange background
[All Programs]     — blue-gray background
```

The platform must feel like one Placer Robotics system. Program colors are navigational aids, not separate brands.

---

## 6. Status Language

### 6.1 Family-Facing Statuses

**Use these:**
- Accepted
- Needs your response
- Under review
- Ready to register
- Registration started
- Registration submitted
- Waiver needed
- Payment unpaid
- Payment received
- Fundraising not started
- Fundraising partial
- Fundraising complete
- Team pending
- Team assigned
- Volunteer clearance pending
- Volunteer cleared

**Never use these in family UI:**
- `pending_financial_aid`
- `cleared_to_register`
- `payment_status_partial`
- `family_season_registered`
- `application_admin_waived`
- Any raw enum value or database field name

### 6.2 Admin-Facing Statuses

Admin sees more precise language, still no raw database jargon:
- Submitted / Needs follow-up / Accepted / Declined / Program pending
- Financial aid pending / Full fundraising waiver / Partial fundraising waiver / Registration fee waived
- Unmatched payment / Manually matched / Sync failed / Expired / Suspended

---

## 7. Family / Public Screens

### 7.1 Public Application Landing

**Route:** `/apply`

**Purpose:** Introduce the application process and set expectations.

**Required copy themes:**
> Apply for 2026–27 Placer Robotics programs.
> This is the first step. If accepted, you will receive a link to complete full registration, waivers, and payment information.
> Estimated time: 10–15 minutes.
> A parent or guardian must submit this application. Student-written answers may be included with parent or guardian review.

**Required content:**
1. Program choices overview.
2. Eligibility / grades served.
3. Process overview (apply → accept → register → pay).
4. Parent/guardian submission note.
5. Estimated completion time.
6. Start application button.

### 7.2 Public Application Form

**Route:** `/apply`

The form should feel lightweight compared with registration.

**Content sections:**
1. Student basics (name, grade, school, city/ZIP, optional student email, GPA).
2. Program interest and prior experience.
3. Student motivation and background (parent submits, student voice).
4. Guardian contacts.
5. Parent/guardian certification.

**Student-authored section framing:**
> The following answers should reflect the student's interests and motivation. A parent/guardian must submit the application and certify they are authorized to provide this information.

**Do not say:** "Student completes this section."

**GPA framing:**
> Academic readiness helps us understand whether the time commitment is a good fit. Applications below the threshold may be flagged for admin review but are not automatically declined.

### 7.3 Application Submitted Page

**Route:** `/apply/success`

> Application submitted.
> We sent a confirmation email to the guardian email addresses provided. Placer Robotics will review your application and follow up with next steps.

Do not show registration or payment actions before acceptance.

### 7.4 Acceptance / Login Landing

After acceptance, family lands directly in the next required step.

> Your application has been accepted.
> Before registration, please answer one question about financial assistance so we can route you correctly.

Primary action: **[Continue]**

### 7.5 Financial Aid Prompt

**Route:** `/financial-aid`

> Before registration, please tell us whether you need financial assistance for this season.
> We ask this before registration so we can resolve any fee or fundraising adjustments clearly and privately.
> Your financial assistance request is reviewed separately from application decisions and is not visible to registration reviewers.

**Buttons:**
- `[No, continue to registration]`
- `[Yes, request financial assistance]`

### 7.6 Financial Aid Request Form

Short and non-stigmatizing. Collects only:
1. Government assistance program or category.
2. Brief description of need.
3. Optional additional context.
4. Parent/guardian certification.

**Does not collect:** income amounts, tax documents, bank statements, SSNs, detailed financial documentation, file uploads.

**After submission:**
> Registration is paused while your financial assistance request is being reviewed.
> You will receive an email when registration is unlocked.

### 7.7 Family Dashboard

**Route:** `/dashboard`

Task-first. Next action always prominent.

**New family:**
```
2026–27 Registration
Maya Miller

Application        Accepted
Financial aid      Not requested
Registration       Not started
Waivers            Not signed
Payment            Not paid
Team               Pending

Next step
Complete registration for Maya.
[Continue]
```

**Returning family:**
```
Welcome back.
We found your family record from last season. Please review your student and guardian information for 2026–27.

[Register returning student]
[Add another student]
[Switch or add program]
[Not returning this season]
```

### 7.8 Registration Wizard

**Route:** `/register`

Chunked into sections. Not one giant page.

**Sections:**
1. Confirm student.
2. Confirm guardians.
3. Confirm program.
4. Show fees / fundraising.
5. Capture volunteer / fundraising intent.
6. Policy summaries.
7. Waivers (at the end — not the beginning).
8. Review and submit.

Each section shows:
```
Saved automatically   Last saved 2:14 PM
```

If autosave is not in Release 1, design must support it later without layout changes.

### 7.9 Review Page

Human-readable summary before final submit.

```
Student
Maya Miller — Grade 8 — Cavitt Jr. High

Program
VEX V5 Middle School

Financial Aid
Partial waiver approved. Fundraising target adjusted to $250.

Due / Next
Registration fee:    $40
Fundraising target:  $250 by July 31, 2026

Guardians
Kevin Miller — [phone] [email]
Guardian 2 — [phone] [email]

Waivers
Student Participation Waiver — ready to sign
Parent Participation Waiver — ready to sign

[Submit registration]
```

### 7.10 Registration Confirmation / Payment Page

**Route:** `/registration/confirmation`

**Do not say:** "Registration complete."

**Use:** "Registration submitted."

```
Registration submitted.
Your student is registered. Payment and fundraising are tracked separately below.

Registration Fee
$40 per student
Status: Unpaid
[Pay online via Zeffy]

Fundraising Target
$550 by July 31, 2026
Status: $0 received / $550 remaining
[Donate or sponsor online]

Payment reference code
PR-2026-MAYA-X8R2
Use this code in Zeffy comments, check memo, Benevity notes, or employer matching forms.
[Copy code]
```

**Payment reference code must be:**
1. Shown on confirmation page.
2. Included in confirmation email.
3. Copyable with one tap/click.
4. Associated with enrollment, not family.
5. Used in all payment method instructions.

**Multiple students — show separate codes:**
```
Payment reference codes
Maya — VEX V5:    PR-2026-MAYA-X8R2
Alex — Combat:    PR-2026-ALEX-Q91D
```

Do not create or display a family-level code unless family-level billing is explicitly implemented.

---

## 8. Returning Family UX

Returning families review and confirm — they do not retype.

**Always reset each season:**
- Financial aid (re-apply required)
- Waivers (re-sign required)
- Student communication consent (re-certify required)
- Season-specific registration
- Payment/fundraising obligation

**Carry forward:**
- Family account and login
- Guardian records (pre-filled, editable)
- Student records (pre-filled, editable)
- Prior program/team history (visible, informational)
- Volunteer clearance status (subject to annual renewal)

**Returning family dashboard:**
```
Welcome back.
We found your prior family record. Please review your information for the new season.

Guardian contacts          [Looks good]  [Edit]
Student information        [Looks good]  [Edit]
Emergency contacts         [Looks good]  [Edit]
Communication preferences  [Looks good]  [Edit]
Prior team / program       [Review]
```

---

## 9. Payment UX

### 9.1 Separate Fee and Fundraising

The UI always separates:
- Registration fee
- Fundraising target
- Sponsorship credit
- Employer matching
- Payment transactions
- Remaining balance / target

Never collapse into one generic "payment status."

### 9.2 Payment Reference Code

See Section 7.10. Associated with enrollment, not family.

### 9.3 Payment States

**Family-facing:**
- Registration fee unpaid / paid / waived
- Fundraising not started / partial / complete / waived
- Payment received and being matched

**Admin-facing:**
- Unmatched payment / Auto matched / Manually matched / Needs review / Ignored / Allocated across enrollments

### 9.4 Unmatched Payments (Admin Only)

```
Payment received but not matched.

Possible matches:
— Miller family — email match
— Maya Miller enrollment — amount matches $40
— Alex Miller enrollment — same guardian email

[Match to enrollment]  [Match to family]  [Split/allocate]  [Ignore]  [Needs research]
```

Families generally do not see "unmatched payment" unless there is an action they need to take.

---

## 10. Admin Screens

### 10.1 Admin Home

**Route:** `/admin`

Queue-first. Never a raw table.

```
Needs attention
12   applications to review
3    financial aid requests
8    registrations submitted but unpaid
4    unmatched payments
2    sync failures
5    volunteers waiting on background check
```

**Primary queues:**
Applications / Financial Aid / Registrations / Payments / Teams / Volunteers / Sync Issues / Broadcasts / Settings

### 10.2 Application Review

Financial aid must not be visible. Period.

**Actions:** Accept / Decline / Needs follow-up / Program pending / Admin-waive (with mandatory notes)

**The review screen must not show:** financial aid requested, government assistance program, need description, financial aid notes, financial aid decision.

### 10.3 Financial Aid Review

Restricted to Financial Aid Admin and Super Admin.

**Actions:** Approve full fundraising waiver / Approve partial fundraising waiver / Deny / Explicitly waive registration fee (Super Admin only)

**UI must make clear:**
> Financial aid adjusts fundraising by default. The $40 registration fee is not waived unless explicitly selected by an authorized admin.

### 10.4 Registration Detail

Shows: student, family, program, division, registration status, waiver status, fee status, fundraising status, team assignments, communication consent, admin notes, audit history.

### 10.5 Payment Dashboard

Shows: payment transactions, unmatched payments, manual entry, allocation, registration fee status, fundraising collected, sponsorship credit, remaining target.

**Actions:** Create manual transaction / Match / Split/allocate / Mark fee paid / Mark fee waived (Super Admin) / Record sponsorship credit / Export report.

### 10.6 Team Assignment

**Must support students in both V5 and Combat.**

Do not assume one enrollment = one team. Use team membership rows. A student can have:
- V5 team assignment
- Combat team assignment
- Coach/manager relationship
- Different communication group memberships

### 10.7 Sync Failures

```
Google/Slack Sync
Last run: 2:14 PM     Status: 3 failures

Failures
parent@hotmail.com       Google Group add failed     [Retry]  [Mark resolved]
student under 13         Slack invite blocked        [View details]
v5-ms-coaches            API permission error        [Retry]
```

Families never see raw sync failures.

---

## 11. Volunteer UX

### 11.1 Volunteer Clearance Checklist

**Route:** `/volunteer`

```
Step 1   Volunteer application          Complete
Step 2   Background check               Waiting for admin confirmation
Step 3   APS youth protection training  Not started
Step 4   Youth protection quiz          Not started
Step 5   Lab orientation                Not scheduled
```

**Step 2 example:**
```
Background check
Status: Waiting for admin confirmation
You completed Live Scan outside this system. Placer Robotics will mark this step complete once the result is confirmed.
```

### 11.2 APS Training

Make clear APS happens outside the platform.

> APS training opens in a separate site. When you complete the training, Placer Robotics will receive confirmation automatically.

**If webhook not received after 24 hours:**
> Training completion has not been received yet. If you completed training more than 24 hours ago, contact Placer Robotics.

### 11.3 Renewal UX

Checklist model. Always required: current season policy acknowledgment. Conditionally required: quiz (if policy changed), APS training (if cert expiring).

**APS reinstatement rule:** Auto-reinstatement allowed only from `expired`. Never from `suspended`.

**If suspended:**
> Your volunteer clearance has been suspended. Please contact Placer Robotics to discuss next steps.

---

## 12. IQ Coach UX

**Route:** `/iq-team/create`

```
Create a VEX IQ Team
For parent coaches registering an IQ team.
Team fee: $1,200.
Student registration happens after the team is confirmed.
Coach clearance is required, but students may begin registration while coach clearance is pending.
```

**Important:** IQ team fee belongs to the team, not the coach's student. If the coach is also a parent registering their own child, the team fee must not appear as that student's fundraising or payment.

**Coach dashboard shows:**
- Team payment status
- Team confirmation status
- events.vex.com registration status
- Coach clearance status
- Student roster

---

## 13. Google Group / Slack Sync UX

### 13.1 Family-Facing

Do not expose sync mechanics. Simple status only:

```
Communication setup
Pending — you will be added after registration is processed.
```

### 13.2 Admin-Facing

See Section 10.7 (Sync Failures).

### 13.3 Under-13 Slack Rule

Server-side sync must block Slack invite for under-13 students or students without communication consent. Block must not rely only on UI hiding.

**Admin sync log:**
> Slack invite blocked because student is under 13 or lacks student communication consent.

**Family message (only if needed):**
> Some communication tools may not be available for younger students. Parent/guardian communication remains active.

---

## 14. Error and Edge-Case UX

### 14.1 Expired Magic Link
> This login link has expired. For security, login links expire after 15 minutes. Enter your email below and we'll send a new one.

### 14.2 Email Mismatch
> We found an application for this family, but it is linked to a different email address. Contact Placer Robotics if you need to change your primary email.

### 14.3 Registration Locked for Financial Aid
> Registration is paused while your financial assistance request is being reviewed. You will receive an email when registration is unlocked.

### 14.4 Permission Restricted

*For Registration Admin:*
> Financial aid details are restricted and reviewed separately.

*For Read-only Admin:*
> You have read-only access. Contact a Super Admin if a change is needed.

### 14.5 Payment Reference Missing
> We could not find a payment reference code for this registration. Please contact Placer Robotics before submitting payment.

### 14.6 Sync Failure (Admin only)
> This sync failed. No family action is needed. Review the error, correct the issue, and retry sync.

---

## 15. Mobile Requirements

Family/public UX is mobile-first.

- Single-column layout on mobile
- Large touch targets (minimum 44px)
- No tiny signature boxes — typed names only
- Sticky or obvious Save/Continue
- Progress indicator
- Payment code copy button (one tap)
- Phone/email optimized input types (`tel`, `email`)
- No dense tables for families
- Error messages visible near fields
- Readable policy summaries (not tiny print)

The system is replacing JotForm partly because of mobile signature and form-completion pain. The new UX must not recreate that problem.

---

## 16. Accessibility Requirements

Target: WCAG 2.1 AA.

- Semantic headings (correct hierarchy, not style-based)
- Form labels (every input labeled)
- Accessible error messages (associated with fields)
- Keyboard navigation (all interactive elements reachable)
- Visible focus states
- Sufficient color contrast (4.5:1 minimum)
- No color-only status communication (always include text)
- Screen-reader-friendly progress indicators
- Mobile viewport support down to 375px

Status badges must include text, not color alone.

---

## 17. Static Wireframe Routes

Before wiring screens to Supabase, create static wireframe routes using mock data.

**Required static wireframes:**
- `/apply`
- `/financial-aid`
- `/register`
- `/registration/confirmation`
- `/dashboard`
- `/admin`

**Recommended additional wireframes:**
- `/admin/applications`
- `/admin/financial-aid`
- `/admin/payments`
- `/volunteer`
- `/iq-team/create`

**Purpose:**
1. Validate layout and information hierarchy.
2. Prevent Codex from inventing CRUD UI.
3. Allow non-technical reviewers to see the product before database wiring.
4. Establish Tailwind/component patterns early.

---

## 18. Codex Build Tasks (UX-Specific)

### Task 1.5 — Design System and UX Shell

Insert after scaffold (Task 1) and before any product screens.

```
Task 1.5 — Design System and UX Shell

Implement the base design system before building product screens.

Create reusable components:
- PublicShell, FamilyShell, AdminShell
- PageHeader
- StepChecklist, StepChecklistItem
- StatusBadge
- ActionCard
- FormSection, FormField
- InfoAlert, WarningAlert, ErrorAlert, SuccessAlert
- PaymentReferenceCard
- AdminQueueTable, AdminDetailPanel
- AuditTrailCard
- EmptyState, LoadingState, PermissionNotice

Use the Placer Robotics platform palette:
- Deep navy (#0E2558) for structure and navigation
- White (#FFFFFF) cards
- Light gray (#F5F6F8) page backgrounds
- Placer Gold (#F2C352) for brand accents and select public CTAs
- Program accent colors only for small badges/chips/markers:
  VEX V5: #2563EB | VEX IQ: #F2C352 | Combat: #D95B3D | General: #7E8FB9

Typography: Inter. Body 15–16px. Labels 12–13px medium.

Do not expose raw database terminology to family users.
Family pages: action/checklist-oriented.
Admin pages: queue-oriented.
Status badges: always include text, never color alone.
```

### Task 1.6 — Static Wireframe Routes

```
Task 1.6 — Static Wireframe Routes

Create static, non-functional wireframe pages using mock data only.
Do not connect to Supabase.

Routes required:
- /apply
- /financial-aid
- /register
- /registration/confirmation
- /dashboard
- /admin

Each page must demonstrate:
- Family checklist UX model (action-first, no database terms)
- Queue-based admin UX model
- Payment and fundraising separation (never combined)
- Payment reference code display with copy button
- Financial aid gate privacy language
- Mobile-first single-column layout
- Placer Robotics navy/gold/white visual system
- Program badges for VEX V5, VEX IQ, Combat where relevant
- Status badges with text (never color alone)
```

---

## 19. Codex UX Guardrails

1. Do not expose raw database terminology to family users.
2. Do not build family pages as CRUD screens.
3. Do not build admin home as one giant table.
4. Do not combine registration fee and fundraising into one payment amount.
5. Do not place waivers at the beginning of registration.
6. Do not make financial aid feel stigmatizing.
7. Do not show financial-aid details to Registration Admin.
8. Do not rely on color alone for status.
9. Do not protect `/apply` or `/iq-team/create` with auth middleware.
10. Do not create a family-level payment reference code unless family-level billing is explicitly added.
11. Do not allow student login in family/public UX.
12. Do not frame student-written answers as direct student submission.
13. Do not let browser clients write audit logs directly.
14. Do not bypass RLS with client-side filtering.
15. Do not implement Google/Slack sync as family-facing complexity.
16. Do not use black/gold as the dominant web-app theme.
17. Do not make VEX V5, VEX IQ, and Combat feel like separate websites.
18. Do not use program accent colors beyond badges, chips, small markers, and filters.
19. Do not build a product screen against live data until the corresponding static wireframe exists.
20. Do not assume Netlify-specific or Cloudflare edge runtime behavior — deploy target is Vercel.

---

## 20. Screen Priority

### Priority 1 — Family / Public (Build First)
1. Public application form (`/apply`)
2. Financial aid prompt and request form
3. Registration wizard
4. Registration confirmation / payment page
5. Family dashboard

### Priority 2 — Admin (Build Next)
1. Admin home / Needs attention
2. Application review detail
3. Financial aid review detail
4. Registration detail
5. Payment transaction / matching screen
6. Team assignment screen
7. Volunteer clearance detail
8. Sync failures screen
9. Season configuration screen
10. Waiver template screen

### Priority 3 — Volunteer / IQ (Build After Registration Spine)
1. Volunteer clearance checklist
2. APS training pending page
3. Quiz page
4. Renewal checklist
5. IQ team creation page
6. IQ coach dashboard

---

*This document is the controlling UX specification. No product screen shall be implemented until the design system (Task 1.5) and corresponding static wireframe (Task 1.6) exist.*
