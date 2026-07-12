# Combat Event Results — Capture System

Combat robotics results are **not** in VEX/RobotEvents. They come from combat platforms
(Challonge brackets, RCE/NHRL national events, PART's own IRL league, local SBB events). This
is the capture system: **schema → manual entry / history import → phased platform integrations.**

Lives in the same **Supabase** store as the VEX stats (see `vex-stats-integration.md`), uses the
same `source` provenance pattern, feeds the same consumers (team hub, public site, external API).

**Design principle:** get a clean schema + manual/import path live *now* so historical results
are captured by hand, then bolt on automated integrations one platform at a time. Every row
carries a `source` so manual entries are never clobbered by a later sync.

---

## 1. Schema (Supabase)

Mirrors the `vex_*` tables. Weight classes map to the `team` program enum
(`combat_ant` → antweight, `combat_15lb` → 15lb).

```sql
create table combat_bot (
  bot_slug     text primary key,          -- 'kinetic-ko'
  name         text not null,
  weight_class text not null,             -- 'antweight' | '15lb' | 'beetleweight' | 'plastic_ant'
  team_number  text,                      -- optional link to vex_team (combat_ant / combat_15lb)
  is_part      boolean not null default true,
  active       boolean not null default true,
  notes        text
);

create table combat_event (
  event_slug     text primary key,        -- 'sbb-2025-11' / 'nhrl-2026-03'
  name           text not null,
  event_date     date,
  location       text,
  series         text,                    -- 'SBB' | 'IRL' | 'NHRL' | 'other'  (IRL ≠ SBB — keep distinct)
  weight_classes text[],
  source         text not null default 'manual',  -- manual | challonge | rce | impact
  external_id    text,                    -- Challonge tourney id / RCE event id / IRL id
  external_url   text
);

create table combat_result (
  id           bigint generated always as identity primary key,
  event_slug   text not null references combat_event(event_slug),
  bot_slug     text not null references combat_bot(bot_slug),
  weight_class text not null,
  placement    int,                       -- 1, 2, 3, …
  wins         int not null default 0,
  losses       int not null default 0,
  ko_wins      int,                       -- knockouts — a combat brag stat
  points       numeric,                   -- ranking points (RCE/NHRL)
  award        text,                      -- 'Best Engineered', 'Rookie of the Year', …
  source       text not null default 'manual',
  notes        text,
  unique (event_slug, bot_slug, weight_class)
);

-- Optional fight-by-fight — future / populated from Challonge matches.
create table combat_match (
  id         bigint generated always as identity primary key,
  event_slug text not null references combat_event(event_slug),
  bot_slug   text not null references combat_bot(bot_slug),
  opponent   text,
  round      text,
  outcome    text,                        -- 'W' | 'L'
  method     text,                        -- 'KO' | 'JD' | 'tapout' | …
  source     text not null default 'manual'
);

-- Live per-bot record (used by team hub + public site; no recompute step).
create view combat_bot_stats as
select b.bot_slug, b.name, b.weight_class, b.team_number,
  count(distinct r.event_slug)                as events,
  coalesce(sum(r.wins),0)                     as wins,
  coalesce(sum(r.losses),0)                   as losses,
  coalesce(sum(r.ko_wins),0)                  as ko_wins,
  count(*) filter (where r.placement = 1)     as first_places,
  count(*) filter (where r.placement <= 3)    as podiums,
  count(*) filter (where r.award is not null) as awards
from combat_bot b
left join combat_result r on r.bot_slug = b.bot_slug
group by b.bot_slug, b.name, b.weight_class, b.team_number;
```

Enable RLS + anon read (same as `vex_*`) so the public site and external consumers can read;
only the service-role key writes.

---

## 2. Manual entry + history import (build this first)

Two paths, both writing `source='manual'` rows:

**A. History import sheet** — a spreadsheet template Kevin fills for past events, imported by a
script. One row per bot-per-event:

| event_slug | event_name | date | location | series | bot | weight_class | placement | wins | losses | ko_wins | award | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

- `scripts/import_combat.py` reads the sheet, upserts `combat_event` + `combat_bot` +
  `combat_result` (idempotent on the unique keys). Mirrors the roster-import approach.
- This is how the SBB / early combat history gets in — one sheet, one import.

**B. Ongoing manual entry** — start with the **Supabase table editor** (fastest, zero build):
add a `combat_event` row, then `combat_result` rows. Later, a lightweight **admin form in the
team hub** (insert event + results) once the cadence justifies it.

> Ship A + B before any integration. Manual is the fallback that every source degrades to, and
> it's how you capture anything a platform doesn't expose.

---

## 3. Integration roadmap (phased, each a `source`)

Each integration is a sync job (GitHub Action, like the VEX stats one) that upserts rows with
its `source` tag and **never touches `source='manual'` rows**.

**Phase 2 — Challonge** (`source='challonge'`)
- API: `https://api.challonge.com/v1` — `tournaments`, `participants`, `matches`.
- Per event: pull participants → map name to `bot_slug`; pull matches → derive `wins/losses`,
  final `placement`, and optionally `combat_match` rows (fight-by-fight, method).
- Store the Challonge tournament id in `combat_event.external_id`. Good first integration —
  most local/regional combat brackets run on Challonge.

**Phase 3 — RCE / NHRL** (`source='rce'`)
- Robot Combat Events (robotcombatevents.com) / National Havoc Robot League — national circuit
  with **ranking points**. Pull event results + points into `combat_result.points`.
- Check for an official API first; fall back to a scrape (like the VEX Worlds pages) if needed.
- This is where national-ranking brag numbers come from.

**Phase 4 — Impact / IRL** (`source='impact'`)
- Impact Robotics League (app.impactroboticsleague.org) is PART's own league — its results live
  in the IRL app's data. Integrate DB-to-DB (shared/So Supabase) or via the IRL API rather than
  scraping. Keep **IRL and SBB as distinct `series` values** — they are separate properties.

---

## 4. Guardrails

- **`source` provenance on every row**; sync jobs only upsert their own source; manual rows win.
- **No student names.** Combat builders are students — capture bot / team / result content only,
  per the same rule as the VEX side.
- **Weight-class + program consistency**: `combat_ant`↔antweight, `combat_15lb`↔15lb; link
  `combat_bot.team_number` to `vex_team` so a combat team's page can show both its VEX and
  combat records if applicable.
- **IRL ≠ SBB** — distinct `series`; never conflate. IRL gets first-class placement.
- Combat feeds the public site's `combatResults` section and the team hub combat-team pages via
  `combat_bot_stats`.

## 5. Rollout checklist

1. [ ] Create the 4 combat tables + `combat_bot_stats` view in Supabase; RLS + anon read.
2. [ ] Build the import sheet template + `scripts/import_combat.py`; import SBB/early history.
3. [ ] Document the Supabase table-editor entry flow for ongoing results.
4. [ ] Team hub: combat record on `combat_ant`/`combat_15lb` team pages (from `combat_bot_stats`).
5. [ ] Public site: point the combat-results section at `combat_bot_stats` (with static fallback).
6. [ ] Phase 2: Challonge sync job (Action) → `source='challonge'`.
7. [ ] Phase 3: RCE/NHRL results + ranking points → `source='rce'`.
8. [ ] Phase 4: IRL/Impact DB integration → `source='impact'`.
```
