import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[,()%*]/g, '').trim()
  if (q.length < 2) return NextResponse.json({ families: [] })

  const db = createAdminClient()
  const like = `%${q}%`
  const { data } = await db
    .from('guardian')
    .select('family_id, first_name, last_name, login_email, family:family_id ( display_name, primary_email )')
    .or(`first_name.ilike.${like},last_name.ilike.${like},login_email.ilike.${like}`)
    .limit(15)

  const seen = new Set<string>()
  const families: { familyId: string; label: string }[] = []
  for (const g of (data ?? []) as any[]) {
    if (seen.has(g.family_id)) continue
    seen.add(g.family_id)
    const name = g.family?.display_name ?? `${g.last_name} Family`
    families.push({ familyId: g.family_id, label: `${name} — ${g.login_email}` })
  }
  return NextResponse.json({ families })
}
