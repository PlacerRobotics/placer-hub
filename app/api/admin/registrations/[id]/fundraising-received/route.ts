import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// POST /api/admin/registrations/[id]/fundraising-received — admin sign-off that a
// student's fundraising commitment was received (paper check / Benevity / sponsor),
// recording the deposit/transfer date. body: { student_id, received, date?, note?, amount? }
// ([id] = family_season id, for the audit log.)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const studentId = String(body.student_id ?? '')
  if (!studentId) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 })

  const db = createAdminClient()
  const { data: enrs } = await db.from('enrollment').select('id, fundraising_received_at').eq('student_id', studentId).eq('season', SEASON).order('created_at', { ascending: true })
  const enrList = enrs ?? []
  if (!enrList.length) return NextResponse.json({ error: 'This student has no enrollment yet.' }, { status: 400 })

  const received = body.received === true
  const receivedAt = received ? (body.date ? new Date(String(body.date) + 'T00:00:00').toISOString() : new Date().toISOString()) : null
  const upd = received
    ? { fundraising_received_at: receivedAt, fundraising_received_amount: body.amount ? Number(body.amount) : null, fundraising_received_note: String(body.note ?? '').trim() || null }
    : { fundraising_received_at: null, fundraising_received_amount: null, fundraising_received_note: null }

  const { error } = await db.from('enrollment').update(upd).eq('id', enrList[0].id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logRegAudit(db, {
    familySeasonId: id,
    field: 'fundraising_received',
    oldValue: enrList[0].fundraising_received_at ? 'received' : 'pending',
    newValue: received ? `received ${receivedAt?.slice(0, 10)}` : 'pending',
    changedBy: admin.id,
    notes: `student ${studentId}${received && body.note ? ` · ${String(body.note).trim()}` : ''}`,
  })
  return NextResponse.json({ ok: true })
}
