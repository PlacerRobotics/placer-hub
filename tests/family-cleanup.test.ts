// Duplicate-family cleanup routes (delete shell + move student) — drives the
// REAL handlers with the in-memory Supabase stand-in, same pattern as
// tests/escalation.test.ts. The point: the delete guards and move guards are
// enforced by the route, not the UI.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, ctx, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { POST as deleteFamily } from '@/app/api/admin/families/[id]/delete/route'
import { POST as moveStudent } from '@/app/api/admin/students/[id]/move-family/route'

function useClients(tables: Tables, user: { id?: string; email?: string } | null) {
  H.state.admin = makeAdminClient(tables)
  H.state.session = makeSessionClient(user, tables)
}

beforeEach(() => {
  H.state.session = null
  H.state.admin = null
})

const WRITE_ADMIN = { id: 'auth-admin', email: 'admin@ex.com' }

// The Barrera shape: a spurious family created by a bad-email roster add
// (mailto:), holding an unregistered student stub, alongside the real family.
function fixture(): Tables {
  return {
    admin_profile: [
      { id: 'adm1', auth_user_id: 'auth-admin', email: 'admin@ex.com' },
      { id: 'adm2', auth_user_id: 'auth-readonly', email: 'ro@ex.com' },
    ],
    admin_role_assignment: [
      { id: 'ra1', admin_profile_id: 'adm1', role: 'registration_admin', revoked_at: null },
      { id: 'ra2', admin_profile_id: 'adm2', role: 'read_only_admin', revoked_at: null },
    ],
    family: [
      { id: 'famReal', primary_email: 'parent@ex.com', display_name: 'Real' },
      { id: 'famDup', primary_email: 'mailto:parent@ex.com', display_name: 'Dup' },
    ],
    guardian: [
      { id: 'gReal', family_id: 'famReal', login_email: 'parent@ex.com', first_name: 'Pat', last_name: 'Parent' },
      { id: 'gDup', family_id: 'famDup', login_email: 'mailto:parent@ex.com', first_name: 'Pat', last_name: 'Parent' },
    ],
    student: [
      { id: 'sStub', family_id: 'famDup', first_name: 'Sam', last_name: 'Parent' },
    ],
    student_application: [
      { id: 'appStub', student_id: 'sStub', family_id: 'famDup', season: '2026-27', triage_notes: 'iq_team:team1' },
    ],
    emergency_contact: [
      { id: 'ecStub', student_id: 'sStub', family_id: 'famDup', first_name: 'Pat', last_name: 'Parent', phone: '+16505551234', priority: 1 },
    ],
    enrollment: [],
    payment_transaction: [],
    waiver_signature: [],
    volunteer_profile: [],
    financial_aid: [],
    family_season: [{ id: 'fsDup', family_id: 'famDup', season: '2026-27', status: 'applied' }],
  }
}

describe('POST /api/admin/families/[id]/delete', () => {
  it('refuses while the family still has a student', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await deleteFamily(jsonRequest({}), ctx({ id: 'famDup' }))
    expect(res.status).toBe(409)
    const d = await res.json()
    expect(d.blockers.students).toBe(1)
    expect(tables.family.find((f) => f.id === 'famDup')).toBeTruthy() // untouched
  })

  it('refuses while the family has payments, even with no students', async () => {
    const tables = fixture()
    tables.student = []
    tables.payment_transaction = [{ id: 'p1', family_id: 'famDup', amount: 40 }]
    useClients(tables, WRITE_ADMIN)
    const res = await deleteFamily(jsonRequest({}), ctx({ id: 'famDup' }))
    expect(res.status).toBe(409)
    expect((await res.json()).blockers.payments).toBe(1)
  })

  it('deletes a true empty shell', async () => {
    const tables = fixture()
    tables.student = []
    tables.student_application = []
    tables.emergency_contact = []
    useClients(tables, WRITE_ADMIN)
    const res = await deleteFamily(jsonRequest({}), ctx({ id: 'famDup' }))
    expect(res.status).toBe(200)
    expect(tables.family.find((f) => f.id === 'famDup')).toBeUndefined()
    expect(tables.family.find((f) => f.id === 'famReal')).toBeTruthy() // only the shell went
  })

  it('read_only_admin cannot delete', async () => {
    const tables = fixture()
    tables.student = []
    useClients(tables, { id: 'auth-readonly', email: 'ro@ex.com' })
    const res = await deleteFamily(jsonRequest({}), ctx({ id: 'famDup' }))
    expect(res.status).toBe(403)
  })

  it('404s for an unknown family', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await deleteFamily(jsonRequest({}), ctx({ id: 'nope' }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/students/[id]/move-family', () => {
  it('moves an unregistered stub (student + application + emergency contact) to the target family', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await moveStudent(jsonRequest({ target_guardian_email: 'parent@ex.com' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(200)
    expect(tables.student.find((s) => s.id === 'sStub')!.family_id).toBe('famReal')
    expect(tables.student_application.find((a) => a.id === 'appStub')!.family_id).toBe('famReal')
    expect(tables.emergency_contact.find((e) => e.id === 'ecStub')!.family_id).toBe('famReal')
    // The IQ roster pointer travels with the application — the student stays on their team.
    expect(tables.student_application.find((a) => a.id === 'appStub')!.triage_notes).toBe('iq_team:team1')
    // After the move, the shell qualifies for deletion.
    const del = await deleteFamily(jsonRequest({}), ctx({ id: 'famDup' }))
    expect(del.status).toBe(200)
  })

  it('a mailto:-corrupted target email still resolves (cleanEmail applied on the way in)', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await moveStudent(jsonRequest({ target_guardian_email: 'mailto:Parent@Ex.com' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(200)
    expect(tables.student.find((s) => s.id === 'sStub')!.family_id).toBe('famReal')
  })

  it('refuses a registered student (enrollment exists)', async () => {
    const tables = fixture()
    tables.enrollment = [{ id: 'e1', student_id: 'sStub', family_id: 'famDup', season: '2026-27', program: 'vex_iq' }]
    useClients(tables, WRITE_ADMIN)
    const res = await moveStudent(jsonRequest({ target_guardian_email: 'parent@ex.com' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(409)
    expect(tables.student.find((s) => s.id === 'sStub')!.family_id).toBe('famDup') // untouched
  })

  it('refuses a student with signed waivers', async () => {
    const tables = fixture()
    tables.waiver_signature = [{ id: 'w1', student_id: 'sStub', family_id: 'famDup', season: '2026-27' }]
    useClients(tables, WRITE_ADMIN)
    const res = await moveStudent(jsonRequest({ target_guardian_email: 'parent@ex.com' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(409)
  })

  it('404s when the target guardian email matches nobody', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await moveStudent(jsonRequest({ target_guardian_email: 'stranger@ex.com' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(404)
  })

  it('rejects a move to the same family', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await moveStudent(jsonRequest({ target_family_id: 'famDup' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(400)
  })

  it('read_only_admin cannot move', async () => {
    useClients(fixture(), { id: 'auth-readonly', email: 'ro@ex.com' })
    const res = await moveStudent(jsonRequest({ target_guardian_email: 'parent@ex.com' }), ctx({ id: 'sStub' }))
    expect(res.status).toBe(403)
  })
})
