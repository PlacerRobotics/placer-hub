// Coach dashboard (task 1.2) — data access + pure derivations, tested in
// tests/coach.test.ts.
//
// Scope contract (enforced here, not in the page): every service-role read is
// filtered by team IDs derived from the signed-in guardian's ACTIVE coach
// memberships (revoked_at IS NULL) for the season. No program- or org-wide reads.
//
// Exposure contract: roster rows carry ONLY name, preferred name, grade, and the
// registration / required-agreement completion booleans. Payment amounts,
// fundraising, financial aid, guardian contact info (policy pending — D14),
// emergency contacts, internal notes, and medical data must never be added to
// these shapes. Co-coaches are shown ONLY the four-value clearance view from
// lib/volunteer-buckets.ts (coachClearanceView) — never per-step detail.
//
// Kept free of lib/volunteer.ts (which imports the server Supabase client) so
// tests can drive it with the in-memory mock: season / validThrough / today come
// in as parameters, matching the needsApsRenewal(validThrough) pattern in lib/aps.ts.

import { volunteerBucket, coachClearanceView, type ApsState, type CoachClearance } from './volunteer-buckets'

// Roles that open /coach. Head + assistant coaches run the team; managers/mentors
// don't get their own dashboard (spec 1.2 — coaches exist as team_role 'coach').
export const COACH_ACCESS_ROLES = ['coach', 'assistant_coach'] as const
// Roles shown in the co-coach clearance panel (mentors are youth-facing too).
export const COACH_STAFF_ROLES = ['coach', 'assistant_coach', 'mentor'] as const

export const ROSTER_CHANGE_WINDOW_DAYS = 7

// Registrar-owned wording (spec 1.2): coaches don't resolve registration or
// payment problems, so the alert must read as in-progress, not as a coach to-do.
export const REGISTRAR_FOLLOW_UP = 'Registration incomplete — registrar follow-up in progress'

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ' }

export type CoachRosterStudent = {
  studentId: string
  name: string
  preferredName: string | null
  grade: number | null
  /** enrollment for the team's program + season has been submitted */
  registered: boolean
  /** required agreements (waiver signatures) on file for the season */
  agreementSigned: boolean
}

export type CoachStaff = {
  guardianId: string
  name: string
  role: string
  clearance: CoachClearance
}

export type CoachAlertKind =
  | 'registration_incomplete'
  | 'agreement_missing'
  | 'coach_clearance_expiring'
  | 'assistant_not_cleared'
  | 'roster_changed'

export type CoachAlert = { kind: CoachAlertKind; text: string }

export type CoachTeamView = {
  teamId: string
  teamNumber: string | null
  label: string
  program: string
  programLabel: string
  division: string
  isProvisional: boolean
  roster: CoachRosterStudent[]
  staff: CoachStaff[]
  alerts: CoachAlert[]
}

// Coach-facing team label. Provisional teams (migration 0045) must never surface
// their internal "TBD" name — describe them by program/division instead.
export function coachTeamLabel(t: { team_name?: string | null; team_number?: string | null; program: string; division: string; is_provisional?: boolean }): string {
  if (t.is_provisional) return `${PROGRAM_LABELS[t.program] ?? t.program} ${t.division} — roster being finalized`
  return t.team_name || t.team_number || 'Team'
}

// ── Pure alert derivation ─────────────────────────────────────────────────────

export function deriveTeamAlerts(t: {
  roster: Pick<CoachRosterStudent, 'name' | 'registered' | 'agreementSigned'>[]
  staff: Pick<CoachStaff, 'name' | 'role' | 'clearance'>[]
  recentlyAdded: number
  recentlyRemoved: number
  windowDays?: number
}): CoachAlert[] {
  const alerts: CoachAlert[] = []
  const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(', ')

  const unregistered = t.roster.filter((s) => !s.registered)
  if (unregistered.length) alerts.push({ kind: 'registration_incomplete', text: `${REGISTRAR_FOLLOW_UP}: ${names(unregistered)}` })

  // Agreements are a family action, but only meaningful once registration exists.
  const unsigned = t.roster.filter((s) => s.registered && !s.agreementSigned)
  if (unsigned.length) alerts.push({ kind: 'agreement_missing', text: `Required agreement not yet signed: ${names(unsigned)}` })

  const expiring = t.staff.filter((c) => c.clearance === 'Expiring soon')
  if (expiring.length) alerts.push({ kind: 'coach_clearance_expiring', text: `Coach clearance expiring soon — renew APS training: ${names(expiring)}` })

  const uncleared = t.staff.filter((c) => c.role !== 'coach' && (c.clearance === 'Not cleared' || c.clearance === 'Restricted'))
  if (uncleared.length) alerts.push({ kind: 'assistant_not_cleared', text: `Assistant coach not cleared: ${names(uncleared)}` })

  if (t.recentlyAdded || t.recentlyRemoved) {
    const days = t.windowDays ?? ROSTER_CHANGE_WINDOW_DAYS
    const parts = [t.recentlyAdded ? `${t.recentlyAdded} added` : null, t.recentlyRemoved ? `${t.recentlyRemoved} removed` : null].filter(Boolean)
    alerts.push({ kind: 'roster_changed', text: `Roster changed in the last ${days} days: ${parts.join(', ')}` })
  }

  return alerts
}

// APS validity bucketing shared with the family dashboard: valid through season
// end, expiring when still-current-but-short, expired otherwise.
export function apsStateFor(expiry: string | null, validThrough: string, today: string): ApsState {
  if (!expiry) return 'none'
  return expiry >= validThrough ? 'valid' : expiry >= today ? 'expiring' : 'expired'
}

// ── Data access (service-role client, coach-scoped) ──────────────────────────

export async function getCoachTeams(
  db: any,
  opts: {
    guardianId: string
    season: string
    /** season-end APS validity bound (lib/volunteer APS_VALID_THROUGH) */
    validThrough: string
    /** ISO date (yyyy-mm-dd); injectable for tests */
    today?: string
    windowDays?: number
  },
): Promise<CoachTeamView[] | null> {
  const { guardianId, season, validThrough } = opts
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const windowDays = opts.windowDays ?? ROSTER_CHANGE_WINDOW_DAYS
  const cutoff = new Date(new Date(today + 'T00:00:00Z').getTime() - windowDays * 86400_000).toISOString()

  // 1. Access = active coach membership for this guardian + season. Everything
  //    below is filtered by the team IDs derived here.
  const { data: myRows } = await db
    .from('team_member')
    .select('team_id, team_role, revoked_at')
    .eq('guardian_id', guardianId)
    .eq('season', season)
    .in('team_role', [...COACH_ACCESS_ROLES])
    .is('revoked_at', null)
  const teamIds = [...new Set((myRows ?? []).map((r: any) => r.team_id).filter(Boolean))]
  if (!teamIds.length) return null

  // 2. The teams themselves — display fields only; inactive teams are hidden.
  const { data: teamRows } = await db
    .from('team')
    .select('id, team_name, team_number, program, division, active, is_provisional')
    .in('id', teamIds)
  const teams = (teamRows ?? []).filter((t: any) => t.active !== false)
  if (!teams.length) return null

  // 3. All memberships on those teams (one scoped query; partitioned in JS).
  const { data: memberRows } = await db
    .from('team_member')
    .select('team_id, student_id, guardian_id, team_role, revoked_at, created_at')
    .in('team_id', teams.map((t: any) => t.id))
    .eq('season', season)
  const members = memberRows ?? []
  const activeStudents = members.filter((m: any) => m.team_role === 'student' && !m.revoked_at && m.student_id)
  const removedStudents = members.filter((m: any) => m.team_role === 'student' && m.revoked_at && m.student_id)
  const activeStaff = members.filter((m: any) => (COACH_STAFF_ROLES as readonly string[]).includes(m.team_role) && !m.revoked_at && m.guardian_id)

  // 4. Roster facts — restricted student fields + completion signals only.
  const studentIds = [...new Set(activeStudents.map((m: any) => m.student_id))]
  const [{ data: students }, { data: enrollments }, { data: sigs }] = studentIds.length
    ? await Promise.all([
        db.from('student').select('id, first_name, last_name, preferred_name, grade').in('id', studentIds),
        db.from('enrollment').select('student_id, program, submitted_at').eq('season', season).in('student_id', studentIds),
        db.from('waiver_signature').select('student_id').eq('season', season).in('student_id', studentIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const studentById: Record<string, any> = Object.fromEntries((students ?? []).map((s: any) => [s.id, s]))
  const signed = new Set((sigs ?? []).map((s: any) => s.student_id))
  const submittedByStudentProgram = new Set(
    (enrollments ?? []).filter((e: any) => e.submitted_at).map((e: any) => `${e.student_id}:${e.program}`),
  )

  // 5. Staff clearance — four-value view only, derived the same way the family
  //    dashboard derives the guardian's own volunteer bucket.
  const staffGuardianIds = [...new Set(activeStaff.map((m: any) => m.guardian_id))]
  const { data: staffGuardians } = staffGuardianIds.length
    ? await db.from('guardian').select('id, first_name, last_name').in('id', staffGuardianIds)
    : { data: [] }
  const { data: profiles } = staffGuardianIds.length
    ? await db.from('volunteer_profile').select('id, guardian_id, status').in('guardian_id', staffGuardianIds)
    : { data: [] }
  const profileByGuardian: Record<string, any> = Object.fromEntries((profiles ?? []).map((p: any) => [p.guardian_id, p]))
  const volunteerIds = (profiles ?? []).map((p: any) => p.id)
  const [{ data: clearances }, { data: certs }, { data: bgSteps }] = volunteerIds.length
    ? await Promise.all([
        db.from('volunteer_clearance').select('volunteer_id, waiver_signed_date, rc_quiz_passed, yp_quiz_passed').eq('season', season).in('volunteer_id', volunteerIds),
        db.from('youth_protection_cert').select('volunteer_id, expiration_date').in('volunteer_id', volunteerIds),
        db.from('volunteer_step').select('volunteer_id, status').eq('step', 'background_check').in('volunteer_id', volunteerIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const clearanceByVol: Record<string, any> = Object.fromEntries((clearances ?? []).map((c: any) => [c.volunteer_id, c]))
  // Latest cert per volunteer computed here (not via order/limit) so the derivation
  // is deterministic regardless of row order.
  const latestCertByVol: Record<string, string> = {}
  for (const c of certs ?? []) {
    if (!latestCertByVol[c.volunteer_id] || c.expiration_date > latestCertByVol[c.volunteer_id]) latestCertByVol[c.volunteer_id] = c.expiration_date
  }
  const bgByVol: Record<string, string> = Object.fromEntries((bgSteps ?? []).map((s: any) => [s.volunteer_id, s.status]))

  const guardianName: Record<string, string> = Object.fromEntries(
    (staffGuardians ?? []).map((g: any) => [g.id, `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || 'Coach']),
  )

  function staffClearance(gid: string): CoachClearance {
    const vp = profileByGuardian[gid]
    if (!vp) return coachClearanceView('in_progress', 'none') // never applied → Not cleared
    const vc = clearanceByVol[vp.id]
    const apsState = apsStateFor(latestCertByVol[vp.id] ?? null, validThrough, today)
    const bucket = volunteerBucket({
      profileStatus: vp.status,
      doj: bgByVol[vp.id] === 'complete',
      apsState,
      rc: !!vc?.rc_quiz_passed,
      yp: !!vc?.yp_quiz_passed,
      waiver: !!vc?.waiver_signed_date,
    })
    return coachClearanceView(bucket, apsState)
  }

  // 6. Assemble per team.
  return teams.map((t: any) => {
    const roster: CoachRosterStudent[] = activeStudents
      .filter((m: any) => m.team_id === t.id)
      .map((m: any) => {
        const s = studentById[m.student_id]
        if (!s) return null
        return {
          studentId: s.id,
          name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
          preferredName: s.preferred_name ?? null,
          grade: s.grade ?? null,
          registered: submittedByStudentProgram.has(`${s.id}:${t.program}`),
          agreementSigned: signed.has(s.id),
        }
      })
      .filter(Boolean) as CoachRosterStudent[]
    roster.sort((a, b) => a.name.localeCompare(b.name))

    const staff: CoachStaff[] = activeStaff
      .filter((m: any) => m.team_id === t.id)
      .map((m: any) => ({
        guardianId: m.guardian_id,
        name: guardianName[m.guardian_id] ?? 'Coach',
        role: m.team_role,
        clearance: staffClearance(m.guardian_id),
      }))

    const recentlyAdded = activeStudents.filter((m: any) => m.team_id === t.id && m.created_at && m.created_at >= cutoff).length
    const recentlyRemoved = removedStudents.filter((m: any) => m.team_id === t.id && m.revoked_at >= cutoff).length

    return {
      teamId: t.id,
      teamNumber: t.team_number ?? null,
      label: coachTeamLabel(t),
      program: t.program,
      programLabel: PROGRAM_LABELS[t.program] ?? t.program,
      division: t.division,
      isProvisional: !!t.is_provisional,
      roster,
      staff,
      alerts: deriveTeamAlerts({ roster, staff, recentlyAdded, recentlyRemoved, windowDays }),
    }
  })
}
