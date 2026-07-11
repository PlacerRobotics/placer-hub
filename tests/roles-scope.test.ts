// Program-lead scoping (task 1.3 / decision D5) — pure checks in lib/auth/roles.ts.
//
// The contract: programScopeFor() is the ONLY place that decides whether an admin
// is program-limited; pages/routes pass its result to queries or programInScope().

import { describe, it, expect } from 'vitest'
import { programScopeFor, programInScope, canAccessAdmin, sectionKeyFor, type RoleGrant } from '@/lib/auth/roles'

const lead = (programScope: string | null): RoleGrant => ({ role: 'program_lead', programScope })
const reg: RoleGrant = { role: 'registration_admin', programScope: null }

const a = (grants: RoleGrant[], isSuper = false) => ({ grants, isSuper })

describe('programScopeFor', () => {
  it('limits a scoped program lead on both scoped sections, including nested paths', () => {
    const access = a([lead('combat')])
    expect(programScopeFor(access, '/admin/teams')).toEqual(['combat'])
    expect(programScopeFor(access, '/admin/teams/some-team-id')).toEqual(['combat'])
    expect(programScopeFor(access, '/admin/registrations')).toEqual(['combat'])
    expect(programScopeFor(access, '/admin/registrations/some-fs-id')).toEqual(['combat'])
  })

  it('two scoped grants union their programs', () => {
    expect(programScopeFor(a([lead('vex_v5'), lead('combat')]), '/admin/teams')).toEqual(['vex_v5', 'combat'])
  })

  it('an org-wide lead (no scope on the grant) is unrestricted', () => {
    expect(programScopeFor(a([lead(null)]), '/admin/teams')).toBeNull()
    // ...even alongside a scoped grant: the widest grant wins.
    expect(programScopeFor(a([lead('combat'), lead(null)]), '/admin/teams')).toBeNull()
  })

  it('a non-scoped section role alongside the lead grant lifts the limit', () => {
    expect(programScopeFor(a([lead('combat'), reg]), '/admin/teams')).toBeNull()
    expect(programScopeFor(a([lead('combat'), reg]), '/admin/registrations')).toBeNull()
  })

  it('super admin is never limited', () => {
    expect(programScopeFor(a([lead('combat')], true), '/admin/teams')).toBeNull()
  })

  it('non-scope-aware sections are never limited', () => {
    expect(programScopeFor(a([lead('combat')]), '/admin')).toBeNull()
    expect(programScopeFor(a([lead('combat')]), '/admin/applications')).toBeNull()
  })

  it('a scope on a non-program-scoped role is ignored, not enforced', () => {
    expect(programScopeFor(a([{ role: 'registration_admin', programScope: 'combat' }]), '/admin/teams')).toBeNull()
  })

  it('roles that do not grant the section leave scoping to canAccessAdmin', () => {
    // volunteer_admin can't open /admin/teams at all — programScopeFor stays out of it.
    expect(programScopeFor(a([{ role: 'volunteer_admin', programScope: null }]), '/admin/teams')).toBeNull()
    expect(canAccessAdmin(['volunteer_admin'], false, '/admin/teams')).toBe(false)
  })
})

describe('programInScope', () => {
  it('null scope means unrestricted', () => {
    expect(programInScope('vex_v5', null)).toBe(true)
    expect(programInScope(null, null)).toBe(true)
  })

  it("matches 'both' (vex_v5 + combat shorthand) against either program", () => {
    expect(programInScope('both', ['combat'])).toBe(true)
    expect(programInScope('both', ['vex_v5'])).toBe(true)
    expect(programInScope('both', ['vex_iq'])).toBe(false)
  })

  it('hides program-less and out-of-scope rows from scoped leads', () => {
    expect(programInScope('combat', ['combat'])).toBe(true)
    expect(programInScope('vex_iq', ['combat'])).toBe(false)
    expect(programInScope('not_sure', ['combat'])).toBe(false)
    expect(programInScope('—', ['combat'])).toBe(false)
    expect(programInScope(null, ['combat'])).toBe(false)
    expect(programInScope('', ['combat'])).toBe(false)
  })
})

describe('section routing after the 1.3 change', () => {
  it('program_lead may now open /admin/registrations (scoped there by the page)', () => {
    expect(canAccessAdmin(['program_lead'], false, '/admin/registrations')).toBe(true)
  })

  it('sectionKeyFor keeps longest-prefix behavior', () => {
    expect(sectionKeyFor('/admin/import-applicants')).toBe('/admin/import-applicants')
    expect(sectionKeyFor('/admin/import')).toBe('/admin/import')
    expect(sectionKeyFor('/admin/teams/abc')).toBe('/admin/teams')
    expect(sectionKeyFor('/admin/unknown-page')).toBe('/admin')
  })
})
