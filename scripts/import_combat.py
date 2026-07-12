#!/usr/bin/env python3
"""
Combat competition history import — Placer Robotics Hub.

Reads the combat history CSV template (one row per bot per event) and upserts
combat_event / combat_bot / combat_result into Supabase, all as source='manual'.
This is how historical combat results (SBB, early events) get captured before
any platform integration (Challonge/RCE/Impact) exists. See
docs/combat-results-capture.md.

CSV columns (header row required, any order — matched by name):
    event_slug, event_name, date, location, series, bot, weight_class,
    placement, wins, losses, ko_wins, award, notes

    event_slug   stable id, e.g. 'sbb-2025-11' (reused across a bot's rows for
                 the same event so one combat_event row is created per event)
    series       SBB | IRL | NHRL | other
    weight_class plastic_ant | antweight | 15lb | beetleweight
    bot          bot display name (bot_slug is derived by slugifying this)

Usage:
    python scripts/import_combat.py history.csv            # dry run (default)
    python scripts/import_combat.py history.csv --live      # perform upserts

Environment variables (loaded from .env or the process environment):
    SUPABASE_URL                Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY   service-role key (bypasses RLS — server side only)
"""
import argparse
import csv
import re
import sys

from dotenv import load_dotenv


def get_supabase():
    from supabase import create_client
    import os

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(url, key)


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return s or "bot"


def to_int(v):
    v = (v or "").strip()
    return int(v) if v else None


class Stats:
    def __init__(self):
        self.rows_processed = 0
        self.events_upserted = 0
        self.bots_upserted = 0
        self.results_upserted = 0
        self.errors = []   # list[(row_number, message)]

    def error(self, row_no, message):
        self.errors.append((row_no, message))

    def report(self):
        print("\n" + "=" * 60)
        print("Combat history import report")
        print("=" * 60)
        print(f"  Rows processed    : {self.rows_processed}")
        print(f"  Events upserted   : {self.events_upserted}")
        print(f"  Bots upserted     : {self.bots_upserted}")
        print(f"  Results upserted  : {self.results_upserted}")
        print(f"  Errors            : {len(self.errors)}")
        if self.errors:
            print("\n  --- Errors (rows skipped) ---")
            for row_no, message in self.errors:
                print(f"      row {row_no}: {message}")
        print("=" * 60 + "\n")
        return len(self.errors)


REQUIRED_COLS = ["event_slug", "series", "bot", "weight_class"]


def import_csv(path, db, live, limit=None):
    stats = Stats()
    seen_events = set()
    seen_bots = set()

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED_COLS if c not in (reader.fieldnames or [])]
        if missing:
            raise RuntimeError(f"CSV is missing required column(s): {', '.join(missing)}")

        for row_no, row in enumerate(reader, start=2):  # header is row 1
            if limit is not None and stats.rows_processed >= limit:
                break
            stats.rows_processed += 1

            event_slug = (row.get("event_slug") or "").strip()
            bot_name = (row.get("bot") or "").strip()
            weight_class = (row.get("weight_class") or "").strip()
            series = (row.get("series") or "").strip()
            if not (event_slug and bot_name and weight_class and series):
                stats.error(row_no, "missing event_slug/bot/weight_class/series")
                continue
            bot_slug = slugify(bot_name)

            event_payload = {
                "event_slug": event_slug,
                "name": (row.get("event_name") or event_slug).strip(),
                "event_date": (row.get("date") or "").strip() or None,
                "location": (row.get("location") or "").strip() or None,
                "series": series,
                "source": "manual",
            }
            bot_payload = {
                "bot_slug": bot_slug,
                "name": bot_name,
                "weight_class": weight_class,
            }
            result_payload = {
                "event_slug": event_slug,
                "bot_slug": bot_slug,
                "weight_class": weight_class,
                "placement": to_int(row.get("placement")),
                "wins": to_int(row.get("wins")) or 0,
                "losses": to_int(row.get("losses")) or 0,
                "ko_wins": to_int(row.get("ko_wins")),
                "award": (row.get("award") or "").strip() or None,
                "notes": (row.get("notes") or "").strip() or None,
                "source": "manual",
            }

            if not live:
                continue

            try:
                if event_slug not in seen_events:
                    db.table("combat_event").upsert(event_payload, on_conflict="event_slug").execute()
                    seen_events.add(event_slug)
                    stats.events_upserted += 1
                if bot_slug not in seen_bots:
                    db.table("combat_bot").upsert(bot_payload, on_conflict="bot_slug").execute()
                    seen_bots.add(bot_slug)
                    stats.bots_upserted += 1
                db.table("combat_result").upsert(
                    result_payload, on_conflict="event_slug,bot_slug,weight_class"
                ).execute()
                stats.results_upserted += 1
            except Exception as exc:  # noqa: BLE001
                stats.error(row_no, str(exc))

    return stats


def main(argv=None):
    parser = argparse.ArgumentParser(description="Import combat competition history CSV into Supabase")
    parser.add_argument("csv_path", help="path to the history CSV")
    parser.add_argument("--live", action="store_true", help="perform writes (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="process only the first N data rows")
    args = parser.parse_args(argv)

    load_dotenv()

    if args.live:
        try:
            db = get_supabase()
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR connecting to Supabase: {exc}", file=sys.stderr)
            return 2
    else:
        db = None

    try:
        stats = import_csv(args.csv_path, db, live=args.live, limit=args.limit)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if not args.live:
        print(f"\nDRY RUN — parsed {stats.rows_processed} row(s), 0 written. Pass --live to write.")
    error_count = stats.report()
    return 1 if error_count else 0


if __name__ == "__main__":
    sys.exit(main())
