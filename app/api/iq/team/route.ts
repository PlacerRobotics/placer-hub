import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, iqTeamSubmittedHtml } from '@/lib/email'

const SEASON = '2026-27'

// Ensure a family_season row exists without downgrading an already-advanced one.
async function ensureFamilySeason(db: any, familyId: string, statusIfNew: string) {
  const { data } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (!data) await db.from('family_season').insert({ family_id: familyId, season: SEASON, status: statusIfNew })
}

// Create an IQ member stub (student + application linked to the team) under a given
// family. Grade + school are captured up front to help review/approval. No magic
// link here — invites go out only after payment + IQ Coordinator approval.
async function addMemberStub(db: any, familyId: string, sFirst: string, sLast: string, teamId: string, grade?: number, schoolId?: string, school?: string) {
  const gradeVal = grade && grade > 0 ? grade : 0
  const sid = (schoolId ?? '').trim() || null
  const schoolVal = sid ? null : ((school ?? '').trim() || null)
  let stu = (await db.from('student').select('id').eq('family_id', familyId).ilike('first_name', sFirst).ilike('last_name', sLast).maybeSingle()).data
  if (!stu) {
    const { data: s, error } = await db.from('student').insert({ family_id: familyId, first_name: sFirst, last_name: sLast, city: 'Unknown', zip_code: '00000', grade: gradeVal, school_id: sid, school_raw: schoolVal, status: 'active' }).select('id').single()
    if (error) return { error: error.message }
    stu = s
  } else if (gradeVal > 0 || sid || schoolVal) {
    await db.from('student').update({ grade: gradeVal, school_id: sid, school_raw: schoolVal }).eq('id', stu.id)
  }
  await ensureFamilySeason(db, familyId, 'applied')
  await db.from('student_application').upsert(
    { family_id: familyId, student_id: stu.id, season: SEASON, program_interest: 'vex_iq', status: 'accepted', source: 'admin_import', triage_notes: `iq_team:${teamId}` },
    { onConflict: 'student_id,season' }
  )
  return { ok: true }
}

// POST /api/iq/team — a signed-in coach CLAIMS an existing, coach-less IQ team from
// the season's list (coaches don't create new teams). It moves to 'pending_payment';
// once the $1,200 fee is paid it goes to 'pending_admin_confirmation', and the IQ
// Coordinator approves it to 'active'. Member stubs are created now; invites go out
// only after approval.
export async function POST(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Please sign in to your family account first.' }, { status: 401 })
  const coachEmail = user.email.toLowerCase()

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const coach = body.coach ?? {}
  if (!String(coach.first_name ?? '').trim() || !String(coach.last_name ?? '').trim()) return NextResponse.json({ error: 'Coach first and last name are required.' }, { status: 400 })
  if (!body.fee_ack) return NextResponse.json({ error: 'You must agree to collect the program fee.' }, { status: 400 })

  const ownChild = body.own_child ?? {}
  const ownProvided = !!(String(ownChild.first_name ?? '').trim() && String(ownChild.last_name ?? '').trim())
  const coachLast = String(coach.last_name).trim().toLowerCase()
  const others = (Array.isArray(body.roster) ? body.roster : []).filter((r: any) => String(r.student_first ?? '').trim() && String(r.student_last ?? '').trim() && String(r.parent_email ?? '').trim())
  if ((ownProvided ? 1 : 0) + others.length < 3) return NextResponse.json({ error: 'A team needs at least 3 members total.' }, { status: 400 })

  const db = createAdminClient()

  // Claim an EXISTING, coach-less IQ team from the season's list. Coaches never create
  // new teams — the IQ Coordinator manages the team list + numbers (RobotEvents).
  const teamId = String(body.team_id ?? '').trim()
  if (!teamId) return NextResponse.json({ error: 'Please select your team from the list.' }, { status: 400 })
  const { data: selTeam } = await db.from('team').select('id, program, season, team_payment_reference_code, team_name, notes').eq('id', teamId).maybeSingle()
  if (!selTeam || selTeam.program !== 'vex_iq' || selTeam.season !== SEASON) return NextResponse.json({ error: 'That team is not available.' }, { status: 400 })
  const { data: existingCoach } = await db.from('team_member').select('id').eq('team_id', teamId).eq('team_role', 'coach').is('revoked_at', null).limit(1)
  if ((existingCoach ?? []).length) return NextResponse.json({ error: 'That team already has a coach — pick an available team or contact the IQ Coordinator.' }, { status: 409 })

  // 1. Coach guardian + family (create if new).
  let guardian = (await db.from('guardian').select('id, family_id').ilike('login_email', coachEmail).maybeSingle()).data
  let coachFamilyId: string
  if (guardian) {
    coachFamilyId = guardian.family_id
    await db.from('guardian').update({ first_name: String(coach.first_name).trim(), last_name: String(coach.last_name).trim(), phone: String(coach.phone ?? '').trim() || undefined }).eq('id', guardian.id)
  } else {
    const { data: fam, error: famErr } = await db.from('family').insert({ primary_email: coachEmail, display_name: String(coach.last_name).trim() }).select('id').single()
    if (famErr) return NextResponse.json({ error: `Could not create coach family: ${famErr.message}` }, { status: 500 })
    const { data: g, error: gErr } = await db.from('guardian').insert({ family_id: fam.id, first_name: String(coach.first_name).trim(), last_name: String(coach.last_name).trim(), login_email: coachEmail, phone: String(coach.phone ?? '').trim() || '', role: 'primary' }).select('id, family_id').single()
    if (gErr) return NextResponse.json({ error: `Could not create coach: ${gErr.message}` }, { status: 500 })
    guardian = g; coachFamilyId = g.family_id
  }

  // 2. Attach the coach + set fee/status on the selected team (its number stays as the
  // IQ Coordinator assigned it). Moves to pending_payment until the $1,200 fee is paid.
  const { data: config } = await db.from('season_config').select('iq_team_fee, zeffy_iq_team_url').eq('season', SEASON).maybeSingle()
  const fee = config?.iq_team_fee ?? 1200
  const paymentRef = selTeam.team_payment_reference_code || `IQT-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const asst = body.assistant ?? {}
  const asstLine = asst.first_name ? `Assistant: ${asst.first_name} ${asst.last_name ?? ''} ${asst.email ?? ''} ${asst.phone ?? ''}`.trim() : 'Assistant: none'
  const claimNote = [
    `Coach ${String(coach.first_name).trim()} ${String(coach.last_name).trim()} claimed this team (${new Date().toISOString().slice(0, 10)}).`,
    `Competes outside Placer League: ${body.competes_outside ?? 'unsure'}.`,
    asstLine,
    `Coach acknowledged collecting the $${fee} IQ program fee + reviewing league policies.`,
  ].join('\n')
  const notes = selTeam.notes ? `${selTeam.notes}\n${claimNote}` : claimNote
  const { error: tErr } = await db.from('team').update({
    team_name: String(body.team_name ?? '').trim() || selTeam.team_name || null,
    team_fee_amount: fee, team_fee_status: 'unpaid',
    team_payment_reference_code: paymentRef,
    status: 'pending_payment', active: false, notes,
  }).eq('id', teamId)
  if (tErr) return NextResponse.json({ error: `Could not claim team: ${tErr.message}` }, { status: 500 })

  // 3. Coach team_member.
  await db.from('team_member').insert({ team_id: teamId, guardian_id: guardian.id, season: SEASON, team_role: 'coach', program: 'vex_iq' })

  // 4. Coach's own child (if provided) under the coach's family, then each other
  // student under their parent's family (folding to the coach when the parent email
  // matches theirs, or the last name matches with no parent email).
  const results: { student: string; under: string }[] = []
  if (ownProvided) {
    const oc1 = String(ownChild.first_name).trim(), oc2 = String(ownChild.last_name).trim()
    const ocRes = await addMemberStub(db, coachFamilyId, oc1, oc2, teamId, Number(ownChild.grade), ownChild.school_id, ownChild.school)
    results.push({ student: `${oc1} ${oc2}`, under: ocRes.error ? `error: ${ocRes.error}` : 'your family' })
  }
  for (const r of others) {
    const sFirst = String(r.student_first).trim(), sLast = String(r.student_last).trim()
    const pEmail = String(r.parent_email).trim().toLowerCase()
    const pFirst = String(r.parent_first ?? '').trim(), pLast = String(r.parent_last ?? '').trim() || sLast
    const grade = Number(r.grade), schoolId = r.school_id, school = r.school
    const isCoachChild = pEmail === coachEmail || (sLast.toLowerCase() === coachLast && !pEmail)
    if (isCoachChild) {
      const res = await addMemberStub(db, coachFamilyId, sFirst, sLast, teamId, grade, schoolId, school)
      results.push({ student: `${sFirst} ${sLast}`, under: res.error ? `error: ${res.error}` : 'your family' }); continue
    }
    let pg = (await db.from('guardian').select('id, family_id').ilike('login_email', pEmail).maybeSingle()).data
    let familyId: string
    if (pg) familyId = pg.family_id
    else {
      const { data: fam, error: fe } = await db.from('family').insert({ primary_email: pEmail, display_name: pLast }).select('id').single()
      if (fe) { results.push({ student: `${sFirst} ${sLast}`, under: `error: ${fe.message}` }); continue }
      familyId = fam.id
      await db.from('guardian').insert({ family_id: familyId, first_name: pFirst || pLast, last_name: pLast, login_email: pEmail, phone: '', role: 'primary' })
    }
    const res = await addMemberStub(db, familyId, sFirst, sLast, teamId, grade, schoolId, school)
    results.push({ student: `${sFirst} ${sLast}`, under: res.error ? `error: ${res.error}` : pEmail })
  }

  // 5. Email the coach the payment reference + Zeffy link (best-effort).
  try {
    const html = iqTeamSubmittedHtml({ coachName: `${String(coach.first_name).trim()} ${String(coach.last_name).trim()}`.trim(), teamName: String(body.team_name ?? '').trim() || null, season: SEASON, paymentRef, zeffyUrl: config?.zeffy_iq_team_url ?? null, fee })
    await sendEmail({ to: [coachEmail], subject: `IQ team — payment needed (Placer Robotics ${SEASON})`, html })
  } catch (e) { console.error('[iq/team] coach submit email failed:', e) }

  return NextResponse.json({ ok: true, teamId, paymentRef, members: results })
}
