-- ============================================================================
-- Placer Robotics Hub — Combat competition results schema
-- Migration: 20260620000054_combat_stats_schema
--
-- Combat robotics results are NOT in RobotEvents/VEX — they come from combat
-- platforms (Challonge brackets, RCE/NHRL national events, PART's own IRL
-- league, local SBB events). See docs/combat-results-capture.md.
--
-- Same design pattern as 20260620000053_vex_stats_schema:
--   * `combat_bot` is standalone (not FK'd to `team`); `linked_team_id` is an
--     OPTIONAL soft link to this hub's own `team` table (team_program =
--     'combat'), populated only when a matching row exists. `team_number`
--     is a separate optional soft link to `vex_team.team_number`, for a bot
--     fielded by a team that also competes in VEX under the same number.
--   * `source` provenance: 'manual' (history-import sheet / table editor /
--     future admin form) now; 'challonge', 'rce', 'impact' are later phased
--     integrations (each a sync job that upserts only its own source rows —
--     manual rows are never touched).
--   * IRL and SBB are kept as distinct `series` values — separate PART
--     properties, never conflated (see memory: irl-sbb-distinct).
--   * RLS: same documented deviation as the vex_* tables — `to authenticated`
--     only (rule 8 preserved), public/external read via a service-role-backed
--     API route, not raw anon table access. Writes are super-admin only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type combat_weight_class as enum ('plastic_ant', 'antweight', '15lb', 'beetleweight');
create type combat_series as enum ('SBB', 'IRL', 'NHRL', 'other');
create type combat_source as enum ('manual', 'challonge', 'rce', 'impact');

-- ----------------------------------------------------------------------------
-- combat_bot
-- ----------------------------------------------------------------------------
create table combat_bot (
  bot_slug     text primary key,           -- 'kinetic-ko'
  name         text not null,
  weight_class combat_weight_class not null,
  team_number  text references vex_team(team_number),  -- optional: same team also fields a VEX team
  linked_team_id uuid references team(id),               -- optional soft link to this hub's own team row
  is_part      boolean not null default true,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- combat_event
-- ----------------------------------------------------------------------------
create table combat_event (
  event_slug     text primary key,         -- 'sbb-2025-11' / 'nhrl-2026-03'
  name           text not null,
  event_date     date,
  location       text,
  series         combat_series not null,
  weight_classes combat_weight_class[],
  source         combat_source not null default 'manual',
  external_id    text,                     -- Challonge tourney id / RCE event id / IRL id
  external_url   text,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- combat_result
-- ----------------------------------------------------------------------------
create table combat_result (
  id           bigint generated always as identity primary key,
  event_slug   text not null references combat_event(event_slug),
  bot_slug     text not null references combat_bot(bot_slug),
  weight_class combat_weight_class not null,
  placement    int,
  wins         int not null default 0,
  losses       int not null default 0,
  ko_wins      int,
  points       numeric,                    -- ranking points (RCE/NHRL)
  award        text,                       -- 'Best Engineered', 'Rookie of the Year', ...
  source       combat_source not null default 'manual',
  notes        text,
  created_at   timestamptz not null default now(),
  unique (event_slug, bot_slug, weight_class)
);

-- ----------------------------------------------------------------------------
-- combat_match — optional fight-by-fight detail (future / Challonge-populated)
-- ----------------------------------------------------------------------------
create table combat_match (
  id         bigint generated always as identity primary key,
  event_slug text not null references combat_event(event_slug),
  bot_slug   text not null references combat_bot(bot_slug),
  opponent   text,
  round      text,
  outcome    text,                         -- 'W' | 'L'
  method     text,                         -- 'KO' | 'JD' | 'tapout' | ...
  source     combat_source not null default 'manual',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table combat_bot    enable row level security;
alter table combat_event  enable row level security;
alter table combat_result enable row level security;
alter table combat_match  enable row level security;

drop policy if exists combat_bot_read on combat_bot;
create policy combat_bot_read on combat_bot for select to authenticated using (true);
drop policy if exists combat_bot_write on combat_bot;
create policy combat_bot_write on combat_bot for all to authenticated using (public.is_super_admin());

drop policy if exists combat_event_read on combat_event;
create policy combat_event_read on combat_event for select to authenticated using (true);
drop policy if exists combat_event_write on combat_event;
create policy combat_event_write on combat_event for all to authenticated using (public.is_super_admin());

drop policy if exists combat_result_read on combat_result;
create policy combat_result_read on combat_result for select to authenticated using (true);
drop policy if exists combat_result_write on combat_result;
create policy combat_result_write on combat_result for all to authenticated using (public.is_super_admin());

drop policy if exists combat_match_read on combat_match;
create policy combat_match_read on combat_match for select to authenticated using (true);
drop policy if exists combat_match_write on combat_match;
create policy combat_match_write on combat_match for all to authenticated using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- combat_bot_stats — live per-bot record.
-- ----------------------------------------------------------------------------
create view combat_bot_stats with (security_invoker = true) as
select b.bot_slug, b.name, b.weight_class, b.team_number, b.is_part,
  count(distinct r.event_slug)                as events,
  coalesce(sum(r.wins),0)                     as wins,
  coalesce(sum(r.losses),0)                   as losses,
  coalesce(sum(r.ko_wins),0)                  as ko_wins,
  count(*) filter (where r.placement = 1)     as first_places,
  count(*) filter (where r.placement <= 3)    as podiums,
  count(*) filter (where r.award is not null) as awards
from combat_bot b
left join combat_result r on r.bot_slug = b.bot_slug
group by b.bot_slug, b.name, b.weight_class, b.team_number, b.is_part;
