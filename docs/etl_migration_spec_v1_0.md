# Placer Robotics — ETL Migration Specification
## 25-26 Registration Data → Supabase Schema

**Version:** 1.0  
**Author:** Kevin Miller  
**Source files:** `25-26_Placer_Robotics_Registration___Informed_Consent-2.xlsx`, `25-26_Returning_Status.xlsx`  
**Target:** Supabase (hub.placerrobotics.org) via REST API or direct Postgres connection  
**Language:** Python 3, consistent with sync_script.py conventions  

---

## Overview

This spec defines the one-time historical ETL that migrates 2025-26 registration data into the Supabase schema before the new platform goes live. It is separate from the Phase 1 live sync job (which handles incoming 2026-27 applications from the Google Form).

**What this script does:**
- Migrates 25-26 enrolled students and their families as historical records
- Sets all migrated registrations to `source = migration`, `season = 2025-26`
- Creates `admin_waived` application records so families can proceed to 26-27 registration without re-applying
- Migrates payment data from Payment Log
- Migrates email corrections from Slack Role Sync and DL Email Substitutions sheets
- Marks dropped students as `status = withdrawn`

**What this script does NOT do:**
- Create 26-27 application or registration records (that's the fast-track CSV import tool)
- Migrate volunteer clearance data (separate volunteer ETL script)
- Set any consent flags (collected at registration)
- Migrate JotForm signature URLs as platform waivers (insufficient evidence standard)

---

## Source Sheet Reference

All sheets are in `25-26_Placer_Robotics_Registration___Informed_Consent-2.xlsx`.

| Sheet | Purpose | Key |
|---|---|---|
| `RegData` | Primary registration records | Col D: student email (unique per submission) |
| `Payment Log` | Payment tracking per student | Col A: student email (links to RegData) |
| `Dropped Students` | Mid-season drops | Same columns as RegData, no header row |
| `Slack Role Sync Email Mappings` | login_email → slack_email corrections | Col A: login email, Col B: slack email |
| `DL Email Substitutions` | login_email → google_email corrections | Col A: original, Col B: corrected |
| `ReturnsAccepts` | Prior admin review (25-26 intake) | Informational only — not migrated directly |

`25-26_Returning_Status.xlsx` — Sheet1 (HS, 131 rows) and Sheet2 (MS, 8 rows) — used to determine 26-27 intent. Not migrated as historical records, but drives which families get admin_waived 26-27 records.

---

## RegData Column Map

All column references are 0-indexed.

| Index | Column Letter | Field Name | Target |
|---|---|---|---|
| 0 | A | Submission timestamp | `student_application.submitted_at` |
| 1 | B | Student First Name | `student.first_name` |
| 2 | C | Student Last Name | `student.last_name` |
| 3 | D | Participant Email | `student.communication_email` (match key) |
| 4 | E | Street Address | `student.street_address` |
| 5 | F | Street Address Line 2 | append to street_address if non-null |
| 6 | G | City | `student.city` |
| 7 | H | State / Province | `student.state` |
| 8 | I | Postal / Zip Code | `student.zip_code` (cast to string, zero-pad 5 digits) |
| 9 | J | Participant Cell Phone | `student.phone` |
| 10 | K | Program Age Group | → `division` enum (see mapping below) |
| 11 | L | Grade Fall 2025 | `student.grade` (see grade mapping below) |
| 12 | M | School Attending Fall 2025 | `student.school_raw` + fuzzy match → `student.school_id` |
| 13 | N | Guardian 1 First Name | `guardian.first_name` |
| 14 | O | Guardian 1 Last Name | `guardian.last_name` |
| 15 | P | Guardian 1 Email | `guardian.login_email` (family match key) |
| 16 | Q | Guardian 1 Phone | `guardian.phone` |
| 17 | R | Guardian 2 First Name | `guardian.first_name` (second guardian) |
| 18 | S | Guardian 2 Last Name | `guardian.last_name` (second guardian) |
| 19 | T | Guardian 2 Email | `guardian.login_email` (second guardian) |
| 20 | U | Guardian 2 Phone | `guardian.phone` (second guardian) |
| 21 | V | T-Shirt Size | `student.tshirt_size` (see enum mapping below) |
| 22 | W | 2025-2026 Programs | → `registration.program` (see mapping below) |
| 23 | X | Terms and Conditions | ignore |
| 24 | Y | Volunteer roles interest | `guardian.volunteer_interests` (Guardian 1) |
| 25 | Z | Contribution Options | `payment_transaction.notes` (informational) |
| 26 | AA | Donation Amount | `payment_transaction.amount` for donation row |
| 27 | AB | Custom Amount | fallback if AA is null |
| 28 | AC | Payment Method | → `payment_transaction.source` (see mapping) |
| 29 | AD | Matching Gift | `guardian.employer_match_pct` flag |
| 30 | AE | Company Name | `guardian.employer` |
| 31 | AF | Matching % | `guardian.employer_match_pct` |
| 32 | AG | Sponsorship comments | `payment_transaction.notes` |
| 33 | AH | Business/Sponsor Name | `payment_transaction.payer_name` |
| 34 | AI | Sponsorship Level | `payment_transaction.notes` |
| 35 | AJ | Cash/In-Kind | `payment_transaction.notes` |
| 36 | AK | In-Kind Description | `payment_transaction.notes` |
| 37–47 | AL–AV | Signature URLs, printed names | **ignore** — not usable as platform waiver evidence |
| 48 | AW | Defaulted Checked | ignore |
| 49 | AX | Amount Due Calc | `registration.fundraising_target` source |
| 50 | AY | Online Payment Products | parse for registration fee confirmation |
| 51 | AZ | Online Payment Payer Info | parse for payer name/transaction ID |
| 52 | A[ | Online Payment Payer Address | ignore |
| 53 | A\ | Payment Methods | `payment_transaction.source` (secondary) |
| 54 | A] | Custom Amount | ignore (duplicate) |
| 55 | A^ | Submission ID | `student_application.jotform_submission_id` (store as text) |

---

## Field Transformation Rules

### Program → registration.program + division

```python
PROGRAM_MAP = {
    'VEX V5 Robotics': 'vex_v5',
    'Combat Robotics': 'combat',
    'VEX V5 & Combat': 'both',  # creates TWO registration records
}

# If 'VEX V5 & Combat': create one registration record for vex_v5 AND one for combat
# Each gets its own payment_reference_code
# fundraising_target = 550 for each (total 1100 across both)
```

### Age Group → division

```python
DIVISION_MAP = {
    'Middle School (7-8)': 'middle',
    'High School (9-12)': 'high',
    '12th': 'high',  # edge case observed in data
}
```

### Grade normalization

```python
# Col L values: '7th', '8th', '9th', '10th', '11th', '12th'
# Strip 'th'/'st'/'nd'/'rd', cast to int
def parse_grade(val):
    if not val: return None
    return int(str(val).replace('th','').replace('st','').replace('nd','').replace('rd','').strip())
```

### ZIP code normalization

```python
# Col I comes as float (e.g. 95628.0) or string
def parse_zip(val):
    if not val: return None
    return str(int(float(val))).zfill(5)
```

### T-shirt size → enum

```python
TSHIRT_MAP = {
    'XS': 'xs',
    'Small': 's',
    'Medium': 'm',
    'Large': 'l',
    'XL': 'xl',
    'XXL': 'xxl',
}
```

### Payment method → source enum

```python
PAYMENT_SOURCE_MAP = {
    'Online Now (2.9% credit card fee absorbed by Placer Robotics)': 'zeffy',
    'Paper Check (instructions below)': 'check',
    'Benevity': 'benevity',
    'Other corporate platform': 'corporate_match',
}
```

### Volunteer interests → array

```python
# Col Y: newline-separated list of role names
# Split on \n, strip each, store as text[]
def parse_volunteer_interests(val):
    if not val: return []
    return [v.strip() for v in str(val).split('\n') if v.strip()]
```

---

## ETL Script Structure

```
etl_25_26_migration.py
├── config.py          # SPREADSHEET_ID, SUPABASE_URL, SUPABASE_KEY, DRY_RUN flag
├── sheet_reader.py    # Google Sheets API read (same pattern as sync_script.py)
├── transformers.py    # All field transformation functions
├── upsert.py          # Supabase upsert logic, idempotent helpers
├── school_matcher.py  # Fuzzy school name → school_id
└── report.py          # Summary report output
```

---

## Processing Order

Run in this exact order. Each step depends on the previous.

### Step 1 — Load email correction tables

Read both mapping sheets first. Build lookup dicts used throughout.

```python
# Slack Role Sync Email Mappings
# Col A: login_email (original), Col B: slack_email
slack_email_map = {}  # login_email → slack_email
# Skip row 1 (header)
for row in slack_sheet.iter_rows(min_row=2, values_only=True):
    if row[0] and row[1]:
        slack_email_map[row[0].strip().lower()] = row[1].strip().lower()

# DL Email Substitutions  
# Col A: original_email, Col B: corrected_email
google_email_map = {}  # original → corrected
for row in dl_sheet.iter_rows(min_row=2, values_only=True):
    if row[0] and row[1]:
        google_email_map[row[0].strip().lower()] = row[1].strip().lower()
```

### Step 2 — Build dropped email set

```python
# Dropped Students sheet has NO header row — row 1 is data
# Same columns as RegData. Col D (index 3) = student email
dropped_emails = set()
for row in dropped_sheet.iter_rows(min_row=1, values_only=True):
    if len(row) > 3 and row[3]:
        dropped_emails.add(row[3].strip().lower())
```

### Step 3 — Process RegData rows

For each row in RegData (skip row 1, header):

```python
for row in reg_sheet.iter_rows(min_row=2, values_only=True):
    if not row[1]:  # skip empty rows
        continue

    student_email = row[3].strip().lower() if row[3] else None
    guardian1_email = row[15].strip().lower() if row[15] else None
    guardian2_email = row[19].strip().lower() if row[19] else None

    if not guardian1_email:
        log_error(row, "Missing Guardian 1 email — skipping row")
        continue

    # Determine dropped status
    is_dropped = student_email in dropped_emails if student_email else False

    # --- UPSERT family ---
    # Key: guardian1_email
    # If family with this login_email exists: use it
    # If not: create new family record
    family_id = upsert_family(guardian1_email)

    # --- UPSERT Guardian 1 ---
    g1_slack = slack_email_map.get(guardian1_email)
    g1_google = google_email_map.get(guardian1_email)
    upsert_guardian(
        family_id=family_id,
        login_email=guardian1_email,
        first_name=row[13],
        last_name=row[14],
        phone=row[16],
        role='primary',
        slack_email=g1_slack,
        google_email=g1_google,
        employer=row[30],
        employer_match_pct=row[31],
        volunteer_interests=parse_volunteer_interests(row[24]),
    )

    # --- UPSERT Guardian 2 (if present) ---
    if guardian2_email and guardian2_email != guardian1_email:
        g2_slack = slack_email_map.get(guardian2_email)
        g2_google = google_email_map.get(guardian2_email)
        upsert_guardian(
            family_id=family_id,
            login_email=guardian2_email,
            first_name=row[17],
            last_name=row[18],
            phone=row[20],
            role='secondary',
            slack_email=g2_slack,
            google_email=g2_google,
        )
    elif guardian2_email == guardian1_email:
        # Single guardian listed twice — common pattern in form
        # Update role to single_guardian, do not create duplicate
        update_guardian_role(guardian1_email, 'single_guardian')

    # --- UPSERT student ---
    # Key: (family_id, first_name, last_name) — email not reliable as unique key
    student_status = 'withdrawn' if is_dropped else 'active'
    zip_val = parse_zip(row[8])
    school_id = fuzzy_match_school(row[12])  # returns None if no match
    student_id = upsert_student(
        family_id=family_id,
        first_name=row[1],
        last_name=row[2],
        communication_email=student_email,
        phone=row[9],
        street_address=build_address(row[4], row[5]),
        city=row[6],
        state=row[7],
        zip_code=zip_val,
        grade=parse_grade(row[11]),
        school_raw=row[12],
        school_id=school_id,
        tshirt_size=TSHIRT_MAP.get(row[21]),
        status=student_status,
    )

    if is_dropped:
        log_info(f"Dropped student {row[1]} {row[2]} — status=withdrawn, skipping registration")
        continue

    # --- UPSERT family_season (25-26) ---
    upsert_family_season(
        family_id=family_id,
        season='2025-26',
        status='registered',
    )

    # --- Create registration record(s) ---
    programs = parse_programs(row[22])  # returns list: ['vex_v5'] or ['combat'] or ['vex_v5', 'combat']
    division = DIVISION_MAP.get(row[10], 'middle')

    for program in programs:
        fundraising_target = 550.0  # per program per student
        reg_fee = 40.0

        registration_id = upsert_registration(
            family_id=family_id,
            student_id=student_id,
            season='2025-26',
            program=program,
            division=division,
            registration_fee_amount=reg_fee,
            fundraising_target=fundraising_target,
            source='migration',
            tshirt_size=TSHIRT_MAP.get(row[21]),
        )

    # --- Create admin_waived application record (25-26) ---
    upsert_application(
        family_id=family_id,
        student_id=student_id,
        season='2025-26',
        status='admin_waived',
        source='migration',
        program=programs[0] if len(programs) == 1 else 'vex_v5',  # primary program
        waiver_notes=f"Migrated from 25-26 JotForm registration. Submission ID: {row[55]}",
        submitted_at=row[0],
    )
```

### Step 4 — Process Payment Log

The Payment Log is keyed by student email (Col A, formula-computed). Since openpyxl returns formula strings for computed cells, **read this sheet using pandas with `engine='openpyxl'` and `data_only=True`** or export to CSV first.

```python
# Payment Log columns (0-indexed after email):
# 0: student_email (computed)
# 1: student_name (computed)
# 2: program (computed)
# 3: Reg Date
# 4: Amount Due
# 5: Payment Type
# 6: Sponsor Level
# 7: Donation Amount
# 8: Reg Fee (always 40.0)
# 9: Paid Online
# 10: Paper Check Date
# 11: Paper Check Dep Date
# 12: Paper Check Dep Amt
# 13: Benevity Status
# 14: Benevity Amount
# 15: Other (Desc + Date)
# 16: Other Amt
# 17: Donation Letter Sent (Date)
```

**Important:** The Payment Log has computed cell values. Use:

```python
wb_data = load_workbook(path, data_only=True)  # data_only=True reads cached values
ws_pay = wb_data['Payment Log']
```

For each payment row:

```python
for row in ws_pay.iter_rows(min_row=2, values_only=True):
    if not row[0] or str(row[0]) == 'Participant Email Address':
        continue

    student_email = str(row[0]).strip().lower()
    
    # Find registration_id by student email + season
    registration = lookup_registration(student_email, season='2025-26')
    if not registration:
        log_warning(f"Payment row for {student_email} — no matching registration found")
        continue

    # Registration fee transaction
    if row[8] and float(row[8]) > 0:
        upsert_payment_transaction(
            registration_id=registration.id,
            family_id=registration.family_id,
            amount=float(row[8]),
            transaction_type='registration_fee',
            source=PAYMENT_SOURCE_MAP.get(str(row[5]).strip(), 'manual'),
            payment_date=row[3],
            notes=str(row[5]) if row[5] else None,
            source_payment_id=None,  # no transaction ID from check payments
        )
        # Update registration.registration_fee_status = 'paid' if reg_fee present

    # Donation/fundraising transaction
    donation_amount = None
    donation_source = None
    
    if row[9] and float(row[9]) > 0:  # Paid Online
        donation_amount = float(row[9]) - 40.0  # subtract reg fee
        donation_source = 'zeffy'
    elif row[12] and float(row[12]) > 0:  # Paper Check Dep Amt
        donation_amount = float(row[12])
        donation_source = 'check'
    elif row[14] and float(row[14]) > 0:  # Benevity Amount
        donation_amount = float(row[14])
        donation_source = 'benevity'
    elif row[16] and float(row[16]) > 0:  # Other Amt
        donation_amount = float(row[16])
        donation_source = 'other'

    if donation_amount and donation_amount > 0:
        upsert_payment_transaction(
            registration_id=registration.id,
            family_id=registration.family_id,
            amount=donation_amount,
            transaction_type='fundraising',
            source=donation_source,
            payment_date=row[10] or row[3],  # check date or reg date
            notes=str(row[15]) if row[15] else None,  # Other desc
        )
        # Update registration.fundraising_collected

    # Employer match flag
    # Update guardian.employer, employer_match_pct from RegData (already done in Step 3)
    
    # Donation letter sent date — store in payment_transaction.notes or separate field
```

### Step 5 — Apply email corrections

After all records are created, apply the email correction maps:

```python
# Already applied during Guardian upsert in Step 3.
# Verify: for each entry in slack_email_map, confirm guardian.slack_email is set.
# For each entry in google_email_map, confirm guardian.google_email is set.
# Log any emails in maps that don't match any guardian.login_email.
```

### Step 6 — Process Return Status for 26-27 admin_waived records

For each row in Return Status Sheet1 (HS) and Sheet2 (MS) where `Wants to Return = 'Yes'`:

```python
# Sheet1 columns:
# 0: TYPE TO SEND (formula)
# 1: Wants to Return
# 2: Switch?
# 3: Volunteer Issues
# 4: Signed up for Summer Camp
# 5: Grade Fall 2025 (current grade — increment by 1 for 26-27)
# 6: First Name
# 7: Last Name
# 8: Participant Email
# 9: Program Age Group
# 10: School Attending Fall 2025
# 11: Parent/Legal Guardian Email
# 12: 2nd Parent Email
# 13: 2025-2026 Programs (current program)

for row in return_sheet.iter_rows(min_row=2, values_only=True):
    wants_return = str(row[1]).strip() if row[1] else ''
    if wants_return != 'Yes':
        continue

    guardian_email = str(row[11]).strip().lower() if row[11] else None
    if not guardian_email:
        log_warning(f"Return row {row[6]} {row[7]} — no guardian email, skipping 26-27 record")
        continue

    # Find existing family by guardian email
    family = lookup_family(guardian_email)
    if not family:
        log_warning(f"Return row {row[6]} {row[7]} — no family record found for {guardian_email}")
        continue

    # Find existing student
    student = lookup_student(family.id, row[6], row[7])
    if not student:
        log_warning(f"Return row — student {row[6]} {row[7]} not found in family {family.id}")
        continue

    # Determine 26-27 program
    switch_val = str(row[2]).strip() if row[2] else ''
    current_program = str(row[13]).strip() if row[13] else ''
    
    if switch_val and switch_val not in ('', 'None'):
        # Has a switch flag — log for admin review, create with current program for now
        log_flag(f"SWITCH: {row[6]} {row[7]} — Switch={switch_val}, current={current_program}")
    
    target_program = PROGRAM_MAP.get(current_program, 'vex_v5')
    grade_26_27 = parse_grade(row[5]) + 1 if row[5] else None  # increment grade

    # Create 26-27 family_season record
    upsert_family_season(
        family_id=family.id,
        season='2026-27',
        status='cleared_to_register',  # returning students bypass application queue
    )

    # Create 26-27 admin_waived application record
    upsert_application(
        family_id=family.id,
        student_id=student.id,
        season='2026-27',
        status='admin_waived',
        source='migration',
        program=target_program,
        waiver_notes=f"Returning student — 25-26 {current_program}. Auto-created from Return Status sheet.",
    )

    # Update student grade for 26-27
    if grade_26_27:
        update_student_grade(student.id, grade_26_27)
```

---

## Upsert Logic and Idempotency

### family
- **Match key:** `guardian.login_email` (Guardian 1 email)
- **Upsert:** if family with this primary_email exists → use it; else INSERT
- **On conflict:** do nothing (family is permanent)

### guardian
- **Match key:** `(family_id, login_email)`
- **Upsert:** INSERT or UPDATE on conflict
- **Guard:** if guardian2_email == guardian1_email → update Guardian 1 role to `single_guardian`, skip Guardian 2 insert

### student
- **Match key:** `(family_id, lower(first_name), lower(last_name))`
- Email is NOT a reliable unique key — students may share parent email
- **On conflict:** UPDATE fields; do not create duplicate

### family_season
- **Match key:** `(family_id, season)` — UNIQUE constraint in schema
- **Upsert:** INSERT or UPDATE on conflict

### registration (enrollment)
- **Match key:** `(student_id, season, program)` — UNIQUE constraint in schema
- **Upsert:** INSERT or UPDATE on conflict

### student_application
- **Match key:** `(student_id, season)` — UNIQUE constraint in schema
- **Upsert:** INSERT or UPDATE on conflict

### payment_transaction
- **Match key:** `(source, source_payment_id)` WHERE source_payment_id IS NOT NULL
- For manual/check records with no source_payment_id: check for existing record by `(registration_id, transaction_type, amount)` before inserting to avoid duplicates
- **On conflict:** skip (do not overwrite manual records)

---

## Error Handling

```python
# Per-row error handling
errors = []
warnings = []
flags = []
skipped = []

def log_error(row, msg):
    errors.append({'row': row_num, 'student': f"{row[1]} {row[2]}", 'msg': msg})

def log_warning(msg):
    warnings.append({'row': row_num, 'msg': msg})

def log_flag(msg):
    flags.append({'row': row_num, 'msg': msg})  # needs admin attention

# Continue processing on row-level errors
# Abort only on schema/connection errors
```

---

## Dry-Run Mode

```python
DRY_RUN = True  # Default — override with --live flag

if DRY_RUN:
    # Log all intended operations without executing
    print(f"[DRY RUN] Would upsert family: {guardian1_email}")
    print(f"[DRY RUN] Would upsert student: {row[1]} {row[2]}")
    # etc.
else:
    # Execute Supabase upserts
```

Run with `python etl_25_26_migration.py` for dry run.  
Run with `python etl_25_26_migration.py --live` to execute.

---

## Summary Report Output

```
=== 25-26 Migration Summary ===
Run mode: DRY RUN / LIVE
Run date: [datetime]

Source data:
  RegData rows processed:        [n]
  Dropped students identified:   [n]
  Payment Log rows:              [n]
  Return Status rows (HS):       [n]
  Return Status rows (MS):       [n]
  Slack email mappings:          [n]
  DL email corrections:          [n]

Records created/updated:
  Families:                      [n] new / [n] existing
  Guardians:                     [n] new / [n] updated
  Students:                      [n] new / [n] updated
  Students withdrawn:            [n]
  Registrations (25-26):         [n]
  Applications (25-26):          [n]
  Payment transactions:          [n]
  26-27 family_season records:   [n]
  26-27 admin_waived apps:       [n]

Email corrections applied:
  Slack email overrides:         [n] matched / [n] unmatched
  Google email overrides:        [n] matched / [n] unmatched

School canonicalization:
  Matched to known school:       [n]
  Created unverified (new):      [n]
  Needs admin review:            [list of school names]

Flags requiring admin attention:
  Program switch flagged:        [n]
  [list of student names and switch values]

Warnings (non-blocking):
  [list]

Errors (rows skipped):
  [list]
```

---

## Admin CSV Import Tool Column Spec

For the in-platform fast-track import (returning students and new 26-27 admits), the admin uploads a CSV with these exact columns:

```
student_first_name      (required)
student_last_name       (required)
student_email           (optional)
grade_fall_2026         (required — integer, e.g. 9)
school                  (required)
program                 (required — vex_v5 | combat | vex_iq)
division                (required — middle | high)
guardian1_first         (required)
guardian1_last          (required)
guardian1_email         (required)
guardian1_phone         (optional)
guardian2_first         (optional)
guardian2_last          (optional)
guardian2_email         (optional)
guardian2_phone         (optional)
team_number             (optional — e.g. 295A)
tshirt_size             (optional — xs | s | m | l | xl | xxl)
notes                   (optional — stored in family_season.current_season_notes)
```

System behavior on import:
1. Match guardian1_email to existing family (if found) or create new family
2. Create or update student record
3. Create `admin_waived` application for 2026-27
4. Create `family_season` with `status = cleared_to_register`, season = 2026-27
5. Create draft `registration` record with `source = admin_waived`
6. Send magic link to guardian1_email AND guardian2_email (if present)
7. Add row to import summary report

The Return Status sheet maps directly to this format with minor column additions:
- Add `grade_fall_2026` (current grade + 1)
- Add `program` (use Switch? column value if switching, else current program)
- Add `team_number` if known
- Add `division` (derive from grade_fall_2026: 7-8 = middle, 9-12 = high)

---

## Known Data Issues

| Issue | Rows affected | Handling |
|---|---|---|
| Guardian 2 email same as Guardian 1 | Multiple | Update G1 role to `single_guardian`, skip G2 |
| Student email is school domain | Some | Store as-is, flag in report — warn at registration |
| ZIP code as float (95628.0) | All | Cast to int, zero-pad to 5 digits |
| Grade field is '12th' not 'High School (9-12)' | ~1 | Map '12th' → division = high |
| Program 'VEX V5 & Combat' | Some | Create two registration records |
| Payment Log cells are formulas | All | Use `data_only=True` in openpyxl |
| Dropped Students has no header row | 8 rows | `min_row=1` not `min_row=2` |
| Submission ID stored as formula `=TEXT(...)` | All | Read with `data_only=True` or parse string |

---

## Running Order

```bash
# 1. Deploy schema (Task 2)
# 2. Seed school table with known schools
# 3. Dry run — review output
python etl_25_26_migration.py

# 4. Fix any blocking errors
# 5. Live run
python etl_25_26_migration.py --live

# 6. Review school canonicalization queue in admin dashboard
# 7. Review program switch flags
# 8. Deploy Phase 1 sync job for incoming 26-27 applications
```
