import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// POST /api/admin/registrations/[id]/transfer-team  ([id] = family_season id)
// body: { student_id, team_id }. Team membership is per student via team_member,
// attached to the student's enrollment — so the student must be registered.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const studentId = String(body.student_id ?? '')
  const teamId = String(body.team_id ?? '')
  if (!studentId || !teamId) return NextResponse.json({ error: 'student_id and team_id are required.' }, { status: 400 })

  const db = createAdminClient()
  // A 'both' student has two enrollment rows (vex_v5 + combat); assign across all.
  const { data: enrs } = await db
    .from('enrollment')
    .select('id, program')
    .eq('student_id', studentId)
    .eq('season', SEASON)
  const enrList = (enrs ?? []) as any[]
  if (!enrList.length) {
    return NextResponse.json({ error: 'Student has no enrollment yet — they must be registered before team assignment.' }, { status: 400 })
  }

  for (const enr of enrList) {
    const { data: existing } = await db
      .from('team_member')
      .select('id, team_id')
      .eq('enrollment_id', enr.id)
      .eq('season', SEASON)
      .eq('team_role', 'student')
      .is('revoked_at', null)
      .maybeSingle()

    if (existing) {
      if (existing.team_id === teamId) continue
      const { error } = await db.from('team_member').update({ team_id: teamId }).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await db.from('team_member').insert({
        team_id: teamId,
        enrollment_id: enr.id,
        student_id: studentId,
        season: SEASON,
        team_role: 'student',
        program: enr.program,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logRegAudit(db, {
      familySeasonId: id,
      field: 'team',
      oldValue: existing?.team_id ?? null,
      newValue: teamId,
      changedBy: admin.id,
      notes: `student ${studentId}`,
    })
  }
  return NextResponse.json({ ok: true })
}
