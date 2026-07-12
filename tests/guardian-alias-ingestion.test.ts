// Regression coverage for the root cause behind the mailto:/duplicate-family
// incidents (docs/design_email_identity_v1_0.md §1): a known-alternate email
// (an APS-era yahoo, a former login) must resolve to the REAL family at every
// ingestion point instead of minting a duplicate. This drives the actual
// production code path — lib/iq-team.ts addIqMembers, the IQ roster-add flow
// that created the Barrera/Chavez duplicates — via the in-memory mock.

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { addIqMembers } from '@/lib/iq-team'

function fixture(): Tables {
  return {
    guardian: [{ id: 'gReal', family_id: 'famReal', first_name: 'Esperanza', last_name: 'Barrera', login_email: 'barrera.esperanza@gmail.com', phone: '' }],
    guardian_email_alias: [{ id: 'a1', guardian_id: 'gReal', email: 'barrera.old@yahoo.com', source: 'aps_legacy' }],
    family: [{ id: 'famReal', primary_email: 'barrera.esperanza@gmail.com' }],
    family_season: [{ id: 'fs1', family_id: 'famReal', season: '2026-27', status: 'applied' }],
    student: [],
    student_application: [],
  }
}

describe('IQ roster-add resolves a known-alternate email to the real family (no duplicate)', () => {
  it('a parent email that only matches an alias attaches the student to the REAL family', async () => {
    const tables = fixture()
    const db = makeAdminClient(tables)
    const before = tables.family.length

    await addIqMembers(db, {
      teamId: 'team1',
      teamStatus: 'active',
      coachFamilyId: 'famCoach',
      coachEmail: 'coach@ex.com',
      coachLast: 'coach',
      roster: [{ student_first: 'Raj', student_last: 'Barrera', grade: '6', parent_email: 'barrera.old@yahoo.com', parent_first: 'Esperanza', parent_last: 'Barrera' }],
    })

    // No new family was minted — the exact bug this closes.
    expect(tables.family.length).toBe(before)
    const student = tables.student.find((s: any) => s.first_name === 'Raj')!
    expect(student.family_id).toBe('famReal')
  })

  it('an email with no match anywhere still creates a new family (unchanged behavior)', async () => {
    const tables = fixture()
    const db = makeAdminClient(tables)
    const before = tables.family.length

    await addIqMembers(db, {
      teamId: 'team1',
      teamStatus: 'active',
      coachFamilyId: 'famCoach',
      coachEmail: 'coach@ex.com',
      coachLast: 'coach',
      roster: [{ student_first: 'New', student_last: 'Family', grade: '6', parent_email: 'brand.new@ex.com', parent_first: 'Some', parent_last: 'Family' }],
    })

    expect(tables.family.length).toBe(before + 1)
    const student = tables.student.find((s: any) => s.first_name === 'New')!
    const newFamily = tables.family.find((f: any) => f.id === student.family_id)!
    expect(newFamily.primary_email).toBe('brand.new@ex.com')
  })
})
