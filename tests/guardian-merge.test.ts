// Collapse duplicate guardians within one family (the Roy/Morrell/Kalyan/
// Padiyar/Mandot/Chavez shape: one real person, two guardian rows, one
// family). Distinct from tests/family-merge.test.ts (two separate families).

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { previewGuardianMerge, executeGuardianMerge } from '@/lib/guardian-merge'

function royFixture(): Tables {
  return {
    guardian: [
      { id: 'gPrimary', family_id: 'famRoy', first_name: 'Gena', last_name: 'Roy', login_email: 'gena.roy@outlook.com' },
      { id: 'gSecondary', family_id: 'famRoy', first_name: 'Gena', last_name: 'Roy', login_email: 'furball.alfi@gmail.com' },
    ],
    team_member: [],
    volunteer_profile: [],
    person_role: [],
    guardian_email_alias: [],
    waiver_signature: [],
  }
}

describe('previewGuardianMerge', () => {
  it('describes what would happen', async () => {
    const preview = await previewGuardianMerge(makeAdminClient(royFixture()), 'gSecondary', 'gPrimary')
    if ('error' in preview) throw new Error(preview.error)
    expect(preview.loser.email).toBe('furball.alfi@gmail.com')
    expect(preview.survivor.email).toBe('gena.roy@outlook.com')
    expect(preview.waiverSignatureCount).toBe(0)
  })

  it('refuses guardians in different families — that needs family-merge instead', async () => {
    const tables = royFixture()
    tables.guardian[1].family_id = 'famOther'
    const preview = await previewGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary')
    expect('error' in preview).toBe(true)
  })

  it('refuses merging a guardian into itself', async () => {
    const preview = await previewGuardianMerge(makeAdminClient(royFixture()), 'gPrimary', 'gPrimary')
    expect('error' in preview).toBe(true)
  })
})

describe('executeGuardianMerge', () => {
  it('deletes the loser and records their email as an alias of the survivor', async () => {
    const tables = royFixture()
    const result = await executeGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary', 'adm1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.loserRow).toBe('deleted')
    expect(tables.guardian.find((g: any) => g.id === 'gSecondary')).toBeUndefined()
    expect(tables.guardian.find((g: any) => g.id === 'gPrimary')).toBeTruthy()
    expect(tables.guardian_email_alias.find((a: any) => a.email === 'furball.alfi@gmail.com' && a.guardian_id === 'gPrimary')).toBeTruthy()
  })

  it('moves coach team_member rows from the loser to the survivor', async () => {
    const tables = royFixture()
    tables.team_member = [{ id: 'tm1', team_id: 'teamA', guardian_id: 'gSecondary', season: '2026-27', team_role: 'coach', revoked_at: null }]
    await executeGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary', 'adm1')
    expect(tables.team_member.find((t: any) => t.id === 'tm1')!.guardian_id).toBe('gPrimary')
  })

  it('moves the volunteer profile when only the loser has one', async () => {
    const tables = royFixture()
    tables.volunteer_profile = [{ id: 'vol1', guardian_id: 'gSecondary', family_id: 'famRoy', status: 'cleared' }]
    await executeGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary', 'adm1')
    expect(tables.volunteer_profile.find((v: any) => v.id === 'vol1')!.guardian_id).toBe('gPrimary')
  })

  it('refuses when BOTH guardians already have their own volunteer profile', async () => {
    const tables = royFixture()
    tables.volunteer_profile = [
      { id: 'vol1', guardian_id: 'gSecondary', family_id: 'famRoy', status: 'cleared' },
      { id: 'vol2', guardian_id: 'gPrimary', family_id: 'famRoy', status: 'in_progress' },
    ]
    const result = await executeGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary', 'adm1')
    expect(result.ok).toBe(false)
    // Nothing touched.
    expect(tables.volunteer_profile.find((v: any) => v.id === 'vol1')!.guardian_id).toBe('gSecondary')
  })

  it('keeps (never deletes) the loser row when they have signed waivers — append-only', async () => {
    const tables = royFixture()
    tables.waiver_signature = [{ id: 'w1', guardian_id: 'gSecondary', family_id: 'famRoy', season: '2026-27' }]
    const result = await executeGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary', 'adm1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.loserRow).toBe('kept (has signed waivers)')
    expect(tables.guardian.find((g: any) => g.id === 'gSecondary')).toBeTruthy() // still exists
    // But the alias still got recorded, closing the ingestion-side risk.
    expect(tables.guardian_email_alias.find((a: any) => a.email === 'furball.alfi@gmail.com')).toBeTruthy()
  })

  it('does not error the whole merge when the survivor already independently coaches the same team (redundant row)', async () => {
    // Note: the in-memory mock doesn't enforce team_member's real unique-active-
    // coach index (migration 0019), so this doesn't exercise the catch/revoke
    // fallback itself — it only proves a same-team overlap can't blow up the
    // merge. The fallback path is documented in lib/guardian-merge.ts and only
    // fully exercisable against a real Postgres constraint.
    const tables = royFixture()
    tables.team_member = [
      { id: 'tmSurvivor', team_id: 'teamA', guardian_id: 'gPrimary', season: '2026-27', team_role: 'coach', revoked_at: null },
      { id: 'tmLoser', team_id: 'teamA', guardian_id: 'gSecondary', season: '2026-27', team_role: 'coach', revoked_at: null },
    ]
    const result = await executeGuardianMerge(makeAdminClient(tables), 'gSecondary', 'gPrimary', 'adm1')
    expect(result.ok).toBe(true)
    expect(tables.team_member.find((t: any) => t.id === 'tmSurvivor')!.revoked_at).toBeNull()
  })
})
