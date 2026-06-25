// Build the per-family details block (Parent(s) / Student(s) with program + team)
// for personalized invite emails. `db` is a service-role client.

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5', vex_iq: 'VEX IQ', combat: 'Combat', both: 'VEX V5 + Combat', not_sure: 'Undecided',
}

export async function familyInviteDetails(db: any, familyId: string, season: string): Promise<{ label: string; value: string }[]> {
  const { data: gs } = await db.from('guardian').select('first_name, last_name').eq('family_id', familyId)
  const parents = [...new Set((gs ?? []).map((g: any) => `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim()).filter(Boolean))].join(', ')

  const { data: studs } = await db.from('student').select('id, first_name, last_name').eq('family_id', familyId).order('created_at', { ascending: true })
  const sids = (studs ?? []).map((s: any) => s.id)

  const progByStudent: Record<string, string> = {}
  const teamByStudent: Record<string, string> = {}
  if (sids.length) {
    // Program: enrollment (registered) wins over the application's interest.
    const { data: apps } = await db.from('student_application').select('student_id, program_interest, triage_notes').eq('season', season).in('student_id', sids)
    for (const a of apps ?? []) if (a.program_interest) progByStudent[a.student_id] = a.program_interest
    const { data: enrs } = await db.from('enrollment').select('student_id, program').eq('season', season).in('student_id', sids)
    for (const e of enrs ?? []) progByStudent[e.student_id] = e.program

    // Team number, when assigned (student team_member → team).
    const { data: tms } = await db.from('team_member').select('student_id, team:team_id ( team_number )').eq('season', season).eq('team_role', 'student').is('revoked_at', null).in('student_id', sids)
    for (const tm of tms ?? []) { const t = Array.isArray(tm.team) ? tm.team[0] : tm.team; if (t?.team_number) teamByStudent[tm.student_id] = t.team_number }
    // IQ teams are linked via the application's triage_notes (iq_team:<uuid>) before assignment.
    const iqIds = [...new Set((apps ?? []).map((a: any) => String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)?.[1]).filter(Boolean))] as string[]
    if (iqIds.length) {
      const { data: iqTeams } = await db.from('team').select('id, team_number').in('id', iqIds)
      const numById: Record<string, string> = {}
      for (const t of iqTeams ?? []) if (t.team_number) numById[t.id] = t.team_number
      for (const a of apps ?? []) {
        const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)
        if (m && numById[m[1]] && !teamByStudent[a.student_id]) teamByStudent[a.student_id] = numById[m[1]]
      }
    }
  }

  const studentLines = (studs ?? [])
    .map((s: any) => {
      const nm = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
      if (!nm) return ''
      const prog = PROGRAM_LABELS[progByStudent[s.id]] ?? ''
      const team = teamByStudent[s.id]
      return nm + (prog ? ` — ${prog}` : '') + (team ? ` (Team ${team})` : '')
    })
    .filter(Boolean)
    .join('; ')

  return [
    { label: (gs ?? []).length > 1 ? 'Parents' : 'Parent', value: parents },
    { label: (studs ?? []).length > 1 ? 'Students' : 'Student', value: studentLines },
  ]
}
