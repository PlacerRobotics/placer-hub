import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Reads for the vex_* competition-stats tables (see
 * supabase/migrations/20260620000053_vex_stats_schema.sql and
 * docs/vex-stats-integration.md). Written by scripts/part_vex_history.py,
 * NEVER by the app — these are read-only helpers.
 *
 * RLS on vex_team/vex_award/vex_worlds_run is `to authenticated using (true)`,
 * so any logged-in user (coach or admin) can read via the normal
 * lib/supabase/server.ts client — no admin client required for display.
 */

export type VexAward = {
  season: string
  title: string
  eventName: string | null
  isWorlds: boolean
  scope: 'State' | 'Region' | null
  isBanner: boolean
  bannerType: string | null
}

export type VexWorldsRun = {
  season: string
  deepestStage: string | null
  madeElim: boolean
  madeSemi: boolean
  madeFinal: boolean
}

export type TeamVexStats = {
  teamNumber: string
  program: string
  category: string
  isPart: boolean
  firstSeason: string | null
  lastSeason: string | null
  awards: VexAward[]
  worldsRuns: VexWorldsRun[]
}

// program is required: PART reuses the same team numbers across V5 and IQ
// ("295A" is two different teams), so (team_number, program) is the key.
export async function getTeamVexStats(
  supabase: SupabaseClient,
  teamNumber: string,
  program: 'vex_v5' | 'vex_iq'
): Promise<TeamVexStats | null> {
  const { data: team } = await supabase
    .from('vex_team')
    .select('team_number, program, category, is_part, first_season, last_season')
    .eq('team_number', teamNumber)
    .eq('program', program)
    .maybeSingle()
  if (!team) return null

  const [{ data: awards }, { data: runs }] = await Promise.all([
    supabase
      .from('vex_award')
      .select('season, title, event_name, is_worlds, scope, is_banner, banner_type')
      .eq('team_number', teamNumber)
      .eq('program', program)
      .order('season', { ascending: false }),
    supabase
      .from('vex_worlds_run')
      .select('season, deepest_stage, made_elim, made_semi, made_final')
      .eq('team_number', teamNumber)
      .eq('program', program)
      .order('season', { ascending: false }),
  ])

  return {
    teamNumber: team.team_number,
    program: team.program,
    category: team.category,
    isPart: team.is_part,
    firstSeason: team.first_season,
    lastSeason: team.last_season,
    awards: (awards ?? []).map((a: any) => ({
      season: a.season,
      title: a.title,
      eventName: a.event_name,
      isWorlds: a.is_worlds,
      scope: a.scope,
      isBanner: a.is_banner,
      bannerType: a.banner_type,
    })),
    worldsRuns: (runs ?? []).map((r: any) => ({
      season: r.season,
      deepestStage: r.deepest_stage,
      madeElim: r.made_elim,
      madeSemi: r.made_semi,
      madeFinal: r.made_final,
    })),
  }
}

export type CategoryStats = {
  category: string
  isPart: boolean
  firstSeason: string | null
  lastSeason: string | null
  bannerAwards: number
  bannerAtStateRegion: number
  stateChampAwards: number
  regionChampAwards: number
  worldsQualByTeam: number
  worldsQualTeams: number
  worldsQualSeasons: number
  worldsElim: number
  worldsSemiPlus: number
  worldsFinalist: number
  worldsAwards: number
  totalAwards: number
}

// category: 'v5rc' | 'viqrc' | 'cyber9537'
export async function getCategoryStats(
  supabase: SupabaseClient,
  category: string
): Promise<CategoryStats | null> {
  const { data } = await supabase.from('vex_category_stats').select('*').eq('category', category).maybeSingle()
  if (!data) return null
  return {
    category: data.category,
    isPart: !!data.is_part,
    firstSeason: data.first_season,
    lastSeason: data.last_season,
    bannerAwards: data.banner_awards ?? 0,
    bannerAtStateRegion: data.banner_at_state_region ?? 0,
    stateChampAwards: data.state_champ_awards ?? 0,
    regionChampAwards: data.region_champ_awards ?? 0,
    worldsQualByTeam: data.worlds_qual_by_team ?? 0,
    worldsQualTeams: data.worlds_qual_teams ?? 0,
    worldsQualSeasons: data.worlds_qual_seasons ?? 0,
    worldsElim: data.worlds_elim ?? 0,
    worldsSemiPlus: data.worlds_semi_plus ?? 0,
    worldsFinalist: data.worlds_finalist ?? 0,
    worldsAwards: data.worlds_awards ?? 0,
    totalAwards: data.total_awards ?? 0,
  }
}

export type CavittTeam = {
  teamNumber: string
  orgName: string | null
  gradeLevel: string | null
  firstSeason: string | null
  lastSeason: string | null
}

// The Cyber Cowboys (Willma Cavitt JH) — a separate program, never blended
// into PART's own team roster or published totals (is_part=false).
export async function getCavittTeams(supabase: SupabaseClient): Promise<CavittTeam[]> {
  const { data } = await supabase
    .from('vex_team')
    .select('team_number, org_name, grade_level, first_season, last_season')
    .eq('category', 'cyber9537')
    .order('team_number')
  return (data ?? []).map((t: any) => ({
    teamNumber: t.team_number,
    orgName: t.org_name,
    gradeLevel: t.grade_level,
    firstSeason: t.first_season,
    lastSeason: t.last_season,
  }))
}
