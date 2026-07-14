// PATCH /api/admin/registrations/[id] — program-change side effects.
// Two gaps fixed: (1) changing "program" for a student with no enrollment yet
// (pending applicant) used to silently no-op — it now updates
// student_application.program_interest; (2) switching program never cleared a
// now-incompatible team assignment (live team_member, or the pending
// triage_notes pointer) — it now revokes/strips it automatically.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { PATCH as patchRegistration } from '@/app/api/admin/registrations/[id]/route'

function useClients(tables: Tables, user: { id?: string; email?: string } | null) {
  H.state.admin = makeAdminClient(tables)
  H.state.session = makeSessionClient(user, tables)
}
beforeEach(() => { H.state.session = null; H.state.admin = null })

const WRITE_ADMIN = { id: 'auth-admin', email: 'admin@ex.com' }
const SEASON = '2026-27'

function fixture(): Tables {
  return {
    admin_profile: [{ id: 'adm1', auth_user_id: 'auth-admin', email: 'admin@ex.com' }],
    admin_role_assignment: [{ id: 'ra1', admin_profile_id: 'adm1', role: 'registration_admin', revoked_at: null }],
    student: [],
    enrollment: [],
    student_application: [],
    team: [],
    team_member: [],
    registration_audit_log: [],
    emergency_contact: [],
    family: [],
  }
}

function patch(id: string, body: unknown) {
  return patchRegistration(jsonRequest(body), { params: Promise.resolve({ id }) } as any)
}

describe('PATCH /api/admin/registrations/[id] — program change', () => {
  it('registered student: updates enrollment.program and revokes the now-incompatible team', async () => {
    const t = fixture()
    t.enrollment = [{ id: 'enr1', student_id: 's1', season: SEASON, program: 'vex_v5' }]
    t.team = [{ id: 'team-v5', season: SEASON, program: 'vex_v5', team_number: '9537X' }]
    t.team_member = [{ id: 'tm1', team_id: 'team-v5', enrollment_id: 'enr1', student_id: 's1', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: null }]
    useClients(t, WRITE_ADMIN)

    const res = await patch('fs1', { student_id: 's1', program: 'combat' })
    expect(res.status).toBe(200)

    expect(t.enrollment[0].program).toBe('combat')
    const tm: any = t.team_member.find((r: any) => r.id === 'tm1')
    expect(tm.revoked_at).not.toBeNull()
  })

  it('registered student: no team assigned — program change is a clean no-op on team_member', async () => {
    const t = fixture()
    t.enrollment = [{ id: 'enr1', student_id: 's1', season: SEASON, program: 'vex_v5' }]
    useClients(t, WRITE_ADMIN)

    const res = await patch('fs1', { student_id: 's1', program: 'combat' })
    expect(res.status).toBe(200)
    expect(t.enrollment[0].program).toBe('combat')
    expect(t.team_member).toHaveLength(0)
  })

  it('registered student: switching to the SAME program leaves an existing team assignment alone', async () => {
    const t = fixture()
    t.enrollment = [{ id: 'enr1', student_id: 's1', season: SEASON, program: 'vex_v5' }]
    t.team = [{ id: 'team-v5', season: SEASON, program: 'vex_v5', team_number: '9537X' }]
    t.team_member = [{ id: 'tm1', team_id: 'team-v5', enrollment_id: 'enr1', student_id: 's1', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: null }]
    useClients(t, WRITE_ADMIN)

    const res = await patch('fs1', { student_id: 's1', program: 'vex_v5' })
    expect(res.status).toBe(200)
    const tm: any = t.team_member.find((r: any) => r.id === 'tm1')
    expect(tm.revoked_at).toBeNull()
  })

  it('pending applicant (no enrollment): sets program_interest instead of silently no-opping', async () => {
    const t = fixture()
    t.student_application = [{ id: 'app1', student_id: 's1', season: SEASON, program_interest: 'vex_v5', triage_notes: 'Cavitt Fall 26 interest form' }]
    useClients(t, WRITE_ADMIN)

    const res = await patch('fs1', { student_id: 's1', program: 'combat' })
    expect(res.status).toBe(200)
    expect(t.student_application[0].program_interest).toBe('combat')
  })

  it('pending applicant: switching program strips an incompatible triage_notes team pointer', async () => {
    const t = fixture()
    const teamId = 'd2f53dca-7cc6-4995-ac76-36948df81e79'
    t.team = [{ id: teamId, season: SEASON, program: 'vex_v5', team_number: '9537X' }]
    t.student_application = [{ id: 'app1', student_id: 's1', season: SEASON, program_interest: 'vex_v5', triage_notes: `team:${teamId} · Cavitt Fall 26 interest form` }]
    useClients(t, WRITE_ADMIN)

    const res = await patch('fs1', { student_id: 's1', program: 'combat' })
    expect(res.status).toBe(200)
    expect(t.student_application[0].triage_notes).not.toMatch(new RegExp(`team:${teamId}`))
    expect(t.student_application[0].triage_notes).toContain('Cavitt Fall 26 interest form')
  })

  it('pending applicant: keeps the pointer when the new program still matches the pointed team', async () => {
    const t = fixture()
    const teamId = 'd2f53dca-7cc6-4995-ac76-36948df81e79'
    t.team = [{ id: teamId, season: SEASON, program: 'vex_v5', team_number: '9537X' }]
    t.student_application = [{ id: 'app1', student_id: 's1', season: SEASON, program_interest: 'vex_v5', triage_notes: `team:${teamId} · notes` }]
    useClients(t, WRITE_ADMIN)

    const res = await patch('fs1', { student_id: 's1', program: 'vex_v5' })
    expect(res.status).toBe(200)
    expect(t.student_application[0].triage_notes).toMatch(new RegExp(`team:${teamId}`))
  })
})
