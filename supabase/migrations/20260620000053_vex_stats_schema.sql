-- ============================================================================
-- Placer Robotics Hub — VEX competition stats schema
-- Migration: 20260620000053_vex_stats_schema
--
-- Historical VEX competition record (Worlds qualifications, banner awards,
-- elimination-round depth, State/Region titles), synced from the RobotEvents
-- API (events.vex.com — www.robotevents.com is dead) by
-- scripts/part_vex_history.py. See docs/vex-stats-integration.md.
--
-- Design notes:
--   * `vex_team` is standalone, keyed by team_number (NOT a foreign key to the
--     existing `team` table). Reasons: (1) historical seasons predate this
--     hub's `team` rows, (2) the "9537" / Cyber Cowboys (Willma Cavitt JH)
--     category is a separate program that will never have a `team` row here,
--     (3) `team.team_number` is nullable and not unique. `linked_team_id` is
--     an OPTIONAL soft link, populated by the sync script only when a
--     matching (team_number, season) row exists in `team`.
--   * `is_part = false` for the cyber9537 category — never blended into
--     PART's published totals (CLAUDE.md rule: PART teams vs partner teams
--     are never blended). Cavitt gets its own dedicated UI section.
--   * `source` distinguishes rows the sync script wrote ('api' / 'worlds-html'
--     — VEX marks Worlds awards awards_finalized:false, so those are HTML-
--     scraped) from hand-entered rows ('manual', edited directly in the
--     Supabase table editor / a future admin form). The sync script only
--     ever deletes+reinserts its own source rows for the season(s) it ran
--     against — manual rows are never touched.
--   * RLS deviation, documented: every other table in this schema is
--     `to authenticated` only (see 20260620000004_rls_policies.sql, "rule 8").
--     These tables hold PUBLIC competition results (no PII, no family data)
--     that the public website and external consumers need to read. Rather
--     than open anon SELECT on the raw tables — a first-ever exception to
--     rule 8 — reads stay `to authenticated` here too, and public/external
--     access is served through a dedicated read API route backed by the
--     service-role key (see docs/vex-stats-integration.md §6). Writes remain
--     super-admin only, same as `team_write`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type vex_program as enum ('vex_v5', 'vex_iq');
create type vex_category as enum ('v5rc', 'viqrc', 'cyber9537');
create type championship_scope as enum ('State', 'Region');  -- null = not a state/region championship award
create type vex_award_source as enum ('api', 'worlds-html', 'manual');
-- 'Innovate' is classified for per-type totals only — it is NEVER banner-eligible
-- (is_banner stays false for Innovate everywhere).
create type vex_banner_type as enum ('Excellence', 'Tournament Champions', 'Design', 'Robot Skills', 'Innovate');

-- ----------------------------------------------------------------------------
-- vex_team
-- PK is (team_number, program): PART reuses the SAME numbers across programs —
-- "295A" is both a V5 team and a separate IQ team. Keying on team_number alone
-- collapses them and mis-attributes every award (found the hard way on the
-- first backfill).
-- ----------------------------------------------------------------------------
create table vex_team (
  team_number  text not null,             -- canonical current number (81818X -> 295X)
  program      vex_program not null,
  category     vex_category not null,
  org_name     text,                      -- e.g. 'Willma Cavitt Junior High'
  grade_level  text,                      -- 'Elementary' | 'Middle School' | 'High School'
  is_part      boolean not null default true,
  linked_team_id uuid references team(id),  -- optional soft link; see header notes
  first_season text,
  last_season  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (team_number, program)
);

-- ----------------------------------------------------------------------------
-- vex_award — program column disambiguates shared numbers (see vex_team note).
-- ----------------------------------------------------------------------------
create table vex_award (
  id          bigint generated always as identity primary key,
  team_number text not null,
  program     vex_program not null,
  season      text not null,               -- '2021-22'
  title       text not null,               -- 'Excellence Award (VRC/VEXU/VAIRC)'
  event_name  text,
  event_sku   text,                        -- 'RE-VRC-21-5258' (null for manual rows)
  is_worlds   boolean not null default false,
  scope       championship_scope,   -- null = not a state/region championship award
  is_banner   boolean not null default false,
  banner_type vex_banner_type,
  source      vex_award_source not null default 'api',
  notes       text,
  created_at  timestamptz not null default now(),
  foreign key (team_number, program) references vex_team (team_number, program),
  unique (team_number, program, season, title, event_sku)
);

-- ----------------------------------------------------------------------------
-- vex_worlds_run — elimination depth, from the /matches API (not an award).
-- ----------------------------------------------------------------------------
create table vex_worlds_run (
  id            bigint generated always as identity primary key,
  team_number   text not null,
  program       vex_program not null,
  season        text not null,
  event_sku     text,
  -- Free text, not an enum: VEX round codes are mapped defensively in the
  -- Python (stage_of()) and an unrecognized code falls back to a generic
  -- "Elimination round" label rather than failing the sync.
  deepest_stage text,
  made_elim     boolean not null default false,
  made_semi     boolean not null default false,
  made_final    boolean not null default false,
  source        vex_award_source not null default 'api',
  created_at    timestamptz not null default now(),
  foreign key (team_number, program) references vex_team (team_number, program),
  unique (team_number, program, season, event_sku)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table vex_team       enable row level security;
alter table vex_award      enable row level security;
alter table vex_worlds_run enable row level security;

drop policy if exists vex_team_read on vex_team;
create policy vex_team_read on vex_team for select to authenticated using (true);
drop policy if exists vex_team_write on vex_team;
create policy vex_team_write on vex_team for all to authenticated using (public.is_super_admin());

drop policy if exists vex_award_read on vex_award;
create policy vex_award_read on vex_award for select to authenticated using (true);
drop policy if exists vex_award_write on vex_award;
create policy vex_award_write on vex_award for all to authenticated using (public.is_super_admin());

drop policy if exists vex_worlds_run_read on vex_worlds_run;
create policy vex_worlds_run_read on vex_worlds_run for select to authenticated using (true);
drop policy if exists vex_worlds_run_write on vex_worlds_run;
create policy vex_worlds_run_write on vex_worlds_run for all to authenticated using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- vex_category_stats — live headline numbers per category. security_invoker
-- so the view honors the querying role's RLS rather than the view owner's.
-- ----------------------------------------------------------------------------
create view vex_category_stats with (security_invoker = true) as
select t.category,
  bool_or(t.is_part)                                                as is_part,  -- uniform per category
  min(t.first_season)                                               as first_season,
  max(t.last_season)                                                as last_season,
  count(distinct a.id) filter (where a.is_banner)                   as banner_awards,
  count(distinct a.id) filter (where a.is_banner and a.scope is not null) as banner_at_state_region,
  count(distinct a.id) filter (where a.scope = 'State')             as state_champ_awards,
  count(distinct a.id) filter (where a.scope = 'Region')            as region_champ_awards,
  -- filter is load-bearing: without it, teams with no runs join as ROW(null,null),
  -- which is NOT null and inflates the distinct count by one per category.
  count(distinct (w.team_number, w.season)) filter (where w.id is not null) as worlds_qual_by_team,
  count(distinct w.team_number)                                     as worlds_qual_teams,
  count(distinct w.season)                                          as worlds_qual_seasons,
  count(distinct (w.team_number, w.season)) filter (where w.made_elim)  as worlds_elim,
  count(distinct (w.team_number, w.season)) filter (where w.made_semi)  as worlds_semi_plus,
  count(distinct (w.team_number, w.season)) filter (where w.made_final) as worlds_finalist,
  count(distinct a.id) filter (where a.is_worlds)                   as worlds_awards,
  -- per-type totals across ALL events (championship or not) — supporting
  -- numbers for the brag book; distinct from banner counts above.
  count(distinct a.id) filter (where a.banner_type = 'Excellence')           as excellence_awards,
  count(distinct a.id) filter (where a.banner_type = 'Tournament Champions') as tournament_champ_awards,
  count(distinct a.id) filter (where a.banner_type = 'Design')               as design_awards,
  count(distinct a.id) filter (where a.banner_type = 'Innovate')             as innovate_awards,
  count(distinct a.id)                                              as total_awards
from vex_team t
left join vex_award a       on a.team_number = t.team_number and a.program = t.program
left join vex_worlds_run w  on w.team_number = t.team_number and w.program = t.program
group by t.category;
