import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { programScopeFor, programInScope, PROGRAM_SCOPE_LABELS } from '@/lib/auth/roles'
import { AdminShell, PageHeader } from '@/components/ui'
import RosterDownload from './roster-download'
import RegistrationsManager, { type RegRow, type TeamOpt } from './registrations-manager'
import ReminderCampaign from './reminder-campaign'
import { gatherRegistrationReminders } from '@/lib/registration-reminders'
import { NEXT_PUBLIC_SITE_URL } from '@/lib/env'

const SEASON = '2026-27'

export default async function AdminRegistrationsPage() {
  const access = await requireSection('/admin/registrations')
  // Program-scoped leads (D5) see only students/teams in their program; students
  // with no program yet (not_sure / no application) stay registrar-only.
  const scope = programScopeFor(access, '/admin/registrations')
  const supabase = await createClient()

  // Registration-reminder campaign summary — full registrar view only (spans
  // every program, not just a lead's scope).
  const reminderSummary = scope ? null : (await gatherRegistrationReminders(supabase, SEASON, NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''))).summary

  // Family-season lifecycle rows for the season.
  const { data: fseasons } = await supabase
    .from('family_season')
    .select('id, family_id, status, magic_link_sent, updated_at, fundraising_method, fundraising_methods')
    .eq('season', SEASON)
    .in('status', ['cleared_to_register', 'registered', 'cancelled', 'applied', 'suspended'])
  const fsList = (fseasons ?? []) as any[]
  const familyIds = fsList.map((f) => f.family_id)
  const fsByFamily: Record<string, any> = Object.fromEntries(fsList.map((f) => [f.family_id, f]))

  let students: any[] = []
  if (familyIds.length) {
    const { data } = await supabase
      .from('student')
      .select('id, first_name, last_name, grade, family_id, school_raw, school:school_id ( name )')
      .in('family_id', familyIds)
    students = data ?? []
  }
  const studentIds = students.map((s) => s.id)

  const { data: guardians } = familyIds.length
    ? await supabase.from('guardian').select('family_id, login_email, last_login_at, role').in('family_id', familyIds)
    : { data: [] as any[] }
  const gByFamily: Record<string, any> = {}
  for (const g of guardians ?? []) {
    if (!gByFamily[g.family_id] || g.role === 'primary') gByFamily[g.family_id] = g
  }

  const { data: enrollments } = studentIds.length
    ? await supabase.from('enrollment').select('student_id, program, division, registration_fee_status, registration_fee_amount, payment_reference_code').eq('season', SEASON).in('student_id', studentIds)
    : { data: [] as any[] }
  // A student with program 'both' has TWO enrollment rows (vex_v5 + combat), so
  // group by student rather than assuming one row each.
  const enrByStudent: Record<string, { programs: string[]; division: string | null; feeStatuses: string[]; feeAmount: number; refCodes: string[] }> = {}
  for (const e of (enrollments ?? []) as any[]) {
    const cur = enrByStudent[e.student_id] ?? { programs: [], division: null, feeStatuses: [], feeAmount: 0, refCodes: [] }
    if (e.program && !cur.programs.includes(e.program)) cur.programs.push(e.program)
    if (!cur.division && e.division) cur.division = e.division
    if (e.registration_fee_status) cur.feeStatuses.push(e.registration_fee_status)
    cur.feeAmount += Number(e.registration_fee_amount ?? 0)
    if (e.payment_reference_code) cur.refCodes.push(String(e.payment_reference_code).toUpperCase())
    enrByStudent[e.student_id] = cur
  }

  // Matched payments — amounts paid, keyed by enrollment reference code (and a
  // per-family fallback). matched_status has only auto_matched / manually_matched.
  const { data: payments } = familyIds.length
    ? await supabase.from('payment_transaction').select('family_id, amount, matched_status, payment_reference_code').in('family_id', familyIds)
    : { data: [] as any[] }
  const paidByRef: Record<string, number> = {}
  for (const p of (payments ?? []) as any[]) {
    if (p.matched_status !== 'auto_matched' && p.matched_status !== 'manually_matched') continue
    const rc = p.payment_reference_code ? String(p.payment_reference_code).toUpperCase() : null
    if (rc) paidByRef[rc] = (paidByRef[rc] ?? 0) + Number(p.amount ?? 0)
  }

  const { data: tms } = studentIds.length
    ? await supabase.from('team_member').select('student_id, team_id').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('student_id', studentIds)
    : { data: [] as any[] }
  const teamIdByStudent: Record<string, string> = Object.fromEntries((tms ?? []).map((t: any) => [t.student_id, t.team_id]))

  const { data: apps } = studentIds.length
    ? await supabase.from('student_application').select('student_id, program_interest, triage_notes').eq('season', SEASON).in('student_id', studentIds)
    : { data: [] as any[] }
  const progByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.program_interest]))
  // Pending team: assigned at import via a triage_notes pointer (team:/iq_team:<uuid>),
  // materialized into team_member only when the student registers. Show it meanwhile.
  const pendingTeamIdByStudent: Record<string, string> = {}
  for (const a of (apps ?? []) as any[]) {
    const mt = String(a.triage_notes ?? '').match(/(?:iq_team|team):([0-9a-f-]{36})/i)
    if (mt) pendingTeamIdByStudent[a.student_id] = mt[1]
  }

  const teamIds = [...new Set([...Object.values(teamIdByStudent), ...Object.values(pendingTeamIdByStudent)])]
  const { data: teamRows } = teamIds.length
    ? await supabase.from('team').select('id, team_number, team_name').in('id', teamIds)
    : { data: [] as any[] }
  const teamById: Record<string, any> = Object.fromEntries((teamRows ?? []).map((t: any) => [t.id, t]))

  const { data: allTeams } = await supabase
    .from('team')
    .select('id, team_number, team_name, program, division')
    .eq('season', SEASON)
    .order('team_number', { ascending: true })

  const allRows: RegRow[] = students.map((s) => {
    const fs = fsByFamily[s.family_id] ?? {}
    const enr = enrByStudent[s.id]
    const g = gByFamily[s.family_id]
    const materializedTeamId = teamIdByStudent[s.id] ?? null
    const teamId = materializedTeamId ?? pendingTeamIdByStudent[s.id] ?? null
    const team = teamId ? teamById[teamId] : null
    const teamPending = !materializedTeamId && !!pendingTeamIdByStudent[s.id]
    const grade = Number(s.grade ?? 0)
    // Two enrollment programs (vex_v5 + combat) collapse to the 'both' label.
    const program = enr
      ? enr.programs.length > 1 ? 'both' : (enr.programs[0] ?? '—')
      : progByStudent[s.id] ?? '—'
    // VEX IQ is always Elementary regardless of grade.
    const division = program === 'vex_iq' ? 'ES' : enr?.division ?? (grade <= 5 ? 'ES' : grade <= 8 ? 'MS' : 'HS')
    // Payment: VEX IQ campers pay nothing individually (coach pays the team fee) → n/a.
    // Otherwise derive from the enrollment fee status; amount = matched payments.
    let payment: RegRow['payment']
    if (program === 'vex_iq') {
      payment = { state: 'na', amount: null }
    } else if (!enr || !enr.feeStatuses.length) {
      payment = { state: 'unpaid', amount: null }
    } else {
      const ss = enr.feeStatuses
      const state = ss.every((x) => x === 'paid') ? 'paid'
        : ss.every((x) => x === 'waived') ? 'waived'
        : ss.includes('paid') ? 'partial'
        : 'unpaid'
      const amount = enr.refCodes.reduce((sum, rc) => sum + (paidByRef[rc] ?? 0), 0)
      payment = { state, amount: amount || null }
    }
    return {
      familySeasonId: fs.id ?? '',
      studentId: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      program,
      division,
      teamId,
      teamLabel: team ? `${team.team_number || team.team_name || '—'}${teamPending ? ' (pending)' : ''}` : '—',
      school: s.school?.name ?? s.school_raw ?? '—',
      guardianEmail: g?.login_email ?? '—',
      guardianLoggedIn: !!g?.last_login_at,
      status: fs.status ?? '—',
      magicLinkSent: !!fs.magic_link_sent,
      lastUpdated: fs.updated_at ?? null,
      fundraisingMethod: fs.fundraising_method ?? null,
      fundraisingMethods: (fs.fundraising_methods ?? []) as string[],
      payment,
    }
  })

  const rows = allRows.filter((r) => programInScope(r.program, scope))

  const schools = [...new Set(rows.map((r) => r.school).filter((x) => x && x !== '—'))].sort()
  const teamOpts: TeamOpt[] = (allTeams ?? [])
    .filter((t: any) => programInScope(t.program, scope))
    .map((t: any) => ({
      id: t.id,
      label: `${t.team_number ?? t.team_name ?? t.id} · ${t.program} · ${t.division}`,
    }))

  return (
    <AdminShell activePath="/admin/registrations">
      <PageHeader
        title="Registrations"
        subtitle={scope
          ? `${scope.map((p) => PROGRAM_SCOPE_LABELS[p] ?? p).join(' + ')} registrations for ${SEASON} (your program scope).`
          : `Registration lifecycle for the ${SEASON} season.`}
        actions={<RosterDownload />}
      />
      {reminderSummary && (
        <ReminderCampaign
          notRegistered={reminderSummary.notRegistered}
          unpaid={reminderSummary.unpaid}
          fundraisingOpen={reminderSummary.fundraisingOpen}
          fullyDone={reminderSummary.fullyDone}
        />
      )}
      <RegistrationsManager rows={rows} teams={teamOpts} schools={schools} />
    </AdminShell>
  )
}
