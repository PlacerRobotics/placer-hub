import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'
const FUND = ['direct_donation', 'corporate_match', 'sponsored', 'paper_check', 'pending']

// PATCH /api/family/fundraising — a family edits ONE student's fundraising method(s).
// Allowed until that student's registration fee is paid (re-checked here, not just UI).
// body: { student_id, methods, employer_*, sponsor_* }
export async function PATCH(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createAdminClient()
  const { data: guardian } = await db.from('guardian').select('family_id').ilike('login_email', user.email).maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family found.' }, { status: 403 })
  const familyId = guardian.family_id

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const studentId = String(body.student_id ?? '')
  if (!studentId) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 })

  // Verify the student belongs to this family + load their enrollments.
  const { data: student } = await db.from('student').select('id, family_id').eq('id', studentId).maybeSingle()
  if (!student || student.family_id !== familyId) return NextResponse.json({ error: 'Student not found for this family.' }, { status: 403 })
  const { data: enrs } = await db.from('enrollment').select('id, registration_fee_status, fundraising_received_at').eq('student_id', studentId).eq('season', SEASON).order('created_at', { ascending: true })
  const enrList = enrs ?? []
  if (!enrList.length) return NextResponse.json({ error: 'This student isn’t registered yet.' }, { status: 400 })
  if (enrList.some((e: any) => e.registration_fee_status === 'paid' || e.fundraising_received_at)) {
    return NextResponse.json({ error: 'A payment has been recorded for this student — contact info@placerrobotics.org to change the method.' }, { status: 409 })
  }

  const methods: string[] = Array.isArray(body.methods) ? body.methods.filter((m: string) => FUND.includes(m)) : []
  if (!methods.length) return NextResponse.json({ error: 'Pick at least one fundraising method.' }, { status: 400 })

  // Per-student: write the method(s) on the (primary) enrollment.
  await db.from('enrollment').update({ fundraising_methods: methods }).eq('id', enrList[0].id)

  // Family-level union for admin views.
  const { data: allEnr } = await db.from('enrollment').select('fundraising_methods').eq('family_id', familyId).eq('season', SEASON)
  const union = [...new Set((allEnr ?? []).flatMap((e: any) => (e.fundraising_methods ?? []) as string[]))]
  const primary = FUND.find((m) => union.includes(m)) ?? union[0] ?? null
  await db.from('family_season').update({ fundraising_methods: union, fundraising_method: primary }).eq('family_id', familyId).eq('season', SEASON)

  // Employer match lives on the family (parent's employer) — set when matched here.
  if (methods.includes('corporate_match')) {
    await db.from('family').update({
      employer_match_company: String(body.employer_company ?? '').trim() || null,
      employer_match_pct: body.employer_pct ? Number(body.employer_pct) : null,
      employer_match_portal: String(body.employer_portal ?? '').trim() || null,
    }).eq('id', familyId)
  }

  // Sponsorship interest — tied to this student.
  await db.from('family_sponsor_interest').delete().eq('family_id', familyId).eq('season', SEASON).eq('student_id', studentId).eq('source', 'registration_wizard')
  if (methods.includes('sponsored')) {
    await db.from('family_sponsor_interest').insert({
      family_id: familyId,
      student_id: studentId,
      season: SEASON,
      business_name: String(body.sponsor_business ?? '').trim() || null,
      contact_name: String(body.sponsor_contact ?? '').trim() || null,
      estimated_amount: body.sponsor_amount ? Number(body.sponsor_amount) : null,
      status: 'pending',
      source: 'registration_wizard',
    })
  }

  return NextResponse.json({ ok: true })
}
