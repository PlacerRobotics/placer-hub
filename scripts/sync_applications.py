#!/usr/bin/env python3
"""
Task 2a - Phase 1 Google Form sync job for Placer Robotics Hub.

Reads the 2026-27 registration responses from the Google Sheet backing the
existing Google Form (the "RegData" tab) and upserts them into Supabase.
Designed to run every 15 minutes from cron or an external scheduler.

Usage:
    python scripts/sync_applications.py            # dry run (default): read + report, write nothing
    python scripts/sync_applications.py --live     # perform upserts
    python scripts/sync_applications.py --limit 50 # process only first N data rows

Environment variables (loaded from .env or the process environment):
    REGISTRATION_SHEET_ID          Google Sheet ID containing the RegData tab
    GOOGLE_APPLICATION_CREDENTIALS path to a Google service-account JSON key file
                                   (read-only Sheets scope), OR
    GOOGLE_SERVICE_ACCOUNT_JSON    the service-account JSON inline (string)
    SUPABASE_URL                   Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY      service-role key (bypasses RLS - server side only)
    REGISTRATION_SHEET_TAB         optional, defaults to "RegData"

Cron (every 15 minutes):
    */15 * * * * cd /path/to/placer-hub && python scripts/sync_applications.py --live >> /var/log/placer_sync.log 2>&1

--------------------------------------------------------------------------------
SCHEMA RECONCILIATION NOTES (current schema = migration 20260620000001):
  1. student_application has NO jotform_submission_id column yet. This script
     writes/dedupes on it, so add it once before a --live run:
         alter table student_application
           add column if not exists jotform_submission_id text unique;
     (Idempotency also holds via the existing unique(student_id, season).)
  2. "VEX V5 & Combat" cannot become two student_application rows: the table is
     unique on (student_id, season). Per PRD multi-program is modelled at the
     enrollment level (created later at registration), not at application. This
     script creates ONE application (program_interest = first program) and raises
     a 'multi_program' admin-review flag listing all selected programs.
  3. division (Middle/High) has no column on student or student_application in the
     current schema (it lives on enrollment). We persist grade; division is parsed
     only for validation/flagging and surfaced in the report.
--------------------------------------------------------------------------------
"""

import argparse
import difflib
import json
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv

SEASON = "2026-27"
DEFAULT_TAB = "RegData"
SHEET_RANGE_TEMPLATE = "{tab}!A:BD"   # column BD == 0-indexed 55 (jotform submission id)
HEADER_ROWS = 1
SCHOOL_MATCH_CUTOFF = 0.82

# ---- Column indices (0-indexed) -------------------------------------------------
C_TIMESTAMP = 0
C_STU_FIRST = 1
C_STU_LAST = 2
C_STU_EMAIL = 3
C_ADDR1 = 4
C_ADDR2 = 5
C_CITY = 6
C_STATE = 7
C_ZIP = 8
C_STU_PHONE = 9
C_AGE_GROUP = 10
C_GRADE = 11
C_SCHOOL = 12
C_G1_FIRST = 13
C_G1_LAST = 14
C_G1_EMAIL = 15
C_G1_PHONE = 16
C_G2_FIRST = 17
C_G2_LAST = 18
C_G2_EMAIL = 19
C_G2_PHONE = 20
C_TSHIRT = 21
C_PROGRAMS = 22
C_SUBMISSION_ID = 55


# ================================================================================
# Parsing helpers
# ================================================================================
def clean(value):
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def col(row, idx):
    return row[idx] if idx < len(row) else None


def norm_zip(value):
    """Normalize a ZIP that may arrive as a float string (e.g. '95661.0') to 5 digits."""
    s = clean(value)
    if not s:
        return None
    try:
        if "." in s and s.replace(".", "", 1).isdigit():
            s = str(int(float(s)))
    except ValueError:
        pass
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return None
    return digits[:5]


def parse_grade(value):
    """'7th' -> 7. Strips ordinal suffixes; returns None if no digits."""
    s = clean(value)
    if not s:
        return None
    low = s.lower()
    for suffix in ("th", "st", "nd", "rd"):
        low = low.replace(suffix, "")
    digits = "".join(ch for ch in low if ch.isdigit())
    return int(digits) if digits else None


DIVISION_MAP = {
    "middle school": "middle",
    "middle": "middle",
    "high school": "high",
    "high": "high",
}


def parse_division(value):
    s = clean(value)
    return DIVISION_MAP.get(s.lower()) if s else None


TSHIRT_MAP = {
    "xs": "xs", "extra small": "xs",
    "s": "s", "small": "s",
    "m": "m", "medium": "m",
    "l": "l", "large": "l",
    "xl": "xl", "extra large": "xl", "x-large": "xl",
    "xxl": "xxl", "2xl": "xxl",
}


def parse_tshirt(value):
    s = clean(value)
    return TSHIRT_MAP.get(s.lower()) if s else None


def parse_programs(value):
    """Map the free-text program field to a list of program_selection enum values."""
    s = clean(value)
    if not s:
        return ["not_sure"]
    low = s.lower()
    has_v5 = "v5" in low
    has_combat = "combat" in low
    has_iq = "iq" in low
    progs = []
    if has_iq:
        progs.append("vex_iq")
    if has_v5:
        progs.append("vex_v5")
    if has_combat:
        progs.append("combat")
    return progs or ["not_sure"]


def fuzzy_school(raw, schools):
    """Return (school_id, matched_name) or (None, None). Matches name or short_name."""
    s = clean(raw)
    if not s:
        return None, None
    lookup = {}
    for sc in schools:
        if sc.get("name"):
            lookup[sc["name"].lower()] = sc
        if sc.get("short_name"):
            lookup[sc["short_name"].lower()] = sc
    match = difflib.get_close_matches(s.lower(), list(lookup.keys()), n=1, cutoff=SCHOOL_MATCH_CUTOFF)
    if match:
        sc = lookup[match[0]]
        return sc["id"], sc["name"]
    return None, None


# ================================================================================
# Clients
# ================================================================================
def get_sheets_values(sheet_id, rng):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    inline = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if inline:
        info = json.loads(inline)
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    elif cred_path:
        creds = service_account.Credentials.from_service_account_file(cred_path, scopes=scopes)
    else:
        raise RuntimeError(
            "No Google credentials: set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON"
        )
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    resp = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=rng, valueRenderOption="UNFORMATTED_VALUE")
        .execute()
    )
    return resp.get("values", [])


def get_supabase():
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(url, key)


# ================================================================================
# Sync job
# ================================================================================
class Stats:
    def __init__(self):
        self.rows_processed = 0
        self.families_created = 0
        self.families_matched = 0
        self.students_created = 0
        self.students_matched = 0
        self.guardians_upserted = 0
        self.applications_upserted = 0
        self.errors = []          # list[(row_number, message)]
        self.flags = []           # list[(row_number, type, detail)]

    def error(self, row_no, message):
        self.errors.append((row_no, message))

    def flag(self, row_no, kind, detail):
        self.flags.append((row_no, kind, detail))


class SyncJob:
    def __init__(self, supabase, live):
        self.db = supabase
        self.live = live
        self.stats = Stats()
        self._schools = None

    # -- lookups -----------------------------------------------------------------
    @property
    def schools(self):
        if self._schools is None:
            try:
                res = self.db.table("school").select("id,name,short_name").execute()
                self._schools = res.data or []
            except Exception:
                self._schools = []
        return self._schools

    def _select_one(self, table, **eq):
        q = self.db.table(table).select("*")
        for k, v in eq.items():
            q = q.eq(k, v)
        res = q.limit(1).execute()
        return (res.data or [None])[0]

    # -- family / guardian / student / application -------------------------------
    def resolve_family(self, g1_email):
        """Match family via guardian 1 login_email, fall back to family.primary_email."""
        guardian = self._select_one("guardian", login_email=g1_email)
        if guardian:
            self.stats.families_matched += 1
            return guardian["family_id"], False
        family = self._select_one("family", primary_email=g1_email)
        if family:
            self.stats.families_matched += 1
            return family["id"], False
        # create
        self.stats.families_created += 1
        if not self.live:
            return None, True
        created = (
            self.db.table("family")
            .insert({"primary_email": g1_email, "status": "active"})
            .execute()
        )
        return created.data[0]["id"], True

    def upsert_guardian(self, family_id, first, last, email, phone, role):
        if not email:
            return
        self.stats.guardians_upserted += 1
        if not self.live or family_id is None:
            return
        payload = {
            "family_id": family_id,
            "first_name": first or "",
            "last_name": last or "",
            "login_email": email,
            "phone": phone or "",
            "role": role,
        }
        self.db.table("guardian").upsert(payload, on_conflict="login_email").execute()

    def resolve_student(self, family_id, first, last, fields):
        key_first = (first or "").lower()
        key_last = (last or "").lower()
        existing = None
        if family_id is not None:
            res = self.db.table("student").select("*").eq("family_id", family_id).execute()
            for s in res.data or []:
                if (s.get("first_name") or "").lower() == key_first and (s.get("last_name") or "").lower() == key_last:
                    existing = s
                    break
        if existing:
            self.stats.students_matched += 1
            if self.live:
                self.db.table("student").update(fields).eq("id", existing["id"]).execute()
            return existing["id"], False
        self.stats.students_created += 1
        if not self.live or family_id is None:
            return None, True
        payload = {"family_id": family_id, "first_name": first, "last_name": last, **fields}
        created = self.db.table("student").insert(payload).execute()
        return created.data[0]["id"], True

    def upsert_family_season(self, family_id):
        if not self.live or family_id is None:
            return
        payload = {"family_id": family_id, "season": SEASON, "status": "applied"}
        self.db.table("family_season").upsert(payload, on_conflict="family_id,season").execute()

    def upsert_application(self, family_id, student_id, program, submitted_at, submission_id):
        self.stats.applications_upserted += 1
        if not self.live or student_id is None or family_id is None:
            return
        payload = {
            "family_id": family_id,
            "student_id": student_id,
            "season": SEASON,
            "program_interest": program,
            "status": "submitted",
            "source": "google_form_sync",
            "jotform_submission_id": submission_id,
        }
        if submitted_at:
            payload["submitted_at"] = submitted_at
        self.db.table("student_application").upsert(payload, on_conflict="student_id,season").execute()

    # -- per-row ------------------------------------------------------------------
    def process_row(self, row_no, row):
        self.stats.rows_processed += 1

        g1_email = clean(col(row, C_G1_EMAIL))
        if not g1_email:
            self.stats.error(row_no, "missing guardian 1 email (family match key)")
            return

        stu_first = clean(col(row, C_STU_FIRST))
        stu_last = clean(col(row, C_STU_LAST))
        if not stu_first or not stu_last:
            self.stats.error(row_no, "missing student first/last name")
            return

        # student fields
        addr1 = clean(col(row, C_ADDR1))
        addr2 = clean(col(row, C_ADDR2))
        street = " ".join(p for p in (addr1, addr2) if p) or None
        zip_code = norm_zip(col(row, C_ZIP))
        city = clean(col(row, C_CITY))
        grade = parse_grade(col(row, C_GRADE))
        division = parse_division(col(row, C_AGE_GROUP))
        tshirt = parse_tshirt(col(row, C_TSHIRT))
        school_raw = clean(col(row, C_SCHOOL))
        school_id, school_match = fuzzy_school(school_raw, self.schools)

        # required-not-null guards (city, zip_code, grade are NOT NULL on student)
        if not city:
            self.stats.error(row_no, "missing city (student.city is NOT NULL)")
            return
        if not zip_code:
            self.stats.error(row_no, "missing/invalid ZIP (student.zip_code is NOT NULL)")
            return
        if grade is None:
            self.stats.error(row_no, "missing/unparseable grade (student.grade is NOT NULL)")
            return

        student_fields = {
            "communication_email": clean(col(row, C_STU_EMAIL)),
            "street_address": street,
            "city": city,
            "state": clean(col(row, C_STATE)),
            "zip_code": zip_code,
            "phone": clean(col(row, C_STU_PHONE)),
            "grade": grade,
            "school_id": school_id,
            "school_raw": school_raw,
            "tshirt_size": tshirt,
            "status": "pending",
        }

        # advisory flags
        if school_raw and not school_id:
            self.stats.flag(row_no, "school_unmatched", f"'{school_raw}' needs admin canonicalization")
        if division is None and clean(col(row, C_AGE_GROUP)):
            self.stats.flag(row_no, "division_unparsed", f"age group '{clean(col(row, C_AGE_GROUP))}'")
        if tshirt is None and clean(col(row, C_TSHIRT)):
            self.stats.flag(row_no, "tshirt_unparsed", f"'{clean(col(row, C_TSHIRT))}'")

        programs = parse_programs(col(row, C_PROGRAMS))
        if "not_sure" in programs and clean(col(row, C_PROGRAMS)):
            self.stats.flag(row_no, "program_unparsed", f"'{clean(col(row, C_PROGRAMS))}' -> not_sure")
        if len(programs) > 1:
            self.stats.flag(
                row_no, "multi_program",
                f"selected {programs}; created one application as '{programs[0]}', "
                "second program -> enrollment at registration",
            )

        submitted_at = clean(col(row, C_TIMESTAMP))
        submission_id = clean(col(row, C_SUBMISSION_ID))

        try:
            family_id, _ = self.resolve_family(g1_email)
            self.upsert_guardian(
                family_id, clean(col(row, C_G1_FIRST)), clean(col(row, C_G1_LAST)),
                g1_email, clean(col(row, C_G1_PHONE)), "primary",
            )
            self.upsert_guardian(
                family_id, clean(col(row, C_G2_FIRST)), clean(col(row, C_G2_LAST)),
                clean(col(row, C_G2_EMAIL)), clean(col(row, C_G2_PHONE)), "secondary",
            )
            self.upsert_family_season(family_id)
            student_id, _ = self.resolve_student(family_id, stu_first, stu_last, student_fields)
            self.upsert_application(family_id, student_id, programs[0], submitted_at, submission_id)
        except Exception as exc:  # noqa: BLE001 - surface row-level failures in the report
            self.stats.error(row_no, f"upsert failed: {exc}")

    # -- report -------------------------------------------------------------------
    def report(self):
        s = self.stats
        mode = "LIVE" if self.live else "DRY-RUN (no writes)"
        print("\n" + "=" * 70)
        print(f"  Placer Robotics - Phase 1 application sync  [{mode}]  season {SEASON}")
        print("=" * 70)
        print(f"  Rows processed      : {s.rows_processed}")
        print(f"  Families  created   : {s.families_created:>4}   matched: {s.families_matched}")
        print(f"  Students  created   : {s.students_created:>4}   matched: {s.students_matched}")
        print(f"  Guardians upserted  : {s.guardians_upserted}")
        print(f"  Applications upsert : {s.applications_upserted}")
        print(f"  Errors              : {len(s.errors)}")
        print(f"  Admin-review flags  : {len(s.flags)}")

        if s.flags:
            print("\n  --- Flags needing admin review ---")
            by_kind = defaultdict(list)
            for row_no, kind, detail in s.flags:
                by_kind[kind].append((row_no, detail))
            for kind in sorted(by_kind):
                print(f"  [{kind}] ({len(by_kind[kind])})")
                for row_no, detail in by_kind[kind]:
                    print(f"      row {row_no}: {detail}")

        if s.errors:
            print("\n  --- Errors (rows skipped) ---")
            for row_no, message in s.errors:
                print(f"      row {row_no}: {message}")
        print("=" * 70 + "\n")
        return len(s.errors)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Phase 1 Google Form -> Supabase application sync")
    parser.add_argument("--live", action="store_true", help="perform writes (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="process only the first N data rows")
    parser.add_argument("--tab", default=None, help="sheet tab name (default: RegData / REGISTRATION_SHEET_TAB)")
    args = parser.parse_args(argv)

    load_dotenv()

    sheet_id = os.environ.get("REGISTRATION_SHEET_ID")
    if not sheet_id:
        print("ERROR: REGISTRATION_SHEET_ID is not set", file=sys.stderr)
        return 2

    tab = args.tab or os.environ.get("REGISTRATION_SHEET_TAB") or DEFAULT_TAB
    rng = SHEET_RANGE_TEMPLATE.format(tab=tab)

    try:
        values = get_sheets_values(sheet_id, rng)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR reading Google Sheet: {exc}", file=sys.stderr)
        return 2

    data_rows = values[HEADER_ROWS:]
    if args.limit is not None:
        data_rows = data_rows[: args.limit]

    try:
        supabase = get_supabase()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR connecting to Supabase: {exc}", file=sys.stderr)
        return 2

    job = SyncJob(supabase, live=args.live)
    for offset, row in enumerate(data_rows):
        sheet_row_no = HEADER_ROWS + offset + 1  # 1-based row number in the sheet
        job.process_row(sheet_row_no, row)

    error_count = job.report()
    return 1 if error_count else 0


if __name__ == "__main__":
    sys.exit(main())
