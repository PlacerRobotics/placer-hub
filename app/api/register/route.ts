import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

/**
 * Registration submission.
 * Reads the session to authorize the user, verifies the student belongs to the
 * user's family and the family is cleared_to_register, then writes everything
 * with the service-role admin client (bypasses RLS).
 */
export async function POST(request: NextRequest) {
  // 1. Authorize via the session.
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const db = createAdminClient()

  // 2. Resolve the family + guardian from the user email.
  const { data: guardian } = await db
    .from('guardian')
    .select('id, family_id')
    .ilike('login_email', user.email)
    .maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family found for this account.' }, { status: 403 })
  const familyId: string = guardian.family_id

  // 3. Verify cleared_to_register.
  const { data: fs } = await db
    .from('family_season')
    .select('status')
    .eq('family_id', familyId)
    .eq('season', SEASON)
    .maybeSingle()
  if (!fs || fs.status !== 'cleared_to_register') {
    return NextResponse.json({ error: 'Your family is not cleared to register.' }, { status: 403 })
  }

  // 4. Verify the student belongs to this family.
  const studentId: string = body.studentId
  const { data: student } = await db
    .from('student')
    .select('id, family_id')
    .eq('id', studentId)
    .maybeSingle()
  if (!student || student.family_id !== familyId) {
    return NextResponse.json({ error: 'Student not found for this family.' }, { status: 403 })
  }

  const s = body.student ?? {}
  const grade = Number(s.grade)
  const division = grade <= 5 ? 'ES' : grade <= 8 ? 'MS' : 'HS'
  const program: string = body.program ?? 'vex_v5'

  // 5. Update the student record with the registration details.
  await db
    .from('student')
    .update({
      first_name: s.first_name,
      last_name: s.last_name,
      preferred_name: s.preferred_name || null,
      birthdate: s.birthdate || null,
      grade,
      school_id: s.school_id || null,
      school_raw: s.school_raw || null,
      tshirt_size: s.tshirt_size || null,
      fusion_education_email: s.fusion_education_email || null,
      status: 'active',
    })
    .eq('id', studentId)

  // 6. Compute fees from season_config.
  const { data: config } = await db.from('season_config').select('*').eq('season', SEASON).maybeSingle()
  const isIq = program === 'vex_iq'
  const fee = isIq ? config?.iq_student_registration_fee ?? 0 : config?.v5_combat_registration_fee ?? 40
  const target = isIq
    ? config?.iq_default_fundraising_target ?? 0
    : config?.one_program_fundraising_target ?? 550

  // Honor an approved financial-aid resolution (waiver / adjusted target).
  const { data: aid } = await db
    .from('financial_aid')
    .select('registration_fee_waived, adjusted_fundraising_target')
    .eq('family_id', familyId)
    .eq('season', SEASON)
    .eq('status', 'approved')
    .order('resolved_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const feeStatus = aid?.registration_fee_waived ? 'waived' : 'unpaid'
  const fundraisingTarget =
    aid && aid.adjusted_fundraising_target != null ? aid.adjusted_fundraising_target : target

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const paymentRef: string = body.paymentReferenceCode

  // 7. Create/update the enrollment.
  const { data: enr, error: enrErr } = await db
    .from('enrollment')
    .upsert(
      {
        family_id: familyId,
        student_id: studentId,
        season: SEASON,
        program,
        division,
        payment_reference_code: paymentRef,
        registration_fee_amount: fee,
        registration_fee_status: feeStatus,
        fundraising_target: fundraisingTarget,
        waiver_status: 'complete',
        submitted_at: new Date().toISOString(),
        submission_ip: ip,
      },
      { onConflict: 'student_id,season,program' }
    )
    .select('id')
    .single()
  if (enrErr) return NextResponse.json({ error: enrErr.message }, { status: 500 })
  const enrollmentId = enr.id

  // 8. Emergency contacts — replace any existing for this student.
  await db.from('emergency_contact').delete().eq('student_id', studentId)
  const contacts: Record<string, unknown>[] = []
  const ec = body.emergency ?? {}
  if (ec.first_name && ec.last_name && ec.phone) {
    contacts.push({
      family_id: familyId,
      student_id: studentId,
      first_name: ec.first_name,
      last_name: ec.last_name,
      relationship: ec.relationship || null,
      phone: ec.phone,
      priority: 1,
    })
  }
  if (ec.second_first_name && ec.second_last_name && ec.second_phone) {
    contacts.push({
      family_id: familyId,
      student_id: studentId,
      first_name: ec.second_first_name,
      last_name: ec.second_last_name,
      relationship: ec.second_relationship || null,
      phone: ec.second_phone,
      priority: 2,
    })
  }
  if (contacts.length) await db.from('emergency_contact').insert(contacts)

  // 9. Waiver signatures — one per active waiver (append-only).
  const { data: waivers } = await db
    .from('waiver_template')
    .select('id, waiver_type, version, body_hash')
    .eq('active', true)
  const typedName: string = body.signatureName ?? ''
  if (waivers?.length) {
    const sigs = waivers.map((w: any) => ({
      waiver_template_id: w.id,
      family_id: familyId,
      guardian_id: guardian.id,
      student_id: studentId,
      enrollment_id: enrollmentId,
      season: SEASON,
      waiver_type: w.waiver_type,
      waiver_version: w.version,
      body_hash: w.body_hash,
      typed_name: typedName,
      electronic_consent_checked: true,
      read_and_agree_checked: true,
      authenticated_email: user.email,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? null,
    }))
    await db.from('waiver_signature').insert(sigs)
  }

  // 10. Confirmation email — stubbed for now.
  console.log(
    `[register] Confirmation email (stub) → ${user.email}: registration received for student ${studentId}, reference ${paymentRef}`
  )

  return NextResponse.json({ ok: true, paymentReferenceCode: paymentRef })
}
