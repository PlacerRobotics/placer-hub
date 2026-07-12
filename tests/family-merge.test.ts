// Merge Families (docs/design_email_identity_v1_0.md §3 — the Shu case: one
// real family split across two records, parent 1 + student A on one, parent 2
// + student B on the other, all emails correct). Drives lib/family-merge.ts
// against the in-memory mock.

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { previewFamilyMerge, executeFamilyMerge } from '@/lib/family-merge'

const SEASON = '2026-27'

function shuFixture(): Tables {
  return {
    family: [
      { id: 'famA', display_name: 'Shu Family (A)', primary_email: 'parent1@ex.com' },
      { id: 'famB', display_name: 'Shu Family (B)', primary_email: 'parent2@ex.com' },
    ],
    guardian: [
      { id: 'gA', family_id: 'famA', first_name: 'Parent', last_name: 'One', login_email: 'parent1@ex.com' },
      { id: 'gB', family_id: 'famB', first_name: 'Parent', last_name: 'Two', login_email: 'parent2@ex.com' },
    ],
    student: [
      { id: 'sA', family_id: 'famA', first_name: 'Chunlee', last_name: 'Shu' },
      { id: 'sB', family_id: 'famB', first_name: 'Chunyee', last_name: 'Shu' },
    ],
    student_application: [
      { id: 'appA', student_id: 'sA', family_id: 'famA', season: SEASON },
      { id: 'appB', student_id: 'sB', family_id: 'famB', season: SEASON },
    ],
    emergency_contact: [
      { id: 'ecA', student_id: 'sA', family_id: 'famA', first_name: 'Parent', last_name: 'One', phone: '+16505551111', priority: 1 },
    ],
    enrollment: [
      { id: 'enrA', student_id: 'sA', family_id: 'famA', season: SEASON, program: 'vex_v5' },
      { id: 'enrB', student_id: 'sB', family_id: 'famB', season: SEASON, program: 'vex_iq' },
    ],
    payment_transaction: [
      { id: 'payA', family_id: 'famA', season: SEASON, amount: 40 },
    ],
    volunteer_profile: [
      { id: 'volA', guardian_id: 'gA', family_id: 'famA', status: 'cleared', aps_user_id: '100001' },
      { id: 'volB', guardian_id: 'gB', family_id: 'famB', status: 'in_progress' },
    ],
    financial_aid: [],
    waiver_signature: [],
    family_season: [
      { id: 'fsA', family_id: 'famA', season: SEASON, status: 'registered' },
      { id: 'fsB', family_id: 'famB', season: SEASON, status: 'applied' },
    ],
    registration_audit_log: [],
  }
}

describe('previewFamilyMerge', () => {
  it('lists everything on the source family that would move, and which family_season wins', async () => {
    const tables = shuFixture()
    const preview = await previewFamilyMerge(makeAdminClient(tables), 'famB', 'famA')
    if ('error' in preview) throw new Error(preview.error)
    expect(preview.guardians.map((g) => g.name)).toEqual(['Parent Two'])
    expect(preview.students.map((s) => s.name)).toEqual(['Chunyee Shu'])
    expect(preview.volunteers.map((v) => v.guardianName)).toEqual(['Parent Two'])
    expect(preview.enrollmentCount).toBe(1)
    expect(preview.seasons).toEqual([{ season: SEASON, sourceStatus: 'applied', targetStatus: 'registered', winner: 'target' }])
  })

  it('rejects merging a family into itself', async () => {
    const result = await previewFamilyMerge(makeAdminClient(shuFixture()), 'famA', 'famA')
    expect('error' in result).toBe(true)
  })
})

describe('executeFamilyMerge', () => {
  it('moves both parents worth of data and deletes the now-empty source shell', async () => {
    const tables = shuFixture()
    const db = makeAdminClient(tables)
    const result = await executeFamilyMerge(db, 'famB', 'famA', 'adm1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sourceRemains).toBe('deleted')

    // Both students now under famA — the actual point of the merge.
    expect(tables.student.find((s: any) => s.id === 'sA')!.family_id).toBe('famA')
    expect(tables.student.find((s: any) => s.id === 'sB')!.family_id).toBe('famA')
    // Both parents keep their own guardian rows and logins, just repointed.
    expect(tables.guardian.find((g: any) => g.id === 'gB')!.family_id).toBe('famA')
    expect(tables.guardian.find((g: any) => g.id === 'gB')!.login_email).toBe('parent2@ex.com')
    expect(tables.enrollment.find((e: any) => e.id === 'enrB')!.family_id).toBe('famA')
    expect(tables.payment_transaction.find((p: any) => p.id === 'payA')!.family_id).toBe('famA')
    expect(tables.volunteer_profile.find((v: any) => v.id === 'volB')!.family_id).toBe('famA')

    // The further-along status (registered, famA's) wins; famB's row is gone.
    expect(tables.family_season.filter((f: any) => f.family_id === 'famA')).toHaveLength(1)
    expect(tables.family_season.find((f: any) => f.family_id === 'famA')!.status).toBe('registered')
    expect(tables.family_season.some((f: any) => f.family_id === 'famB')).toBe(false)

    // The empty shell is gone entirely.
    expect(tables.family.find((f: any) => f.id === 'famB')).toBeUndefined()
    expect(tables.family.find((f: any) => f.id === 'famA')).toBeTruthy()
  })

  it("keeps the SOURCE season status when it's further along than the target's", async () => {
    const tables = shuFixture()
    tables.family_season = [
      { id: 'fsA', family_id: 'famA', season: SEASON, status: 'applied' },
      { id: 'fsB', family_id: 'famB', season: SEASON, status: 'registered' },
    ]
    await executeFamilyMerge(makeAdminClient(tables), 'famB', 'famA', 'adm1')
    const survivor = tables.family_season.find((f: any) => f.family_id === 'famA')!
    expect(survivor.status).toBe('registered')
    expect(tables.registration_audit_log).toHaveLength(1)
    expect(tables.registration_audit_log[0]).toMatchObject({ field_changed: 'status', old_value: 'applied', new_value: 'registered' })
  })

  it("moves the source's family_season row over untouched when the target has none for that season", async () => {
    const tables = shuFixture()
    tables.family_season = [{ id: 'fsB', family_id: 'famB', season: '2025-26', status: 'registered' }]
    await executeFamilyMerge(makeAdminClient(tables), 'famB', 'famA', 'adm1')
    const moved = tables.family_season.find((f: any) => f.season === '2025-26')!
    expect(moved.family_id).toBe('famA')
    expect(moved.status).toBe('registered')
  })

  it('archives (never deletes) the source when it has signed waivers — append-only, can’t move or cascade away', async () => {
    const tables = shuFixture()
    tables.waiver_signature = [{ id: 'w1', family_id: 'famB', guardian_id: 'gB', student_id: 'sB', season: SEASON }]
    const result = await executeFamilyMerge(makeAdminClient(tables), 'famB', 'famA', 'adm1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sourceRemains).toBe('archived')
    expect(tables.family.find((f: any) => f.id === 'famB')!.status).toBe('archived')
    // The signature itself is untouched — still exists, still resolvable by student_id.
    expect(tables.waiver_signature[0].family_id).toBe('famB')
    // But everything else still moved correctly.
    expect(tables.student.find((s: any) => s.id === 'sB')!.family_id).toBe('famA')
  })

  it('rejects merging a family into itself', async () => {
    const result = await executeFamilyMerge(makeAdminClient(shuFixture()), 'famA', 'famA', 'adm1')
    expect(result.ok).toBe(false)
  })

  it('404s a nonexistent source or target', async () => {
    const tables = shuFixture()
    expect((await executeFamilyMerge(makeAdminClient(tables), 'nope', 'famA', 'adm1')).ok).toBe(false)
    expect((await executeFamilyMerge(makeAdminClient(tables), 'famB', 'nope', 'adm1')).ok).toBe(false)
  })
})
