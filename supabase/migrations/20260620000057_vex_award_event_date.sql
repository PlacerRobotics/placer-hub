-- ============================================================================
-- Add event_date to vex_award
-- Migration: 20260620000057_vex_award_event_date
--
-- part_vex_history.py already fetches each event's start date from RobotEvents
-- during the scrape (see get_season()/emap in the script) but discarded it
-- before this point — vex_award had no column to hold it. Needed to sort a
-- team's own award list newest-to-oldest within a season (placer-site team
-- hub pages). Nullable: existing rows stay null until the next sync run
-- repopulates them (the sync does a clean delete+reinsert per season, so a
-- normal --backfill or --season current run backfills this for free).
-- ============================================================================

alter table vex_award add column if not exists event_date date;
