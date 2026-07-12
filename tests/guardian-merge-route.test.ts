import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, ctx, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { POST as mergeRoute } from '@/app/api/admin/guardians/[id]/merge/route'

function useClients(tables: Tables, user: { id?: string; email?: string } | null) {
  H.state.admin = makeAdminClient(tables)
  H.state.session = makeSessionClient(user, tables)
}
beforeEach(() => { H.state.session = null; H.state.admin = null })

const WRITE_ADMIN = { id: 'auth-admin', email: 'admin@ex.com' }

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
    guardian: [
      { id: 'gPrimary', family_id: 'famRoy', first_name: 'Gena', last_name: 'Roy', login_email: 'gena.roy@outlook.com' },
      { id: 'gSecondary', family_id: 'famRoy', first_name: 'Gena', last_name: 'Roy', login_email: 'furball.alfi@gmail.com' },
    ],
    team_member: [], volunteer_profile: [], person_role: [], guardian_email_alias: [], waiver_signature: [],
  }
}

describe('POST /api/admin/guardians/[id]/merge', () => {
  it('without confirm returns a preview and changes nothing', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ survivor_guardian_id: 'gPrimary' }), ctx({ id: 'gSecondary' }))
    expect(res.status).toBe(200)
    expect((await res.json()).preview.loser.email).toBe('furball.alfi@gmail.com')
    expect(tables.guardian.find((g: any) => g.id === 'gSecondary')).toBeTruthy() // untouched
  })

  it('with confirm:true executes the merge', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ survivor_guardian_id: 'gPrimary', confirm: true }), ctx({ id: 'gSecondary' }))
    expect(res.status).toBe(200)
    expect((await res.json()).loserRow).toBe('deleted')
    expect(tables.guardian.find((g: any) => g.id === 'gSecondary')).toBeUndefined()
  })

  it('read_only_admin cannot merge', async () => {
    useClients(fixture(), { id: 'auth-ro', email: 'ro@ex.com' })
    const res = await mergeRoute(jsonRequest({ survivor_guardian_id: 'gPrimary' }), ctx({ id: 'gSecondary' }))
    expect(res.status).toBe(403)
  })

  it('400s with no survivor specified', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({}), ctx({ id: 'gSecondary' }))
    expect(res.status).toBe(400)
  })

  it('rejects guardians in different families', async () => {
    const tables = fixture()
    tables.guardian[1].family_id = 'famOther'
    useClients(tables, WRITE_ADMIN)
    const res = await mergeRoute(jsonRequest({ survivor_guardian_id: 'gPrimary' }), ctx({ id: 'gSecondary' }))
    expect(res.status).toBe(400)
  })
})
