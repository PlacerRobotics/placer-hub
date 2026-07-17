import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public read of ONE team's own award history (row-level, unlike vex-stats'
// curated rollups) — for a team's own hub page on placer-site. Requires both
// team_number and program: vex_team's PK is (team_number, program) because
// PART reuses numbers across programs (e.g. "295A" is both a V5 team and a
// separate IQ team) — team_number alone would blend two teams' awards.
// Same service-role read pattern as app/api/public/vex-stats/route.ts.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const teamNumber = searchParams.get('team_number')
  const program = searchParams.get('program')

  if (!teamNumber || !program) {
    return NextResponse.json({ error: 'team_number and program are required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: awards, error } = await db
    .from('vex_award')
    .select('season, title, event_name, event_sku, event_date, is_worlds, scope, is_banner, banner_type')
    .eq('team_number', teamNumber.toUpperCase())
    .eq('program', program)
    .order('season', { ascending: false })
    .order('event_date', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ awards: [], generatedAt: new Date().toISOString() }, { status: 200 })
  }

  return NextResponse.json(
    { awards: awards ?? [], generatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}
