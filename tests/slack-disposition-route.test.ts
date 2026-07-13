import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { POST as setDisposition } from '@/app/api/admin/slack/disposition/route'

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
    slack_member_disposition: [],
  }
}

describe('POST /api/admin/slack/disposition', () => {
  it('records tags and notes for a Slack account', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await setDisposition(jsonRequest({
      slackUserId: 'U1', email: 'alum@ex.com', slackName: 'Alum Person',
      tags: ['alumni', 'employee'], notes: 'left the club 2024',
    }))
    expect(res.status).toBe(200)
    const row: any = tables.slack_member_disposition.find((r: any) => r.slack_user_id === 'U1')
    expect(row?.tags).toEqual(['alumni', 'employee'])
    expect(row?.notes).toBe('left the club 2024')
  })

  it('upserts — re-tagging the same slackUserId updates, not duplicates', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    await setDisposition(jsonRequest({ slackUserId: 'U1', tags: ['dropped'] }))
    await setDisposition(jsonRequest({ slackUserId: 'U1', tags: ['dropped'], notes: 'confirmed by Kevin' }))
    const rows = tables.slack_member_disposition.filter((r: any) => r.slack_user_id === 'U1')
    expect(rows).toHaveLength(1)
    expect(rows[0].notes).toBe('confirmed by Kevin')
  })

  it('400s on an unknown tag', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await setDisposition(jsonRequest({ slackUserId: 'U1', tags: ['bogus_tag'] }))
    expect(res.status).toBe(400)
  })

  it('400s with no slackUserId', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await setDisposition(jsonRequest({ tags: ['volunteer'] }))
    expect(res.status).toBe(400)
  })

  it('403s a read-only admin', async () => {
    useClients(fixture(), { id: 'auth-ro', email: 'ro@ex.com' })
    const res = await setDisposition(jsonRequest({ slackUserId: 'U1', tags: ['volunteer'] }))
    expect(res.status).toBe(403)
  })
})
