-- 0030 — Add the 60-day APS reminder marker on volunteer_clearance. Per PRD
-- FR-VOL-009 the reminder schedule is 60/30 days (the cron drops the prior
-- 90/14-day reminders; those columns remain but are unused).
alter table volunteer_clearance add column if not exists reminder_60_sent_at timestamptz;
