import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public read of PART's competition record (VEX + combat headline numbers),
// for the marketing site (placer-site) and any external consumer. Uses the
// service-role client because vex_*/combat_* tables are `to authenticated`
// only under RLS (see supabase/migrations/20260620000053_vex_stats_schema.sql
// — "rule 8" is preserved; this route is the deliberate public-serving path
// instead of an anon RLS exception). Same pattern as app/api/schools/route.ts.
// Returns curated, versioned rollups only — never row-level award/match detail.
export async function GET() {
  const db = createAdminClient()
  const [{ data: categories, error: catErr }, { data: combat, error: combatErr }] = await Promise.all([
    db.from('vex_category_stats').select('*'),
    db.from('combat_bot_stats').select('*'),
  ])

  if (catErr || combatErr) {
    return NextResponse.json({ categories: [], combat: [], generatedAt: new Date().toISOString() }, { status: 200 })
  }

  return NextResponse.json(
    { categories: categories ?? [], combat: combat ?? [], generatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}
