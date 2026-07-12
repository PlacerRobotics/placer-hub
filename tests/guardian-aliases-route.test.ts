import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, ctx, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { POST as addAlias, DELETE as removeAlias } from '@/app/api/admin/guardians/[id]/aliases/route'

function useClients(tables: Tables, user: { id?: string; email?: string } | null) {
  H.state.admin = makeAdminClient(tables)
  H.state.session = makeSessionClient(user, tables)
}

beforeEach(() => { H.state.session = null; H.state.admin = null })

const WRITE_ADMIN = { id: 'auth-admin', email: 'admin@ex.com' }

function fixture(): Tables {
  return {
    admin_profile: [{ id: 'adm1', auth_user_id: 'auth-admin', email: 'admin@ex.com' }],
    admin_role_assignment: [{ id: 'ra1', admin_profile_id: 'adm1', role: 'registration_admin', revoked_at: null }],
    guardian: [
      { id: 'g1', family_id: 'fam1', login_email: 'ann@ex.com', first_name: 'Ann', last_name: 'A' },
      { id: 'g2', family_id: 'fam2', login_email: 'bob@ex.com', first_name: 'Bob', last_name: 'B' },
    ],
    guardian_email_alias: [],
  }
}

describe('POST /api/admin/guardians/[id]/aliases', () => {
  it('records a new alias', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await addAlias(jsonRequest({ email: 'Ann.Old@Yahoo.com' }), ctx({ id: 'g1' }))
    expect(res.status).toBe(200)
    expect(tables.guardian_email_alias.find((a: any) => a.email === 'ann.old@yahoo.com' && a.guardian_id === 'g1')).toBeTruthy()
  })

  it('rejects an email that equals the guardian’s own login email', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await addAlias(jsonRequest({ email: 'ann@ex.com' }), ctx({ id: 'g1' }))
    expect(res.status).toBe(400)
  })

  it('rejects an email already belonging to a DIFFERENT guardian', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await addAlias(jsonRequest({ email: 'bob@ex.com' }), ctx({ id: 'g1' }))
    expect(res.status).toBe(409)
  })

  it('is a no-op (not an error) when the email is already known for THIS guardian', async () => {
    const tables = fixture()
    tables.guardian_email_alias = [{ id: 'a1', guardian_id: 'g1', email: 'ann.old@yahoo.com', source: 'manual' }]
    useClients(tables, WRITE_ADMIN)
    const res = await addAlias(jsonRequest({ email: 'ann.old@yahoo.com' }), ctx({ id: 'g1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyKnown).toBe(true)
  })

  it('read_only_admin cannot add an alias', async () => {
    const tables = fixture()
    tables.admin_profile.push({ id: 'adm2', auth_user_id: 'auth-ro', email: 'ro@ex.com' })
    tables.admin_role_assignment.push({ id: 'ra2', admin_profile_id: 'adm2', role: 'read_only_admin', revoked_at: null })
    useClients(tables, { id: 'auth-ro', email: 'ro@ex.com' })
    const res = await addAlias(jsonRequest({ email: 'x@ex.com' }), ctx({ id: 'g1' }))
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/guardians/[id]/aliases', () => {
  it('removes an alias scoped to the guardian', async () => {
    const tables = fixture()
    tables.guardian_email_alias = [{ id: 'a1', guardian_id: 'g1', email: 'ann.old@yahoo.com', source: 'manual' }]
    useClients(tables, WRITE_ADMIN)
    const req = new Request('http://x/api?alias_id=a1') as any
    const res = await removeAlias(req, ctx({ id: 'g1' }))
    expect(res.status).toBe(200)
    expect(tables.guardian_email_alias.find((a: any) => a.id === 'a1')).toBeUndefined()
  })

  it('does not remove an alias belonging to a different guardian', async () => {
    const tables = fixture()
    tables.guardian_email_alias = [{ id: 'a1', guardian_id: 'g2', email: 'bob.old@yahoo.com', source: 'manual' }]
    useClients(tables, WRITE_ADMIN)
    const req = new Request('http://x/api?alias_id=a1') as any
    await removeAlias(req, ctx({ id: 'g1' }))
    expect(tables.guardian_email_alias.find((a: any) => a.id === 'a1')).toBeTruthy() // untouched
  })
})
