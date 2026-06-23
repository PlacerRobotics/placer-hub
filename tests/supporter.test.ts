import { describe, it, expect } from 'vitest'
import { supporterLevel } from '@/lib/supporter'

describe('supporterLevel tiers', () => {
  it('>= 1040 → Champion', () => {
    expect(supporterLevel(1040)).toBe('Champion')
    expect(supporterLevel(2000)).toBe('Champion')
  })
  it('>= 790 → Standard', () => {
    expect(supporterLevel(790)).toBe('Standard')
    expect(supporterLevel(1039)).toBe('Standard')
  })
  it('>= 590 → Minimum', () => {
    expect(supporterLevel(590)).toBe('Minimum')
    expect(supporterLevel(789)).toBe('Minimum')
  })
  it('< 590 → null', () => {
    expect(supporterLevel(589)).toBeNull()
    expect(supporterLevel(0)).toBeNull()
  })
})
