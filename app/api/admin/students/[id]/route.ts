import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'
const FIELDS = ['first_name', 'last_name', 'preferred_name', 'grade', 'school_id', 'school_raw', 'tshirt_size', 'communication_email', 'phone', 'birthdate']

// PATCH /api/admin/students/[id] — admin edits a student; logs each changed field.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const db = createAdminClient()
  const { data: cur } = await db.from('student').select('*').eq('id', id).maybeSingle()
  if (!cur) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  const upd: Record<string, unknown> = {}
  const changes: [string, unknown, unknown][] = []
  for (const f of FIELDS) {
    if (body[f] === undefined) continue
    let v: any = body[f]
    if (f === 'grade') v = v === '' || v == null ? cur.grade : Number(v)
    else if (typeof v === 'string') v = v.trim() || null
    upd[f] = v
    if (String(cur[f] ?? '') !== String(v ?? '')) changes.push([f, cur[f], v])
  }
  if (Object.keys(upd).length) {
    const { error } = await db.from('student').update(upd).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: fs } = await db.from('family_season').select('id').eq('family_id', cur.family_id).eq('season', SEASON).maybeSingle()
  if (fs) for (const [f, o, n] of changes) {
    await logRegAudit(db, { familySeasonId: fs.id, field: `student.${f}`, oldValue: o == null ? null : String(o), newValue: n == null ? null : String(n), changedBy: admin.id, notes: `student ${id}` })
  }
  return NextResponse.json({ ok: true })
}
