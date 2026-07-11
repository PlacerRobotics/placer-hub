import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

// Every valid family_season_status — the admin can set any of them (a full reset,
// beyond the cancel/reinstate shortcuts). Audit-logged.
const STATUSES = new Set(['prospect', 'applied', 'accepted', 'cleared_to_register', 'registered', 'declined', 'suspended', 'cancelled'])

// POST /api/admin/registrations/[id]/set-status  body: { status }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const status = String(body.status ?? '').trim()
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })

  const db = createAdminClient()
  const { data: fs } = await db.from('family_season').select('status').eq('id', id).maybeSingle()
  if (!fs) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  if (fs.status === status) return NextResponse.json({ ok: true, unchanged: true })

  const { error } = await db.from('family_season').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logRegAudit(db, { familySeasonId: id, field: 'status', oldValue: fs.status, newValue: status, changedBy: admin.id, notes: 'admin set-status' })
  return NextResponse.json({ ok: true })
}
