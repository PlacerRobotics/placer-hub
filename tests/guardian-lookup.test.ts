import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { findGuardianByEmail, addGuardianEmailAlias } from '@/lib/guardian-lookup'

function fixture(): Tables {
  return {
    guardian: [{ id: 'g1', family_id: 'fam1', login_email: 'ann@ex.com' }],
    guardian_email_alias: [{ id: 'a1', guardian_id: 'g1', email: 'ann.old@yahoo.com', source: 'aps_legacy' }],
  }
}

describe('findGuardianByEmail', () => {
  it('matches login_email first', async () => {
    const m = await findGuardianByEmail(makeAdminClient(fixture()), 'Ann@Ex.com')
    expect(m).toEqual({ id: 'g1', family_id: 'fam1', matchedVia: 'login_email' })
  })

  it('falls back to an alias when login_email misses — the exact fix for the mailto/APS-legacy duplicate class', async () => {
    const m = await findGuardianByEmail(makeAdminClient(fixture()), 'ann.old@yahoo.com')
    expect(m).toEqual({ id: 'g1', family_id: 'fam1', matchedVia: 'alias' })
  })

  it('returns null when neither matches', async () => {
    expect(await findGuardianByEmail(makeAdminClient(fixture()), 'stranger@ex.com')).toBeNull()
  })

  it('returns null for empty input', async () => {
    expect(await findGuardianByEmail(makeAdminClient(fixture()), '')).toBeNull()
  })
})

describe('addGuardianEmailAlias', () => {
  it('records a new alias', async () => {
    const tables = fixture()
    await addGuardianEmailAlias(makeAdminClient(tables), 'g1', 'Ann.Work@Outlook.com', 'manual')
    expect(tables.guardian_email_alias.find((a: any) => a.email === 'ann.work@outlook.com')).toBeTruthy()
  })

  it('is a no-op when the email equals the current login_email', async () => {
    const tables = fixture()
    await addGuardianEmailAlias(makeAdminClient(tables), 'g1', 'ann@ex.com', 'manual')
    expect(tables.guardian_email_alias.some((a: any) => a.email === 'ann@ex.com')).toBe(false)
  })

  it('does not throw on a duplicate alias — never blocks the caller', async () => {
    const tables = fixture()
    await expect(addGuardianEmailAlias(makeAdminClient(tables), 'g1', 'ann.old@yahoo.com', 'manual')).resolves.not.toThrow()
  })
})
