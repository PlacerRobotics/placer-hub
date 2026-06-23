import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createSupa } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

// POST /api/iq/team — a signed-in coach creates an IQ team. Creates/uses the
// coach's guardian+family, the team (program=vex_iq), the coach team_member, and
// for each roster member: family/guardian(parent)/student + family_season
// (cleared_to_register) + student_application (program_interest=vex_iq, with
// triage_notes "iq_team:<id>" so registration auto-links them to the team), then
// emails each parent a magic link. The assistant coach is recorded in team.notes.
export async function POST(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  const coachEmail = user.email.toLowerCase()

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const coach = body.coach ?? {}
  if (!String(coach.first_name ?? '').trim() || !String(coach.last_name ?? '').trim()) {
    return NextResponse.json({ error: 'Coach first and last name are required.' }, { status: 400 })
  }
  if (!body.fee_ack) return NextResponse.json({ error: 'You must agree to collect the program fee.' }, { status: 400 })
  const division = body.division === 'MS' ? 'MS' : 'ES'

  const db = createAdminClient()

  // 1. Coach guardian + family (create if this is a new coach).
  let guardian = (await db.from('guardian').select('id, family_id').ilike('login_email', coachEmail).maybeSingle()).data
  if (guardian) {
    await db.from('guardian').update({ first_name: String(coach.first_name).trim(), last_name: String(coach.last_name).trim(), phone: String(coach.phone ?? '').trim() || undefined }).eq('id', guardian.id)
  } else {
    const { data: fam, error: famErr } = await db.from('family').insert({ primary_email: coachEmail, display_name: String(coach.last_name).trim() }).select('id').single()
    if (famErr) return NextResponse.json({ error: `Could not create coach family: ${famErr.message}` }, { status: 500 })
    const { data: g, error: gErr } = await db.from('guardian').insert({ family_id: fam.id, first_name: String(coach.first_name).trim(), last_name: String(coach.last_name).trim(), login_email: coachEmail, phone: String(coach.phone ?? '').trim() || '', role: 'primary' }).select('id, family_id').single()
    if (gErr) return NextResponse.json({ error: `Could not create coach: ${gErr.message}` }, { status: 500 })
    guardian = g
  }

  // 2. Team.
  const { data: config } = await db.from('season_config').select('iq_team_fee').eq('season', SEASON).maybeSingle()
  const fee = config?.iq_team_fee ?? 1200
  const asst = body.assistant ?? {}
  const asstLine = asst.first_name ? `Assistant: ${asst.first_name} ${asst.last_name ?? ''} ${asst.email ?? ''} ${asst.phone ?? ''}`.trim() : 'Assistant: none'
  const notes = [
    `IQ team application (${new Date().toISOString().slice(0, 10)}).`,
    `Division: ${division}. Competes outside Placer League: ${body.competes_outside ?? 'unsure'}.`,
    `Returning team #: ${String(body.returning_number ?? '').trim() || '(new — assign)'}.`,
    asstLine,
    `Coach acknowledged collecting the $${fee} IQ program fee + reviewing league policies.`,
  ].join('\n')

  const { data: team, error: tErr } = await db.from('team').insert({
    season: SEASON,
    program: 'vex_iq',
    division,
    team_number: String(body.returning_number ?? '').trim() || null,
    team_name: String(body.team_name ?? '').trim() || null,
    school_org: String(body.school_org ?? '').trim() || 'Placer Robotics',
    team_fee_amount: fee,
    team_fee_status: 'unpaid',
    active: true,
    notes,
  }).select('id').single()
  if (tErr) return NextResponse.json({ error: `Could not create team: ${tErr.message}` }, { status: 500 })
  const teamId = team.id

  // 3. Coach team_member.
  await db.from('team_member').insert({ team_id: teamId, guardian_id: guardian.id, season: SEASON, team_role: 'coach', program: 'vex_iq' })

  // 4. Roster members → stubs + invites.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const sender = createSupa(url, anon)
  const invited = new Set<string>()
  const results: { student: string; parentEmail: string; status: string }[] = []

  for (const r of (Array.isArray(body.roster) ? body.roster : [])) {
    const sFirst = String(r.student_first ?? '').trim()
    const sLast = String(r.student_last ?? '').trim()
    const pEmail = String(r.parent_email ?? '').trim().toLowerCase()
    const pFirst = String(r.parent_first ?? '').trim()
    const pLast = String(r.parent_last ?? '').trim() || sLast
    if (!sFirst || !sLast || !pEmail) { results.push({ student: `${sFirst} ${sLast}`.trim(), parentEmail: pEmail, status: 'skipped (missing name or parent email)' }); continue }

    // Family by parent email.
    let pg = (await db.from('guardian').select('id, family_id').ilike('login_email', pEmail).maybeSingle()).data
    let familyId: string
    if (pg) familyId = pg.family_id
    else {
      const { data: fam, error: fe } = await db.from('family').insert({ primary_email: pEmail, display_name: pLast }).select('id').single()
      if (fe) { results.push({ student: `${sFirst} ${sLast}`, parentEmail: pEmail, status: `error: ${fe.message}` }); continue }
      familyId = fam.id
      await db.from('guardian').insert({ family_id: familyId, first_name: pFirst || pLast, last_name: pLast, login_email: pEmail, phone: '', role: 'primary' })
    }

    // Student (placeholder city/zip/grade — parent completes at registration).
    let stu = (await db.from('student').select('id').eq('family_id', familyId).ilike('first_name', sFirst).ilike('last_name', sLast).maybeSingle()).data
    if (!stu) {
      const { data: s, error: se } = await db.from('student').insert({ family_id: familyId, first_name: sFirst, last_name: sLast, city: 'Unknown', zip_code: '00000', grade: 0, status: 'active' }).select('id').single()
      if (se) { results.push({ student: `${sFirst} ${sLast}`, parentEmail: pEmail, status: `error: ${se.message}` }); continue }
      stu = s
    }

    // family_season cleared + application (IQ) with team link in triage_notes.
    await db.from('family_season').upsert({ family_id: familyId, season: SEASON, status: 'cleared_to_register' }, { onConflict: 'family_id,season' })
    await db.from('student_application').upsert(
      { family_id: familyId, student_id: stu.id, season: SEASON, program_interest: 'vex_iq', status: 'accepted', source: 'admin_import', triage_notes: `iq_team:${teamId}` },
      { onConflict: 'student_id,season' }
    )

    // Invite the parent (one per unique email).
    if (!invited.has(pEmail)) {
      const { error: oe } = await sender.auth.signInWithOtp({ email: pEmail, options: { emailRedirectTo: `${site}/api/auth/callback?redirectTo=/register` } })
      if (!oe) { invited.add(pEmail); await db.from('family_season').update({ magic_link_sent: true }).eq('family_id', familyId).eq('season', SEASON) }
    }
    results.push({ student: `${sFirst} ${sLast}`, parentEmail: pEmail, status: 'invited' })
  }

  return NextResponse.json({ ok: true, teamId, invited: invited.size, members: results })
}
