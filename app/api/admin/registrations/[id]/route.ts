import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'
const TSHIRT = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl'])

// PATCH /api/admin/registrations/[id]  ([id] = family_season id)
// body: { student_id, tshirt_size?, program?, team_id?, emergency_name?, emergency_phone? }
// Each changed field is logged to registration_audit_log.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const studentId = String(body.student_id ?? '')
  if (!studentId) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 })

  const db = createAdminClient()
  const log = (field: string, oldV: any, newV: any) =>
    logRegAudit(db, { familySeasonId: id, field, oldValue: oldV ?? null, newValue: newV ?? null, changedBy: admin.id, notes: `student ${studentId}` })

  // t-shirt size (student)
  if (body.tshirt_size !== undefined) {
    const v = String(body.tshirt_size || '').toLowerCase()
    if (v && !TSHIRT.has(v)) return NextResponse.json({ error: 'Invalid t-shirt size.' }, { status: 400 })
    const { data: stu } = await db.from('student').select('tshirt_size').eq('id', studentId).maybeSingle()
    await db.from('student').update({ tshirt_size: v || null }).eq('id', studentId)
    await log('tshirt_size', stu?.tshirt_size, v || null)
  }

  // program (enrollment) — a 'both' student has two enrollment rows; update all.
  if (body.program !== undefined) {
    const { data: enrs } = await db.from('enrollment').select('id, program').eq('student_id', studentId).eq('season', SEASON)
    for (const enr of (enrs ?? []) as any[]) {
      if (enr.program === body.program) continue
      const { error } = await db.from('enrollment').update({ program: body.program }).eq('id', enr.id)
      if (error) return NextResponse.json({ error: `Program update failed: ${error.message}` }, { status: 400 })
      await log('program', enr.program, body.program)
    }
  }

  // team (team_member, one active row per enrollment). Empty team_id = unassign.
  if (body.team_id !== undefined) {
    const newTeamId = String(body.team_id || '')
    const { data: enrs } = await db.from('enrollment').select('id, program').eq('student_id', studentId).eq('season', SEASON)
    for (const enr of (enrs ?? []) as any[]) {
      const { data: existing } = await db.from('team_member')
        .select('id, team_id')
        .eq('enrollment_id', enr.id).eq('season', SEASON).eq('team_role', 'student')
        .is('revoked_at', null)
        .maybeSingle()
      if (!newTeamId) {
        // Unassign: revoke the active membership (team_member.team_id is NOT NULL).
        if (existing) {
          const { error } = await db.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('id', existing.id)
          if (error) return NextResponse.json({ error: `Team unassign failed: ${error.message}` }, { status: 500 })
          await log('team', existing.team_id, null)
        }
      } else if (existing) {
        if (existing.team_id === newTeamId) continue
        const { error } = await db.from('team_member').update({ team_id: newTeamId }).eq('id', existing.id)
        if (error) return NextResponse.json({ error: `Team update failed: ${error.message}` }, { status: 500 })
        await log('team', existing.team_id, newTeamId)
      } else {
        const { error } = await db.from('team_member').insert({ team_id: newTeamId, enrollment_id: enr.id, student_id: studentId, season: SEASON, team_role: 'student', program: enr.program })
        if (error) return NextResponse.json({ error: `Team assign failed: ${error.message}` }, { status: 500 })
        await log('team', null, newTeamId)
      }
    }
  }

  // emergency contact (priority 1)
  if (body.emergency_name !== undefined || body.emergency_phone !== undefined) {
    const { data: ec } = await db.from('emergency_contact').select('id, first_name, last_name, phone, family_id').eq('student_id', studentId).eq('priority', 1).maybeSingle()
    const name = String(body.emergency_name ?? (ec ? `${ec.first_name} ${ec.last_name}` : '')).trim()
    const parts = name.split(/\s+/)
    const first = parts[0] || ''
    const last = parts.slice(1).join(' ') || '-'
    const phone = String(body.emergency_phone ?? ec?.phone ?? '').trim()
    if (ec) {
      await db.from('emergency_contact').update({ first_name: first || ec.first_name, last_name: last, phone: phone || ec.phone }).eq('id', ec.id)
    } else if (name && phone) {
      const { data: stu } = await db.from('student').select('family_id').eq('id', studentId).maybeSingle()
      await db.from('emergency_contact').insert({ family_id: stu?.family_id, student_id: studentId, first_name: first || '-', last_name: last, phone, priority: 1 })
    }
    await log('emergency_contact', ec ? `${ec.first_name} ${ec.last_name} ${ec.phone}` : null, `${name} ${phone}`.trim())
  }

  return NextResponse.json({ ok: true })
}
