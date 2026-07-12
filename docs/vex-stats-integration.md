# Merging the VEX API + Stats Pull into the Team Hub (Supabase) & Public Site

**Goal:** one source of truth for PART's competition record — Worlds qualifications, banner
awards, elimination-round depth, State/Region titles — that the **team hub** reads natively,
the **public site** renders, and **external consumers** can pull via API. Never hand-typed.

The math already exists in `part_vex_history.py` (+ `part_vex_history_CONTENT_NOTES.md`).
This doc is how to wire it in. **System of record = Supabase.**

---

## 0. Two pipelines; Supabase is the shared store

The public site already has an **EVENTS** pipeline (Vercel Cron → `vexEventCache` in Sanity →
`lib/vexCache.ts`). We are adding a **STATS** pipeline whose store is **Supabase**, shared with
the team hub.

| | EVENTS (exists, unchanged) | STATS (this doc) |
|---|---|---|
| Question | "What competitions are coming up / happened?" | "What has PART *achieved* all-time?" |
| Source | RobotEvents `/teams/{id}/events` | events **+ `/awards` + `/matches` + Worlds-awards HTML scrape** |
| Store | Sanity `vexEventCache` | **Supabase tables** (`vex_*`) |
| Read by | Public site | **Team hub (native), public site (cached), external API** |
| Runner | Vercel Cron | **GitHub Action running the Python** |

Rule stays the same: **the VEX API is never called at render time.** The Action writes
Supabase; everything reads Supabase.

### Data flow
```
                         ┌─────────────────────────── GitHub Action (Python) ──────────────────────────┐
                         │  part_vex_history.py --season current   (2×/day, current season only)        │
 RobotEvents API ───────▶│  part_vex_history.py --backfill         (once / on demand, all seasons)      │
 Worlds awards HTML ─────▶│  → upsert rows into Supabase (source = api | worlds-html)                    │
                         └───────────────┬─────────────────────────────────────────────────────────────┘
                                         ▼
                               ┌───────────────────┐   manual rows (source = manual, edited in Studio)
                               │     SUPABASE      │◀───────────────────────────────────────────────
                               │ vex_team          │
                               │ vex_award         │──▶ vex_category_stats (view = live aggregates)
                               │ vex_worlds_run    │
                               └───┬──────────┬────┘
                    native reads   │          │   cached reads          PostgREST / Edge Fn
                                   ▼          ▼                                 ▼
                             Team Hub    Public Site (placer-site)      External consumers
                          (Cavitt page)  (homepage/impact/teams)
```

---

## 1. Sync strategy — backfill once, current-season 2×/day

Historical seasons never change, so don't re-pull them every 12 hours (that's what caused the
429s and the slow Worlds scraping).

- **`--backfill`** (run once now; re-run only to fix data or after schema changes): pulls **all
  seasons**, scrapes every past Worlds page, deletes+reinserts all `source in (api,worlds-html)`
  rows. Minutes-long, that's fine — it's rare and manual.
- **`--season current`** (the **2×/day** job): resolves the current season from the date
  (June 1 boundary), pulls only that season's events/awards/matches for the active roster, and
  upserts just those rows. The current Worlds page is scraped only once it exists (spring).
  Each run is small → the API load is trivial, exactly as you expected.

`source='manual'` rows are never touched by either mode.

---

## 2. Supabase schema

Three tables + one aggregate view. Manual overrides are just rows with `source='manual'`
(edit them in the Supabase table editor — no separate CMS doc needed).

```sql
create table vex_team (
  team_number   text primary key,          -- canonical current number (81818X → 295X)
  program       text not null,             -- vex_v5 | vex_iq | combat_15lb | combat_ant
  category      text not null,             -- 'v5rc' | 'viqrc' | 'cyber9537'
  org_name      text,                      -- e.g. 'Willma Cavitt Junior High'
  grade_level   text,                      -- 'Middle School' | 'High School' | 'Elementary'
  is_part       boolean not null default true,   -- false for cyber9537 (Cavitt)
  first_season  text,
  last_season   text
);

create table vex_award (
  id          bigint generated always as identity primary key,
  team_number text not null references vex_team(team_number),
  season      text not null,               -- '2021-22'
  title       text not null,               -- 'Excellence Award (VRC/VEXU/VAIRC)'
  event_name  text,
  event_sku   text,                        -- 'RE-VRC-21-5258' (null for manual)
  is_worlds   boolean not null default false,
  scope       text not null default '',    -- '' | 'State' | 'Region'
  is_banner   boolean not null default false,
  banner_type text,                        -- 'Excellence'|'Tournament Champions'|'Design'|'Robot Skills'
  source      text not null default 'api', -- 'api' | 'worlds-html' | 'manual'
  unique (team_number, season, title, coalesce(event_sku,''))
);

create table vex_worlds_run (
  id            bigint generated always as identity primary key,
  team_number   text not null references vex_team(team_number),
  season        text not null,
  event_sku     text,
  deepest_stage text,                       -- 'Qualification'|'Round of 16'|'Quarterfinal'|'Semifinal'|'Final'
  made_elim     boolean not null default false,
  made_semi     boolean not null default false,
  made_final    boolean not null default false,
  source        text not null default 'api',
  unique (team_number, season, coalesce(event_sku,''))
);

-- Live org/category headline numbers — always current, includes manual rows, no recompute step.
create view vex_category_stats as
select t.category,
  min(t.first_season)                                         as first_season,
  max(t.last_season)                                          as last_season,
  count(distinct a.id) filter (where a.is_banner)             as banner_awards,
  count(distinct a.id) filter (where a.is_banner and a.scope <> '') as banner_at_state_region,
  count(distinct a.id) filter (where a.scope = 'State')       as state_champ_awards,
  count(distinct a.id) filter (where a.scope = 'Region')      as region_champ_awards,
  count(distinct (w.team_number, w.season))                   as worlds_qual_by_team,
  count(distinct w.team_number)                               as worlds_qual_teams,
  count(distinct w.season)                                    as worlds_qual_seasons,
  count(distinct (w.team_number, w.season)) filter (where w.made_elim)  as worlds_elim,
  count(distinct (w.team_number, w.season)) filter (where w.made_semi)  as worlds_semi_plus,
  count(distinct (w.team_number, w.season)) filter (where w.made_final) as worlds_finalist,
  count(distinct a.id) filter (where a.is_worlds)             as worlds_awards
from vex_team t
left join vex_award a       on a.team_number = t.team_number
left join vex_worlds_run w  on w.team_number = t.team_number
group by t.category;
```

- **RLS — revised during implementation.** Every other table in this schema is
  `to authenticated` only (`20260620000004_rls_policies.sql`, "rule 8": anon gets zero access
  to anything). Rather than make the vex_*/combat_* tables the first-ever exception to that
  rule, the shipped migrations (`20260620000053`/`54`) keep them `to authenticated` too —
  writes gated on `public.is_super_admin()`, matching `team_write`. Public/external "serve it
  up" access is instead a dedicated **service-role-backed read API route** (not raw anon
  PostgREST on the tables) — see §6. This is stricter than originally planned here, and
  intentionally so.
- `banner_type` classifies the TITLE (Excellence / Tournament (or IQ Teamwork) Champions /
  Design / Robot Skills Champion); `is_banner` is stricter — **a banner is earned only at a
  Championship event** (Kevin's rule): a banner-list title at a Region/State Championship, or
  at Worlds only event-level Excellence / Tournament Champions / Robot Skills (Design at
  Worlds is a division-level award — never a banner). The same titles at regular
  tournaments/leagues are NOT banners (`banner_type` set, `is_banner` false).
- The actual shipped migrations add a few things this sketch omits: `vex_program`/`vex_category`/
  `championship_scope` (nullable, not `''`) /`vex_award_source`/`vex_banner_type` enums instead of
  bare `text`, an optional `linked_team_id uuid references team(id)` soft link on `vex_team` (and
  `combat_bot`) for joining into this hub's own roster when a matching row exists, and
  `security_invoker = true` on the views. Treat the actual migration files as authoritative over
  this sketch.

---

## 3. The Python: add `--json`/upsert output

Keep the xlsx as the human artifact; add a mode that upserts the computed `data` dicts into
Supabase. Reuse `agg()`-level fields per team.

- Add `--backfill` and `--season current`; move the file into the repo at `scripts/`.
- Add a small upsert step (Supabase REST or `supabase-py`): for the season(s) being synced,
  `delete where source in ('api','worlds-html') and season = <s>`, then insert fresh
  `vex_award` / `vex_worlds_run` rows and `upsert vex_team`.
- **Key teams by canonical current number** (apply `RENAME`) and set `is_part=false`,
  `category='cyber9537'` for the Cavitt teams.
- Merge is unnecessary in code — the `vex_category_stats` view aggregates live, so manual rows
  and API rows combine automatically.

## 4. The GitHub Action

`.github/workflows/sync-vex-stats.yml`:

```yaml
name: Sync VEX Stats
on:
  schedule: [{ cron: "0 8,20 * * *" }]   # 2×/day, matching the events cron cadence
  workflow_dispatch:
    inputs: { mode: { description: "current | backfill", default: "current" } }
jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install requests openpyxl supabase
      - env:
          VEX_EVENTS_TOKEN:        ${{ secrets.VEX_EVENTS_TOKEN }}
          SUPABASE_URL:            ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY:    ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python scripts/part_vex_history.py --season "${{ github.event.inputs.mode || 'current' }}" --to supabase
```

- New secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. `VEX_EVENTS_TOKEN` already exists.
- Run `backfill` once via **Run workflow → mode: backfill**; the schedule then keeps the current
  season fresh 2×/day.

## 5. Team hub — read natively + the Cavitt section (point 1)

The team hub reads Supabase directly (it already does for its own data).

- **Per PART team page:** a "Competition Record" block — seasons active, Worlds runs with the
  **stage reached** (elim vs. semifinal vs. — no finalist yet), banner awards grouped by type,
  State/Region titles (🚩 banners). Query `vex_award` / `vex_worlds_run` by `team_number`.
- **Dedicated Cavitt section/page** (`category='cyber9537'`, `is_part=false`): render the
  Cyber Cowboys record on its own — the 2015-16 State Championship + Worlds MS run, 9537S's
  Region-2 Excellence, etc. Keep it visually and numerically **separate from PART totals**
  (its own header, e.g. "Cavitt / Cyber Cowboys — VEX record"). This is where the long
  2013-14 → present history lives; `--backfill` populates it, `is_part=false` keeps it out of
  PART's published figures.

## 6. Public site (placer-site) — how it reads Supabase

The marketing site currently reads Sanity only. **Revised from the original sketch**: since the
shipped RLS keeps `vex_*`/`combat_*` `to authenticated` only (§2 — no anon exception to rule 8),
an anon-key client from placer-site would see zero rows. Two ways that actually work:

- **Option A (recommended): a service-role-backed read API route.** Add a route in placer-hub
  (e.g. `app/api/public/vex-stats/route.ts`) using `SUPABASE_SERVICE_ROLE_KEY` server-side only,
  returning curated JSON from `vex_category_stats`/`combat_bot_stats` — never the anon key,
  never exposed to a browser. placer-site's `lib/vexStats.ts` fetches that route (with
  `revalidate = 3600` + a static fallback), and the same route is the "external consumers" API
  mentioned in §0 — versioned and cacheable, independent of the raw schema. This is the option
  that respects rule 8 without adding a new anon-access exception.
- **Option B: mirror to Sanity.** Have the Action also write the `vex_category_stats` summary
  into a Sanity `vexStatsCache` singleton; the site keeps its Sanity-only read model and stays
  fully decoupled from the team-hub DB. More moving parts; choose this only if you want the
  public site to have zero runtime dependency on placer-hub at all.

Then swap the hard-coded figures (`orgFacts.vexWorldsQualifications: 7`, the homepage
"track record" grid, the impact prose) for the live numbers — publishing the **by-team
count (17× PART)** Kevin chose over the season-based 7×. Keep the static fallback so an empty
read never blanks the page.

## 7. Non-VEX stats — parking lot (point 2)

NRL Nationals, SXSW × BattleBots, and combat results are **not** in RobotEvents. For now they
stay manual in `orgFacts` / `lib/content.ts`.

> **PARKING LOT (Kevin):** build a source repo for the non-VEX competition data and pull it the
> same way — likely its own `nrl_*` / `combat_*` tables in the same Supabase, synced by a
> sibling job, surfaced through the same read layer. Revisit once that source exists. Until
> then the stats pipeline owns VEX figures only.

---

## 8. Guardrails

- **Worlds-award scrape is fragile** (VEX marks Worlds awards `awards_finalized:false`, so the
  API omits them). Keep the `source='manual'` path for misses (e.g. 9537's 2016 Worlds
  Robot-Skills *ranking*, which isn't an award). Have the Action log row-count deltas and alert
  on large drops.
- **Season floors are load-bearing:** 295 teams floored at 2018-19 (VEX reused those numbers
  pre-PART); 9537 keeps full history from 2013-14. Lives in the Python.
- **Definitions match the workbook & content notes** (banner = championship-level only, see §2;
  State=all-CA vs Region=Region 2,
  Worlds elim = reached the bracket, finalist = reached a Final = 0 to date — don't claim it).
- **9537 never blends into PART totals** — enforced by `is_part=false` + the view grouping by
  category, and by the separate Cavitt section.
- **API host — use `events.vex.com/api/v2`.** `robotevents.com` is dead. Both pipelines now use
  this host (`lib/vexevents.ts` fixed Jul 2026) + the single `VEX_EVENTS_TOKEN`.
- **No student names** in any stats output — matches the `team` schema intent.

## 9. Rollout checklist

1. [ ] Create the 3 tables + `vex_category_stats` view in Supabase; enable RLS + anon read.
2. [ ] Move `part_vex_history.py` → `scripts/`; add `--backfill`, `--season current`, `--to supabase`.
3. [ ] Add the GitHub Action + secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
4. [ ] Run `workflow_dispatch → backfill` once; verify rows + view in Supabase.
5. [ ] Confirm the 2×/day schedule keeps the current season fresh (spot-check after a comp).
6. [ ] Team hub: per-team Competition Record + **dedicated Cavitt section** (`category='cyber9537'`).
7. [ ] Public site: `lib/vexStats.ts` (Option A) or Sanity mirror (Option B); swap hard-coded
       VEX numbers for live ones with fallback.
8. [ ] Non-VEX: leave manual; note the parking-lot source-repo plan.
9. [ ] Update `CLAUDE.md` to document this second pipeline + Supabase store; remove the stale
       "implement stub vexevents.ts" note (it's already implemented).
```
