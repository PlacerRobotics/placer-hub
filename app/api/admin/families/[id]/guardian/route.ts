import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// PATCH /api/admin/families/[id]/guardian — edit a guardian's contact fields
// (name, communication email, phone). Does NOT change the auth login email.
// [id] = family id; body may include guardian_id (defaults to primary guardian).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: familyId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  const db = createAdminClient()
  let g: any
  if (body.guardian_id) {
    const { data } = await db.from('guardian').select('*').eq('id', body.guardian_id).maybeSingle()
    if (!data || data.family_id !== familyId) return NextResponse.json({ error: 'Guardian not in this family.' }, { status: 403 })
    g = data
  } else {
    const { data } = await db.from('guardian').select('*').eq('family_id', familyId).order('created_at', { ascending: true }).limit(1)
    g = data?.[0]
  }
  if (!g) return NextResponse.json({ error: 'Guardian not found.' }, { status: 404 })

  const upd: Record<string, unknown> = {}
  const changes: [string, unknown, unknown][] = []
  const map: Record<string, string> = { first_name: 'first_name', last_name: 'last_name', communication_email: 'communication_email', phone: 'phone' }
  for (const f of Object.keys(map)) {
    if (body[f] === undefined) continue
    let v: any = String(body[f]).trim()
    if (f === 'phone') v = v || g.phone // NOT NULL
    else v = v || null
    upd[f] = v
    if (String(g[f] ?? '') !== String(v ?? '')) changes.push([f, g[f], v])
  }
  if (Object.keys(upd).length) {
    const { error } = await db.from('guardian').update(upd).eq('id', g.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: fs } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (fs) for (const [f, o, n] of changes) {
    await logRegAudit(db, { familySeasonId: fs.id, field: `guardian.${f}`, oldValue: o == null ? null : String(o), newValue: n == null ? null : String(n), changedBy: admin.id, notes: `guardian ${g.id}` })
  }
  return NextResponse.json({ ok: true })
}
