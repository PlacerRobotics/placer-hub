// backfillApsEmails (task: docs/design_email_identity_v1_0.md §1.5) — pulls the
// MinistrySafe login email of record so nobody has to remember a years-old
// yahoo/outlook address. Stubs global fetch (getApsUser's transport) since this
// hits the real MinistrySafe API in production.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { backfillApsEmails } from '@/lib/aps'

function fixture(): Tables {
  return {
    guardian: [
      { id: 'g1', family_id: 'fam1', login_email: 'ann@ex.com', first_name: 'Ann', last_name: 'Sheth' },
    ],
    volunteer_profile: [
      { id: 'vol1', guardian_id: 'g1', aps_user_id: '200042', aps_email: null },
    ],
    guardian_email_alias: [],
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('backfillApsEmails', () => {
  it('fetches the MinistrySafe email, stores it, and records it as an alias', async () => {
    const tables = fixture()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 200042, email: 'ann.sheth@yahoo.com' }) })))

    const { summary } = await backfillApsEmails(makeAdminClient(tables), 'fake-key')
    expect(summary).toEqual({ updated: 1, skipped: 0, errors: 0 })
    expect(tables.volunteer_profile[0].aps_email).toBe('ann.sheth@yahoo.com')
    expect(tables.guardian_email_alias.find((a: any) => a.email === 'ann.sheth@yahoo.com' && a.guardian_id === 'g1')).toBeTruthy()
  })

  it('does not record an alias when the APS email already IS the login email (nothing new to know)', async () => {
    const tables = fixture()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 200042, email: 'ann@ex.com' }) })))

    await backfillApsEmails(makeAdminClient(tables), 'fake-key')
    expect(tables.volunteer_profile[0].aps_email).toBe('ann@ex.com')
    expect(tables.guardian_email_alias.length).toBe(0)
  })

  it('skips volunteers MinistrySafe has no email on file for', async () => {
    const tables = fixture()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 200042, email: '' }) })))

    const { summary } = await backfillApsEmails(makeAdminClient(tables), 'fake-key')
    expect(summary).toEqual({ updated: 0, skipped: 1, errors: 0 })
  })

  it('an HTTP error from MinistrySafe (getApsUser returns null) counts as skipped, not a throw', async () => {
    const tables = fixture()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))

    const { summary } = await backfillApsEmails(makeAdminClient(tables), 'fake-key')
    expect(summary).toEqual({ updated: 0, skipped: 1, errors: 0 })
  })

  it('counts a network-level failure as an error without throwing', async () => {
    const tables = fixture()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    const { summary } = await backfillApsEmails(makeAdminClient(tables), 'fake-key')
    expect(summary).toEqual({ updated: 0, skipped: 0, errors: 1 })
  })

  it('never touches volunteers that already have an aps_email (cheap re-run)', async () => {
    const tables = fixture()
    tables.volunteer_profile[0].aps_email = 'already-known@ex.com'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { summary } = await backfillApsEmails(makeAdminClient(tables), 'fake-key')
    expect(summary).toEqual({ updated: 0, skipped: 0, errors: 0 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
