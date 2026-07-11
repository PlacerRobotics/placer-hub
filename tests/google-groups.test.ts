// Google Groups reconciliation (task 1.8) — pure logic in lib/google-groups.ts.

import { describe, it, expect } from 'vitest'
import { extractEmails, reconcileGroup, type HubEmailOwner } from '@/lib/google-groups'

const hub = (email: string, owner = 'Someone', kind = 'guardian login'): HubEmailOwner => ({ email, owner, kind })

describe('extractEmails', () => {
  it('parses a Google Groups CSV export', () => {
    const csv = `Email address,Nickname,Group status,Email status
ann@ex.com,,member,
Bob.Beta@Ex.com,Bob,member,
not-an-email-row,,,`
    expect(extractEmails(csv)).toEqual(['ann@ex.com', 'bob.beta@ex.com'])
  })

  it('handles plain lists, dedupes, and lowercases', () => {
    expect(extractEmails('A@ex.com, b@ex.com\n a@EX.com')).toEqual(['a@ex.com', 'b@ex.com'])
    expect(extractEmails("o'brien@ex.com works")).toEqual(["o'brien@ex.com"])
    expect(extractEmails('nothing here')).toEqual([])
  })
})

describe('reconcileGroup', () => {
  it('produces the three buckets', () => {
    const r = reconcileGroup(
      ['match@ex.com', 'stranger@ex.com'],
      [hub('match@ex.com', 'Ann Alpha'), hub('absent@ex.com', 'Bob Beta')],
    )
    expect(r.matched).toEqual([{ email: 'match@ex.com', owner: 'Ann Alpha', kind: 'guardian login' }])
    expect(r.inGroupNotHub).toEqual(['stranger@ex.com'])
    expect(r.inHubNotGroup).toEqual([{ email: 'absent@ex.com', owner: 'Bob Beta', kind: 'guardian login' }])
  })

  it('is case-insensitive and dedupes repeated hub emails', () => {
    const r = reconcileGroup(
      ['Parent@Ex.com'],
      [hub('parent@ex.com', 'Ann', 'guardian login'), hub('PARENT@ex.com', 'Ann', 'guardian communication')],
    )
    expect(r.matched).toHaveLength(1)
    expect(r.inHubNotGroup).toEqual([])
    expect(r.inGroupNotHub).toEqual([])
  })

  it('buckets come out sorted for stable display/CSV', () => {
    const r = reconcileGroup(['z@ex.com', 'a@ex.com'], [])
    expect(r.inGroupNotHub).toEqual(['a@ex.com', 'z@ex.com'])
  })
})
