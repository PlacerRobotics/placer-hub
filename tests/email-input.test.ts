import { describe, it, expect } from 'vitest'
import { cleanEmail, isLikelyEmail } from '@/lib/email-input'

describe('cleanEmail', () => {
  it('strips a mailto: prefix — the reported incident', () => {
    expect(cleanEmail('mailto:jose.chavez01@libertymutual.com')).toBe('jose.chavez01@libertymutual.com')
    expect(cleanEmail('MAILTO:Jose@Ex.com')).toBe('jose@ex.com')
  })

  it('strips a "Name <email>" wrapper from a copied contact card', () => {
    expect(cleanEmail('Jose Chavez <jose.chavez01@libertymutual.com>')).toBe('jose.chavez01@libertymutual.com')
    expect(cleanEmail('<jose@ex.com>')).toBe('jose@ex.com')
  })

  it('trims and lowercases plain input unchanged (behavior-preserving for clean input)', () => {
    expect(cleanEmail('  Ann@Ex.com  ')).toBe('ann@ex.com')
  })

  it('handles null/undefined/empty', () => {
    expect(cleanEmail(null)).toBe('')
    expect(cleanEmail(undefined)).toBe('')
    expect(cleanEmail('')).toBe('')
    expect(cleanEmail('   ')).toBe('')
  })

  it('a mailto: prefix inside a name-wrapper is cleaned in one pass', () => {
    expect(cleanEmail('<mailto:ann@ex.com>')).toBe('ann@ex.com')
  })
})

describe('isLikelyEmail', () => {
  it('accepts a clean email and rejects a mailto:-prefixed one', () => {
    expect(isLikelyEmail('ann@ex.com')).toBe(true)
    expect(isLikelyEmail('mailto:ann@ex.com')).toBe(false)
  })
})
