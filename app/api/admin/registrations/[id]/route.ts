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

  // division (enrollment) — required field, so only ever set a valid value.
  if (body.division !== undefined) {
    const div = String(body.division || '').trim()
    if (div && !['ES', 'MS', 'HS'].includes(div)) return NextResponse.json({ error: 'Invalid division (ES/MS/HS).' }, { status: 400 })
    if (div) {
      const { data: enrs } = await db.from('enrollment').select('id, division').eq('student_id', studentId).eq('season', SEASON)
      for (const enr of (enrs ?? []) as any[]) {
        if (enr.division === div) continue
        const { error } = await db.from('enrollment').update({ division: div }).eq('id', enr.id)
        if (error) return NextResponse.json({ error: `Division update failed: ${error.message}` }, { status: 400 })
        await log('division', enr.division, div)
      }
    }
  }

  // team (team_member, one active row per enrollment). Empty team_id = unassign.
  // A student team_member requires an enrollment (CHECK enrollment_id OR guardian_id),
  // so assignment is only possible once the student is registered. Audit uses team #s.
  if (body.team_id !== undefined) {
    const newTeamId = String(body.team_id || '')
    const { data: enrs } = await db.from('enrollment').select('id, program').eq('student_id', studentId).eq('season', SEASON)
    if (newTeamId && !(enrs ?? []).length) {
      return NextResponse.json({ error: 'This student isn’t registered yet — a team can be assigned after they complete registration.' }, { status: 400 })
    }
    const numOf = async (tid: string | null | undefined) => {
      if (!tid) return 'unassigned'
      const { data } = await db.from('team').select('team_number, team_name').eq('id', tid).maybeSingle()
      return data?.team_number || data?.team_name || tid
    }
    const newNum = newTeamId ? await numOf(newTeamId) : 'unassigned'
    for (const enr of (enrs ?? []) as any[]) {
      const { data: existing } = await db.from('team_member')
        .select('id, team_id')
        .eq('enrollment_id', enr.id).eq('season', SEASON).eq('team_role', 'student')
        .is('revoked_at', null)
        .maybeSingle()
      if (!newTeamId) {
        if (existing) {
          const { error } = await db.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('id', existing.id)
          if (error) return NextResponse.json({ error: `Team unassign failed: ${error.message}` }, { status: 500 })
          await log('team_assignment', await numOf(existing.team_id), 'unassigned')
        }
      } else if (existing) {
        if (existing.team_id === newTeamId) continue
        const oldNum = await numOf(existing.team_id)
        const { error } = await db.from('team_member').update({ team_id: newTeamId }).eq('id', existing.id)
        if (error) return NextResponse.json({ error: `Team update failed: ${error.message}` }, { status: 500 })
        await log('team_assignment', oldNum, newNum)
      } else {
        const { error } = await db.from('team_member').insert({ team_id: newTeamId, enrollment_id: enr.id, student_id: studentId, season: SEASON, team_role: 'student', program: enr.program })
        if (error) return NextResponse.json({ error: `Team assign failed: ${error.message}` }, { status: 500 })
        await log('team_assignment', 'unassigned', newNum)
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

  // fundraising — family_season.fundraising_method + family employer-match columns +
  // family_sponsor_interest (the spec's family-level sponsorship table; sponsor_commitment
  // is the admin sponsor CRM and can't hold this).
  if (body.fundraising_method !== undefined) {
    const FUND = new Set(['direct_donation', 'corporate_match', 'sponsored', 'paper_check', 'pending'])
    const m = String(body.fundraising_method || '')
    if (m && !FUND.has(m)) return NextResponse.json({ error: 'Invalid fundraising method.' }, { status: 400 })
    const { data: stu } = await db.from('student').select('family_id').eq('id', studentId).maybeSingle()
    const famId = stu?.family_id
    if (m && famId) {
      const { data: fsRow } = await db.from('family_season').select('fundraising_method').eq('id', id).maybeSingle()
      if (m !== (fsRow?.fundraising_method ?? '')) {
        await db.from('family_season').update({ fundraising_method: m }).eq('id', id)
        await log('fundraising_method', fsRow?.fundraising_method, m)
      }
      // Employer match lives on family — set for corporate_match, clear otherwise.
      if (m === 'corporate_match') {
        await db.from('family').update({
          employer_match_company: body.employer_company || null,
          employer_match_pct: body.employer_pct ? Number(body.employer_pct) : null,
          employer_match_portal: body.employer_portal || null,
        }).eq('id', famId)
      } else {
        await db.from('family').update({ employer_match_company: null, employer_match_pct: null, employer_match_portal: null }).eq('id', famId)
      }
      // Sponsorship interest — update the existing wizard row if present (preserves any
      // admin-set status), else insert. Left in place when the method changes away.
      if (m === 'sponsored') {
        const vals = {
          business_name: body.sponsor_business || null,
          contact_name: body.sponsor_contact || null,
          estimated_amount: body.sponsor_amount ? Number(body.sponsor_amount) : null,
        }
        const { data: existing } = await db.from('family_sponsor_interest').select('id').eq('family_id', famId).eq('season', SEASON).eq('source', 'registration_wizard').order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (existing) await db.from('family_sponsor_interest').update(vals).eq('id', existing.id)
        else await db.from('family_sponsor_interest').insert({ family_id: famId, season: SEASON, ...vals, status: 'pending', source: 'registration_wizard' })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
