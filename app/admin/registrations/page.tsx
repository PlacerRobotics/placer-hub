import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader } from '@/components/ui'
import RosterDownload from './roster-download'
import RegistrationsManager, { type RegRow, type TeamOpt } from './registrations-manager'

const SEASON = '2026-27'

export default async function AdminRegistrationsPage() {
  const supabase = await createClient()

  // Family-season lifecycle rows for the season.
  const { data: fseasons } = await supabase
    .from('family_season')
    .select('id, family_id, status, magic_link_sent, updated_at, fundraising_method')
    .eq('season', SEASON)
    .in('status', ['cleared_to_register', 'registered', 'cancelled'])
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
    ? await supabase.from('enrollment').select('student_id, program, division').eq('season', SEASON).in('student_id', studentIds)
    : { data: [] as any[] }
  // A student with program 'both' has TWO enrollment rows (vex_v5 + combat), so
  // group by student rather than assuming one row each.
  const enrByStudent: Record<string, { programs: string[]; division: string | null }> = {}
  for (const e of (enrollments ?? []) as any[]) {
    const cur = enrByStudent[e.student_id] ?? { programs: [], division: null }
    if (e.program && !cur.programs.includes(e.program)) cur.programs.push(e.program)
    if (!cur.division && e.division) cur.division = e.division
    enrByStudent[e.student_id] = cur
  }

  const { data: tms } = studentIds.length
    ? await supabase.from('team_member').select('student_id, team_id').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('student_id', studentIds)
    : { data: [] as any[] }
  const teamIdByStudent: Record<string, string> = Object.fromEntries((tms ?? []).map((t: any) => [t.student_id, t.team_id]))
  const teamIds = [...new Set(Object.values(teamIdByStudent))]
  const { data: teamRows } = teamIds.length
    ? await supabase.from('team').select('id, team_number, team_name').in('id', teamIds)
    : { data: [] as any[] }
  const teamById: Record<string, any> = Object.fromEntries((teamRows ?? []).map((t: any) => [t.id, t]))

  const { data: apps } = studentIds.length
    ? await supabase.from('student_application').select('student_id, program_interest').eq('season', SEASON).in('student_id', studentIds)
    : { data: [] as any[] }
  const progByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.program_interest]))

  const { data: allTeams } = await supabase
    .from('team')
    .select('id, team_number, team_name, program, division')
    .eq('season', SEASON)
    .order('team_number', { ascending: true })

  const rows: RegRow[] = students.map((s) => {
    const fs = fsByFamily[s.family_id] ?? {}
    const enr = enrByStudent[s.id]
    const g = gByFamily[s.family_id]
    const teamId = teamIdByStudent[s.id] ?? null
    const team = teamId ? teamById[teamId] : null
    const grade = Number(s.grade ?? 0)
    const division = enr?.division ?? (grade <= 5 ? 'ES' : grade <= 8 ? 'MS' : 'HS')
    // Two enrollment programs (vex_v5 + combat) collapse to the 'both' label.
    const program = enr
      ? enr.programs.length > 1 ? 'both' : (enr.programs[0] ?? '—')
      : progByStudent[s.id] ?? '—'
    return {
      familySeasonId: fs.id ?? '',
      studentId: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      program,
      division,
      teamId,
      teamLabel: team ? team.team_number || team.team_name || '—' : '—',
      school: s.school?.name ?? s.school_raw ?? '—',
      guardianEmail: g?.login_email ?? '—',
      guardianLoggedIn: !!g?.last_login_at,
      status: fs.status ?? '—',
      magicLinkSent: !!fs.magic_link_sent,
      lastUpdated: fs.updated_at ?? null,
      fundraisingMethod: fs.fundraising_method ?? null,
    }
  })

  const schools = [...new Set(rows.map((r) => r.school).filter((x) => x && x !== '—'))].sort()
  const teamOpts: TeamOpt[] = (allTeams ?? []).map((t: any) => ({
    id: t.id,
    label: `${t.team_number ?? t.team_name ?? t.id} · ${t.program} · ${t.division}`,
  }))

  return (
    <AdminShell activePath="/admin/registrations">
      <PageHeader
        title="Registrations"
        subtitle={`Registration lifecycle for the ${SEASON} season.`}
        actions={<RosterDownload />}
      />
      <RegistrationsManager rows={rows} teams={teamOpts} schools={schools} />
    </AdminShell>
  )
}
