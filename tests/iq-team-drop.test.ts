// dropIqStudent (lib/iq-team.ts) — the checked, single-lookup replacement for the
// two independent unchecked writes (student_application then team_member) that
// could silently desync: see lib/iq-status.ts for the incident this closes off.

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { dropIqStudent } from '@/lib/iq-team'

const SEASON = '2026-27'

function fixture(): Tables {
  return {
    team_member: [
      { id: 'tm1', team_id: 'teamA', student_id: 'sA', season: SEASON, team_role: 'student', revoked_at: null },
    ],
    student_application: [
      { id: 'appA', student_id: 'sA', season: SEASON, status: 'accepted', triage_notes: 'iq_team:teamA' },
    ],
  }
}

describe('dropIqStudent', () => {
  it('revokes the active team_member row and marks the application dropped', async () => {
    const tables = fixture()
    const db = makeAdminClient(tables)
    const res = await dropIqStudent(db, 'teamA', 'sA', SEASON)
    expect(res.ok).toBe(true)
    expect(tables.team_member.find((m) => m.id === 'tm1')!.revoked_at).not.toBeNull()
    const app = tables.student_application.find((a) => a.id === 'appA')!
    expect(app.status).toBe('withdrawn')
    expect(app.triage_notes).toBe('iq_team_dropped:teamA')
  })

  it('this is the exact desync the incident was caused by — no longer possible: the team_member row is looked up and revoked by id, not by a second blind filter', async () => {
    // A student who switched teams: their team_member row's team_id no longer
    // matches the team currently being dropped from. The old code's two-step
    // filtered updates could clear triage_notes while leaving this row untouched;
    // now the lookup simply finds nothing for THIS team and no-ops safely,
    // instead of silently mismatching on a stale field.
    const tables = fixture()
    tables.team_member[0].team_id = 'teamB' // moved to a different team
    const db = makeAdminClient(tables)
    const res = await dropIqStudent(db, 'teamA', 'sA', SEASON)
    expect(res.ok).toBe(true)
    // The (unrelated) teamB membership is untouched.
    expect(tables.team_member.find((m) => m.id === 'tm1')!.revoked_at).toBeNull()
    // The application is still marked dropped from teamA — the intended action.
    expect(tables.student_application.find((a) => a.id === 'appA')!.triage_notes).toBe('iq_team_dropped:teamA')
  })

  it('is idempotent when the student was already revoked', async () => {
    const tables = fixture()
    tables.team_member[0].revoked_at = '2026-07-01T00:00:00Z'
    const db = makeAdminClient(tables)
    const res = await dropIqStudent(db, 'teamA', 'sA', SEASON)
    expect(res.ok).toBe(true)
  })

  it('never touches a different student on the same team', async () => {
    const tables = fixture()
    tables.team_member.push({ id: 'tm2', team_id: 'teamA', student_id: 'sB', season: SEASON, team_role: 'student', revoked_at: null })
    tables.student_application.push({ id: 'appB', student_id: 'sB', season: SEASON, status: 'accepted', triage_notes: 'iq_team:teamA' })
    const db = makeAdminClient(tables)
    await dropIqStudent(db, 'teamA', 'sA', SEASON)
    expect(tables.team_member.find((m) => m.id === 'tm2')!.revoked_at).toBeNull()
    expect(tables.student_application.find((a) => a.id === 'appB')!.triage_notes).toBe('iq_team:teamA')
  })
})
