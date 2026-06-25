import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

// POST /api/admin/registrations/[id]/reinstate — undo a cancellation. Reinstates to
// 'registered' if the family has completed registration (any enrollment exists),
// otherwise back to 'cleared_to_register'.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const db = createAdminClient()
  const { data: fs } = await db.from('family_season').select('status, family_id, season').eq('id', id).maybeSingle()
  if (!fs) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })

  const { count } = await db
    .from('enrollment')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', fs.family_id)
    .eq('season', fs.season)
  const target = (count ?? 0) > 0 ? 'registered' : 'cleared_to_register'

  const { error } = await db.from('family_season').update({ status: target, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logRegAudit(db, { familySeasonId: id, field: 'status', oldValue: fs.status, newValue: target, changedBy: admin.id })
  return NextResponse.json({ ok: true })
}
