import { describe, it, expect } from 'vitest'
import { editDistance, emailDomain, nearMissDomain, findDuplicateGroups } from '@/lib/duplicates'

const g = (id: string, family_id: string, first: string, last: string, email: string) => ({
  id,
  family_id,
  first_name: first,
  last_name: last,
  login_email: email,
})

describe('editDistance (OSA / restricted Damerau-Levenshtein)', () => {
  it('is 0 for identical strings', () => {
    expect(editDistance('gmail.com', 'gmail.com')).toBe(0)
  })
  it('counts a deletion as 1 (hotmil → hotmail)', () => {
    expect(editDistance('hotmil.com', 'hotmail.com')).toBe(1)
  })
  it('counts an adjacent transposition as 1 (gamil → gmail)', () => {
    expect(editDistance('gamil.com', 'gmail.com')).toBe(1)
  })
  it('counts a substitution as 1', () => {
    expect(editDistance('gnail.com', 'gmail.com')).toBe(1)
  })
  it('is >1 for unrelated domains', () => {
    expect(editDistance('aol.com', 'gmail.com')).toBeGreaterThan(1)
  })
})

describe('emailDomain', () => {
  it('extracts and lowercases the domain', () => {
    expect(emailDomain('Terry@Strategicwealthlegal.COM')).toBe('strategicwealthlegal.com')
  })
  it('returns null when there is no @', () => {
    expect(emailDomain('not-an-email')).toBeNull()
  })
})

describe('nearMissDomain', () => {
  it('flags hotmil.com as a near-miss of hotmail.com', () => {
    expect(nearMissDomain('angela_romero@hotmil.com')).toEqual({ domain: 'hotmil.com', suggestion: 'hotmail.com' })
  })
  it('flags gamil.com (transposition) as a near-miss of gmail.com', () => {
    expect(nearMissDomain('someone@gamil.com')).toEqual({ domain: 'gamil.com', suggestion: 'gmail.com' })
  })
  it('does not flag exact common domains', () => {
    expect(nearMissDomain('someone@hotmail.com')).toBeNull()
    expect(nearMissDomain('someone@gmail.com')).toBeNull()
  })
  it('does not flag one common provider as a typo of another', () => {
    // me.com ↔ msn.com etc. must not cross-flag; exact members are exempt.
    expect(nearMissDomain('someone@me.com')).toBeNull()
    expect(nearMissDomain('someone@live.com')).toBeNull()
  })
  it('does not flag unrelated org domains', () => {
    expect(nearMissDomain('terry@strategicwealthlegal.com')).toBeNull()
  })
})

describe('findDuplicateGroups', () => {
  it('finds the same name across two families with different emails (Wheeler pattern 1)', () => {
    const groups = findDuplicateGroups([
      g('1', 'famA', 'Terry', 'Wheeler', 'terry@strategicwealthlegal.com'),
      g('2', 'famB', 'Terry', 'Wheeler', 'twheeler68@aol.com'),
      g('3', 'famC', 'Dana', 'Smith', 'dana@example.com'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].displayName).toBe('Terry Wheeler')
    expect(groups[0].crossFamily).toBe(true)
    expect(groups[0].familyIds.sort()).toEqual(['famA', 'famB'])
  })

  it('finds the same name twice within one family with different emails (Wheeler pattern 2)', () => {
    const groups = findDuplicateGroups([
      g('1', 'famA', 'Angela', 'Romero', 'angela_romero@hotmil.com'),
      g('2', 'famA', 'Angela', 'Romero', 'angela_romero@hotmail.com'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].crossFamily).toBe(false)
    expect(groups[0].guardians).toHaveLength(2)
  })

  it('matches names case- and whitespace-insensitively', () => {
    const groups = findDuplicateGroups([
      g('1', 'famA', ' terry ', 'WHEELER', 'a@x.com'),
      g('2', 'famB', 'Terry', 'Wheeler', 'b@y.com'),
    ])
    expect(groups).toHaveLength(1)
  })

  it('ignores same-name guardians whose emails match (single identity, no dup)', () => {
    const groups = findDuplicateGroups([
      g('1', 'famA', 'Terry', 'Wheeler', 'terry@aol.com'),
      g('2', 'famB', 'Terry', 'Wheeler', 'Terry@AOL.com'),
    ])
    expect(groups).toHaveLength(0)
  })

  it('ignores guardians with blank name components', () => {
    const groups = findDuplicateGroups([
      g('1', 'famA', '', 'Wheeler', 'a@x.com'),
      g('2', 'famB', ' ', 'Wheeler', 'b@y.com'),
    ])
    expect(groups).toHaveLength(0)
  })
})
