import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, type Tables } from './helpers/supabase-mock'

const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))

import { POST as confirmAltEmail } from '@/app/api/admin/slack/confirm-alt-email/route'

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
    guardian: [{ id: 'g1', family_id: 'fam1', login_email: 'jane@ex.com' }],
    guardian_email_alias: [],
    student: [{ id: 's1', family_id: 'fam1', first_name: 'Mia', last_name: 'Doe', slack_email: null }],
  }
}

describe('POST /api/admin/slack/confirm-alt-email', () => {
  it('records the alt email as a guardian alias', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await confirmAltEmail(jsonRequest({ slackEmail: 'jane.personal@gmail.com', candidateId: 'g1', candidateKind: 'guardian' }))
    expect(res.status).toBe(200)
    expect(tables.guardian_email_alias.find((a: any) => a.guardian_id === 'g1' && a.email === 'jane.personal@gmail.com')).toBeTruthy()
  })

  it('sets slack_email on a student with none on file', async () => {
    const tables = fixture()
    useClients(tables, WRITE_ADMIN)
    const res = await confirmAltEmail(jsonRequest({ slackEmail: 'mia.doe@gmail.com', candidateId: 's1', candidateKind: 'student' }))
    expect(res.status).toBe(200)
    expect(tables.student.find((s: any) => s.id === 's1')!.slack_email).toBe('mia.doe@gmail.com')
  })

  it('refuses to overwrite a student who already has a DIFFERENT slack_email', async () => {
    const tables = fixture()
    tables.student[0].slack_email = 'existing@ex.com'
    useClients(tables, WRITE_ADMIN)
    const res = await confirmAltEmail(jsonRequest({ slackEmail: 'mia.doe@gmail.com', candidateId: 's1', candidateKind: 'student' }))
    expect(res.status).toBe(409)
    expect(tables.student[0].slack_email).toBe('existing@ex.com')
  })

  it('400s on an invalid candidateKind', async () => {
    useClients(fixture(), WRITE_ADMIN)
    const res = await confirmAltEmail(jsonRequest({ slackEmail: 'x@ex.com', candidateId: 'g1', candidateKind: 'volunteer' }))
    expect(res.status).toBe(400)
  })

  it('403s a read-only admin', async () => {
    const tables = fixture()
    tables.admin_profile.push({ id: 'adm2', auth_user_id: 'auth-ro', email: 'ro@ex.com' })
    tables.admin_role_assignment.push({ id: 'ra2', admin_profile_id: 'adm2', role: 'read_only_admin', revoked_at: null })
    useClients(tables, { id: 'auth-ro', email: 'ro@ex.com' })
    const res = await confirmAltEmail(jsonRequest({ slackEmail: 'x@ex.com', candidateId: 'g1', candidateKind: 'guardian' }))
    expect(res.status).toBe(403)
  })
})
