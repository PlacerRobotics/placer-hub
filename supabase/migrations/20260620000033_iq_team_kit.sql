-- ============================================================================
-- 0033 — IQ team season kit tracking
-- ----------------------------------------------------------------------------
-- Each IQ team is issued a kit for the season. The IQ coordinator records the kit
-- number, the checkout date, the return date, and a verified flag that closes out
-- the kit for the season (returned + inspected). Team-level columns on `team`.
-- ============================================================================

alter table team add column if not exists kit_number text;
alter table team add column if not exists kit_checkout_date date;
alter table team add column if not exists kit_return_date date;
alter table team add column if not exists kit_return_verified boolean not null default false;
