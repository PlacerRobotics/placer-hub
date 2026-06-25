import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, registrationConfirmationHtml } from '@/lib/email'
import { ageFromDob, isUnder13, needsCoppa as computeNeedsCoppa } from '@/lib/compliance'

const SEASON = '2026-27'
const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  vex_iq: 'VEX IQ',
  not_sure: 'Not sure',
  both: 'VEX V5 & Combat',
}

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
  if (!fs || (fs.status !== 'cleared_to_register' && fs.status !== 'registered')) {
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

  // Consent / COPPA enforcement (server-side). Parental consent is required for
  // grade 6/7 or under-13 students; Slack consent is blocked entirely under 13.
  const studentAge = ageFromDob(s.birthdate ?? '')
  const under13 = isUnder13(studentAge)
  const needsCoppa = computeNeedsCoppa(grade, studentAge)
  if (needsCoppa && body.coppaConsent !== true) {
    return NextResponse.json({ error: 'Parental (COPPA) consent is required for students in grade 6 or 7, or under age 13.' }, { status: 400 })
  }
  const emailCertified = body.emailCertified === true
  const slackConsent = under13 ? false : body.slackConsent === true

  // FR-IQ-007: IQ students may not register until their coach's team is 'active'.
  if (program === 'vex_iq') {
    const { data: appn } = await db.from('student_application').select('triage_notes').eq('student_id', studentId).eq('season', SEASON).maybeSingle()
    const tm = (appn?.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)
    if (tm) {
      const { data: t } = await db.from('team').select('status').eq('id', tm[1]).maybeSingle()
      if (!t || t.status !== 'active') {
        return NextResponse.json({ error: 'IQ team registration is not yet open. Your coach’s team is pending payment or admin approval. You will receive an email when registration opens.' }, { status: 400 })
      }
    }
  }

  // 5. Update the student record with the registration details.
  const { error: stuErr } = await db
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
      communication_email: s.communication_email || null,
      under_13_confirmed: under13,
      status: 'active',
    })
    .eq('id', studentId)
  if (stuErr) return NextResponse.json({ error: `Could not save student details: ${stuErr.message}` }, { status: 500 })

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
  // Registration fee is ALWAYS 'unpaid' at registration. Financial aid adjusts the
  // fundraising target only — it must never drive registration_fee_status. Waiving a
  // fee is a Super-Admin action with a mandatory audit entry, not an automatic effect
  // of an approved aid record.
  const feeStatus = 'unpaid'
  const fundraisingTarget =
    aid && aid.adjusted_fundraising_target != null ? aid.adjusted_fundraising_target : target

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const paymentRef: string = body.paymentReferenceCode

  // 7. Create/update enrollment(s). A 'both' application enrolls the student in
  // BOTH vex_v5 and combat — enrollment is one row per program (unique on
  // student_id, season, program). The registration fee and fundraising target are
  // applied ONCE (to the primary/V5 enrollment); the second program carries $0 so
  // the family is not charged twice for a single registration/payment. Each
  // enrollment needs its own unique payment_reference_code, so the second derives
  // one from the first. Waivers attach to the primary enrollment.
  const enrollPrograms = program === 'both' ? ['vex_v5', 'combat'] : [program]
  let enrollmentId = ''
  for (let i = 0; i < enrollPrograms.length; i++) {
    const p = enrollPrograms[i]
    const primary = i === 0
    const { data: enr, error: enrErr } = await db
      .from('enrollment')
      .upsert(
        {
          family_id: familyId,
          student_id: studentId,
          season: SEASON,
          program: p,
          division,
          payment_reference_code: primary ? paymentRef : `${paymentRef}-${p}`,
          registration_fee_amount: primary ? fee : 0,
          registration_fee_status: feeStatus,
          fundraising_target: primary ? fundraisingTarget : 0,
          waiver_status: 'complete',
          parent_email_access_certified: emailCertified,
          student_communication_consent: emailCertified,
          student_slack_consent: slackConsent,
          coppa_consent_checked: body.coppaConsent === true,
          submitted_at: new Date().toISOString(),
          submission_ip: ip,
        },
        { onConflict: 'student_id,season,program' }
      )
      .select('id')
      .single()
    if (enrErr) return NextResponse.json({ error: enrErr.message }, { status: 500 })
    if (primary) enrollmentId = enr.id
  }

  // 7b. Auto-link the student to their team if the application carries a team pointer
  // in triage_notes — "iq_team:<id>" (IQ, set by the coach flow) or "team:<id>"
  // (V5/Combat, set by the returning-registration import). Places them on the team
  // matching that team's program. Best-effort; admin can reassign via the team tools.
  try {
    const { data: appn } = await db.from('student_application').select('triage_notes').eq('student_id', studentId).eq('season', SEASON).maybeSingle()
    const m = (appn?.triage_notes ?? '').match(/(?:iq_team|team):([0-9a-f-]{36})/i)
    if (m) {
      const teamId = m[1]
      const { data: t } = await db.from('team').select('id, program').eq('id', teamId).maybeSingle()
      if (t) {
        // Link the enrollment whose program matches the team (falls back to primary).
        const { data: enrForTeam } = await db.from('enrollment').select('id').eq('student_id', studentId).eq('season', SEASON).eq('program', t.program).maybeSingle()
        const enrId = enrForTeam?.id ?? enrollmentId
        if (enrId) {
          const { data: existingTm } = await db.from('team_member').select('id').eq('enrollment_id', enrId).eq('team_id', teamId).eq('team_role', 'student').is('revoked_at', null).maybeSingle()
          if (!existingTm) await db.from('team_member').insert({ team_id: teamId, enrollment_id: enrId, student_id: studentId, season: SEASON, team_role: 'student', program: t.program })
        }
      }
    }
  } catch (e) { console.error('[register] team auto-link failed:', e) }

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
  if (contacts.length) {
    const { error: ecErr } = await db.from('emergency_contact').insert(contacts)
    if (ecErr) return NextResponse.json({ error: `Could not save emergency contacts: ${ecErr.message}` }, { status: 500 })
  }

  // 9. Waiver signatures — one per active waiver (append-only).
  const { data: waivers } = await db
    .from('waiver_template')
    .select('id, waiver_type, version, body_hash')
    .eq('active', true)
  const typedName: string = body.signatureName ?? ''
  const participantName: string = body.studentSignatureName ?? ''
  // Append-only AND sign-once: if this student already has signatures this season
  // (a resume), keep the originals — never duplicate or overwrite them.
  const { data: priorSigs } = await db.from('waiver_signature').select('id').eq('student_id', studentId).eq('season', SEASON).limit(1)
  if (waivers?.length && !priorSigs?.length) {
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
      participant_typed_name: participantName || null,
      electronic_consent_checked: body.electronicConsent === true,
      read_and_agree_checked: true,
      authenticated_email: user.email,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? null,
    }))
    const { error: sigErr } = await db.from('waiver_signature').insert(sigs)
    if (sigErr) return NextResponse.json({ error: `Could not record waivers: ${sigErr.message}` }, { status: 500 })
  }

  // 10. Mark the family registered for this season so the dashboard and admin
  // reflect completion. The gate above also accepts 'registered', so additional
  // students / edits can re-enter the wizard.
  const { error: fsErr } = await db
    .from('family_season')
    .update({ status: 'registered', updated_at: new Date().toISOString() })
    .eq('family_id', familyId)
    .eq('season', SEASON)
  if (fsErr) return NextResponse.json({ error: `Could not finalize registration: ${fsErr.message}` }, { status: 500 })

  // 10b. Fundraising selection (Payment & Fundraising wizard step; non-IQ — IQ is
  // team-managed and sends fundraising = null). Best-effort: registration is already
  // committed above, so a write hiccup here must not roll it back.
  try {
    // Multi-select: families can pick more than one method (e.g. donate AND sponsor).
    const FUND_METHODS = ['direct_donation', 'corporate_match', 'sponsored', 'paper_check', 'pending']
    const fr = body.fundraising
    const methods: string[] = Array.isArray(fr?.methods) ? fr.methods.filter((m: string) => FUND_METHODS.includes(m)) : []
    if (methods.length && enrollmentId) {
      // Per-student: store the method(s) on this student's (primary) enrollment.
      await db.from('enrollment').update({ fundraising_methods: methods }).eq('id', enrollmentId)

      // Family-level union (for admin badges/filters that read family_season).
      const { data: allEnr } = await db.from('enrollment').select('fundraising_methods').eq('family_id', familyId).eq('season', SEASON)
      const union = [...new Set((allEnr ?? []).flatMap((e: any) => (e.fundraising_methods ?? []) as string[]))]
      const primary = FUND_METHODS.find((m) => union.includes(m)) ?? union[0] ?? null
      await db.from('family_season').update({ fundraising_methods: union, fundraising_method: primary }).eq('family_id', familyId).eq('season', SEASON)

      // Employer-match details live on the family record (the parent's employer). Set
      // when corporate_match is selected for this student; left as-is otherwise so a
      // sibling's match isn't wiped.
      if (methods.includes('corporate_match')) {
        await db.from('family').update({
          employer_match_company: fr.employer_company ?? null,
          employer_match_pct: fr.employer_pct ?? null,
          employer_match_portal: fr.employer_portal ?? null,
        }).eq('id', familyId)
      }

      // Business-sponsorship interest → family_sponsor_interest, tied to THIS student.
      await db.from('family_sponsor_interest').delete().eq('family_id', familyId).eq('season', SEASON).eq('student_id', studentId).eq('source', 'registration_wizard')
      if (methods.includes('sponsored')) {
        await db.from('family_sponsor_interest').insert({
          family_id: familyId,
          student_id: studentId,
          season: SEASON,
          business_name: fr.sponsor_business ?? null,
          contact_name: fr.sponsor_contact ?? null,
          estimated_amount: fr.sponsor_amount ?? null,
          status: 'pending',
          source: 'registration_wizard',
        })
      }
    }
  } catch (e) {
    console.error('[register] fundraising save failed:', e)
  }

  // 11. Confirmation email to both guardians + the student. Best-effort — never
  // fail the registration if email isn't configured or the send errors.
  try {
    const { data: gs } = await db.from('guardian').select('first_name, last_name, login_email, communication_email').eq('family_id', familyId)
    const { data: stu } = await db
      .from('student')
      .select('first_name, last_name, communication_email')
      .eq('id', studentId)
      .maybeSingle()
    const recipients = [
      ...((gs ?? []) as any[]).flatMap((g) => [g.login_email, g.communication_email]),
      stu?.communication_email,
    ].filter(Boolean) as string[]
    const studentName = stu ? `${stu.first_name} ${stu.last_name}`.trim() : 'your student'
    const guardianNames = [...new Set(((gs ?? []) as any[]).map((g) => `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim()).filter(Boolean))].join(', ')
    // The student's assigned team number for this season, if any (across this registration's enrollments).
    const { data: tms } = await db.from('team_member').select('team:team_id ( team_number )').eq('student_id', studentId).eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null)
    const teamNumber = ((tms ?? []) as any[]).map((t) => (Array.isArray(t.team) ? t.team[0] : t.team)?.team_number).filter(Boolean).join(', ') || null
    const subject = `Registration received — ${studentName} (Placer Robotics ${SEASON})`
    const html = registrationConfirmationHtml({
      studentName,
      programLabel: PROGRAM_LABELS[program] ?? program,
      paymentRef,
      zeffyUrl: config?.zeffy_student_url ?? null,
      season: SEASON,
      guardianNames,
      teamNumber,
    })
    const sent = await sendEmail({ to: recipients, subject, html })
    const status = sent.ok ? 'sent' : sent.error === 'no_api_key' ? 'skipped' : 'failed'
    for (const r of [...new Set(recipients.map((e) => e.toLowerCase()))]) {
      await db.from('notification_log').insert({
        family_id: familyId,
        recipient_email: r,
        notification_type: 'registration_confirmation',
        subject,
        provider: 'resend',
        status,
        error_message: sent.ok ? null : sent.error ?? null,
        sent_at: sent.ok ? new Date().toISOString() : null,
      })
    }
  } catch (e) {
    console.error('[register] confirmation email failed:', e)
  }

  return NextResponse.json({ ok: true, paymentReferenceCode: paymentRef })
}
