import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[,()%*]/g, '').trim()
  if (q.length < 2) return NextResponse.json({ familySeasons: [] })

  const db = createAdminClient()
  const like = `%${q}%`

  const { data: students } = await db
    .from('student')
    .select('first_name, last_name, family_id')
    .or(`first_name.ilike.${like},last_name.ilike.${like}`)
    .limit(20)

  const namesByFamily = new Map<string, string[]>()
  for (const s of (students ?? []) as any[]) {
    const list = namesByFamily.get(s.family_id) ?? []
    list.push(`${s.first_name} ${s.last_name}`)
    namesByFamily.set(s.family_id, list)
  }
  const familyIds = [...namesByFamily.keys()]
  if (!familyIds.length) return NextResponse.json({ familySeasons: [] })

  const { data: fseasons } = await db
    .from('family_season')
    .select('id, family_id, family:family_id ( display_name, primary_email )')
    .in('family_id', familyIds)
    .eq('season', SEASON)

  const familySeasons = ((fseasons ?? []) as any[]).map((fs) => {
    const names = namesByFamily.get(fs.family_id) ?? []
    const fam = fs.family?.display_name ?? fs.family?.primary_email ?? 'Family'
    return { familySeasonId: fs.id, label: `${names.join(', ')} — ${fam}` }
  })
  return NextResponse.json({ familySeasons })
}
