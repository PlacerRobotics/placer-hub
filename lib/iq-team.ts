import { sendMagicLinkEmail } from '@/lib/email'
import { cleanEmail } from '@/lib/email-input'

const SEASON = '2026-27'

// Ensure a family_season row exists without downgrading an already-advanced one.
async function ensureFamilySeason(db: any, familyId: string, statusIfNew: string) {
  const { data } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (!data) await db.from('family_season').insert({ family_id: familyId, season: SEASON, status: statusIfNew })
}

// Create an IQ member stub (student + application linked to the team) under a family.
// The team roster is read from these applications (triage_notes iq_team:<id>), not a
// student team_member — students materialize a team_member only when they register.
export async function addMemberStub(db: any, familyId: string, sFirst: string, sLast: string, teamId: string, grade?: number, schoolId?: string, school?: string) {
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

type RosterInput = { student_first?: string; student_last?: string; grade?: string | number; parent_first?: string; parent_last?: string; parent_email?: string; school_id?: string; school?: string }
type OwnChild = { first_name?: string; last_name?: string; grade?: string | number; school_id?: string; school?: string } | null

// Add one coach's own child + any number of roster members to an existing IQ team.
// The coach's own child (and any roster row whose parent email matches the coach, or
// whose last name matches with no parent email) goes under the coach's family with no
// separate invite. Every other student is created under their parent's family. If the
// team is already active, each new parent family is cleared + emailed a register invite.
export async function addIqMembers(db: any, opts: {
  teamId: string
  teamStatus: string
  coachFamilyId: string
  coachEmail: string
  coachLast: string
  ownChild?: OwnChild
  roster?: RosterInput[]
}): Promise<{ student: string; under: string }[]> {
  const { teamId, teamStatus, coachFamilyId } = opts
  const coachEmail = opts.coachEmail.toLowerCase()
  const coachLast = (opts.coachLast || '').toLowerCase()
  const results: { student: string; under: string }[] = []
  const invited = new Set<string>()

  const oc = opts.ownChild
  if (oc && String(oc.first_name ?? '').trim() && String(oc.last_name ?? '').trim()) {
    const f = String(oc.first_name).trim(), l = String(oc.last_name).trim()
    const r = await addMemberStub(db, coachFamilyId, f, l, teamId, Number(oc.grade), oc.school_id, oc.school)
    results.push({ student: `${f} ${l}`, under: r.error ? `error: ${r.error}` : 'your family' })
  }

  for (const m of opts.roster ?? []) {
    const sFirst = String(m.student_first ?? '').trim(), sLast = String(m.student_last ?? '').trim()
    const pEmail = cleanEmail(m.parent_email)
    if (!sFirst || !sLast || !pEmail) continue
    const pFirst = String(m.parent_first ?? '').trim(), pLast = String(m.parent_last ?? '').trim() || sLast
    const grade = Number(m.grade)
    const isCoachChild = pEmail === coachEmail || (sLast.toLowerCase() === coachLast && !pEmail)
    if (isCoachChild) {
      const r = await addMemberStub(db, coachFamilyId, sFirst, sLast, teamId, grade, m.school_id, m.school)
      results.push({ student: `${sFirst} ${sLast}`, under: r.error ? `error: ${r.error}` : 'your family' })
      continue
    }
    let familyId: string
    const pg = (await db.from('guardian').select('id, family_id').ilike('login_email', pEmail).maybeSingle()).data
    if (pg) familyId = pg.family_id
    else {
      const { data: fam, error: fe } = await db.from('family').insert({ primary_email: pEmail, display_name: pLast }).select('id').single()
      if (fe) { results.push({ student: `${sFirst} ${sLast}`, under: `error: ${fe.message}` }); continue }
      familyId = fam.id
      await db.from('guardian').insert({ family_id: familyId, first_name: pFirst || pLast, last_name: pLast, login_email: pEmail, phone: '', role: 'primary' })
    }
    const r = await addMemberStub(db, familyId, sFirst, sLast, teamId, grade, m.school_id, m.school)
    if (r.error) { results.push({ student: `${sFirst} ${sLast}`, under: `error: ${r.error}` }); continue }
    results.push({ student: `${sFirst} ${sLast}`, under: pEmail })

    if (teamStatus === 'active' && !invited.has(familyId)) {
      invited.add(familyId)
      await db.from('family_season').update({ status: 'cleared_to_register', magic_link_sent: true }).eq('family_id', familyId).eq('season', SEASON)
      try {
        await sendMagicLinkEmail({
          email: pEmail,
          redirectPath: '/register',
          subject: 'You’re invited to register — Placer Robotics 2026-27',
          heading: 'You’re invited to register',
          intro: 'Your student has been added to a VEX IQ team. Click below to sign in and complete their registration for the 2026-27 season.',
          buttonLabel: 'Sign in to register →',
          preheader: 'Sign in to complete your Placer Robotics registration.',
        })
      } catch (e) { console.error('[iq add member] invite failed:', e) }
    }
  }
  return results
}

// Drop a student off an IQ team. Previously two independent, unchecked writes
// (student_application then team_member) — if the team_member update matched zero
// rows (e.g. a stale team_id, or any transient failure) it failed silently, leaving
// triage_notes saying "dropped" while the team_member row stayed active. That
// desync is what let a still-rostered IQ camper's dashboard fall through to the
// normal V5/Combat branch and demand an individual payment IQ never charges.
// Now: look up the actual active team_member row first (so there's no ambiguity
// about which row we're touching), revoke it by id, and only mark the application
// dropped once that succeeds — surfacing an error otherwise instead of swallowing it.
export async function dropIqStudent(db: any, teamId: string, studentId: string, season = SEASON): Promise<{ ok: boolean; error?: string }> {
  const { data: tm, error: tmSelErr } = await db
    .from('team_member')
    .select('id')
    .eq('team_id', teamId)
    .eq('student_id', studentId)
    .eq('team_role', 'student')
    .is('revoked_at', null)
    .maybeSingle()
  if (tmSelErr) return { ok: false, error: tmSelErr.message }

  if (tm) {
    const { error: revokeErr } = await db.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('id', tm.id)
    if (revokeErr) return { ok: false, error: revokeErr.message }
  } else {
    // No active team_member row for this team/student — proceed (idempotent: they
    // may never have registered yet, or were already dropped) but this is worth
    // knowing about if it happens unexpectedly.
    console.warn(`[dropIqStudent] no active team_member row for team ${teamId} / student ${studentId} — dropping application only`)
  }

  const { error: appErr } = await db
    .from('student_application')
    .update({ status: 'withdrawn', triage_notes: `iq_team_dropped:${teamId}` })
    .eq('student_id', studentId)
    .eq('season', season)
  if (appErr) return { ok: false, error: appErr.message }

  return { ok: true }
}
