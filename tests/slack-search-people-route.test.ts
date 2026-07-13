import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { GET as searchPeople } from '@/app/api/admin/slack/search-people/route'

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
      { id: 'g1', family_id: 'fam1', first_name: 'Benjamin', last_name: 'Yu', login_email: 'ben@ex.com' },
      { id: 'g2', family_id: 'fam2', first_name: 'Jane', last_name: 'Doe', login_email: 'jane@ex.com' },
    ],
    student: [
      { id: 's1', family_id: 'fam1', first_name: 'Nohma', last_name: 'Yuan', communication_email: 'nohma@ex.com' },
    ],
  }
}

function req(url: string) {
  return { nextUrl: new URL(url) } as any
}

describe('GET /api/admin/slack/search-people', () => {
  it('finds a guardian by partial last name', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await searchPeople(req('http://x/api?q=Yu'))
    const body = await res.json()
    expect(body.results.some((r: any) => r.name === 'Benjamin Yu' && r.kind === 'guardian')).toBe(true)
  })

  it('finds a student by partial name too', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await searchPeople(req('http://x/api?q=Nohma'))
    const body = await res.json()
    expect(body.results).toEqual([{ id: 's1', kind: 'student', name: 'Nohma Yuan', email: 'nohma@ex.com' }])
  })

  it('returns empty results for a too-short query, no DB hit needed', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await searchPeople(req('http://x/api?q=a'))
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('403s without admin access', async () => {
    useClients(fixture(), null)
    const res = await searchPeople(req('http://x/api?q=Yu'))
    expect(res.status).toBe(403)
  })
})
