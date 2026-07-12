import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, ctx, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { POST as mergeRoute } from '@/app/api/admin/families/[id]/merge/route'

function useClients(tables: Tables, user: { id?: string; email?: string } | null) {
  H.state.admin = makeAdminClient(tables)
  H.state.session = makeSessionClient(user, tables)
}
beforeEach(() => { H.state.session = null; H.state.admin = null })

const WRITE_ADMIN = { id: 'auth-admin', email: 'admin@ex.com' }
const SEASON = '2026-27'

function fixture(): Tables {
  return {
    admin_profile: [
      { id: 'adm1', auth_user_id: 'auth-admin', email: 'admin@ex.com' },
      { id: 'adm2', auth_user_id: 'auth-ro', email: 'ro@ex.com' },
    ],
    admin_role_assignment: [
      { id: 'ra1', admin_profile_id: 'adm1', role: 'registration_admin', revoked_at: null },
      { id: 'ra2', admin_profile_id: 'adm2', role: 'read_only_admin', revoked_at: null },
    ],
    family: [
      { id: 'famA', display_name: 'A', primary_email: 'a@ex.com' },
      { id: 'famB', display_name: 'B', primary_email: 'b@ex.com' },
    ],
    guardian: [
      { id: 'gA', family_id: 'famA', first_name: 'A', last_name: 'One', login_email: 'a@ex.com' },
      { id: 'gB', family_id: 'famB', first_name: 'B', last_name: 'Two', login_email: 'b@ex.com' },
    ],
    student: [{ id: 'sB', family_id: 'famB', first_name: 'Kid', last_name: 'B' }],
    student_application: [], emergency_contact: [], enrollment: [], payment_transaction: [],
    volunteer_profile: [], financial_aid: [], waiver_signature: [],
    family_season: [{ id: 'fsB', family_id: 'famB', season: SEASON, status: 'applied' }],
    registration_audit_log: [],
  }
}

describe('POST /api/admin/families/[id]/merge', () => {
  it('without confirm returns a preview and changes nothing', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ target_family_id: 'famA' }), ctx({ id: 'famB' }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.preview.students.map((s: any) => s.name)).toEqual(['Kid B'])
    expect(tables.student.find((s: any) => s.id === 'sB')!.family_id).toBe('famB') // untouched
  })

  it('resolves the target by guardian email, mailto:-corrupted or not', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ target_guardian_email: 'mailto:A@Ex.com' }), ctx({ id: 'famB' }))
    expect(res.status).toBe(200)
    expect((await res.json()).preview.target.familyId).toBe('famA')
  })

  it('with confirm:true actually executes the merge', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ target_family_id: 'famA', confirm: true }), ctx({ id: 'famB' }))
    expect(res.status).toBe(200)
    expect((await res.json()).sourceRemains).toBe('deleted')
    expect(tables.student.find((s: any) => s.id === 'sB')!.family_id).toBe('famA')
    expect(tables.family.find((f: any) => f.id === 'famB')).toBeUndefined()
  })

  it('read_only_admin cannot preview or execute', async () => {
    useClients(fixture(), { id: 'auth-ro', email: 'ro@ex.com' })
    const res = await mergeRoute(jsonRequest({ target_family_id: 'famA' }), ctx({ id: 'famB' }))
    expect(res.status).toBe(403)
  })

  it('404s an unresolvable target guardian email', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ target_guardian_email: 'stranger@ex.com' }), ctx({ id: 'famB' }))
    expect(res.status).toBe(404)
  })

  it('400s with no target specified', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({}), ctx({ id: 'famB' }))
    expect(res.status).toBe(400)
  })
})
