import { describe, it, expect } from 'vitest'
import { PAYMENT_TYPES, PAYMENT_SOURCES, MATCHED_STATUSES, MANUAL_PAYMENT_TYPES, MANUAL_PAYMENT_SOURCES } from '@/lib/payment-enums'

const types = PAYMENT_TYPES as readonly string[]
const sources = PAYMENT_SOURCES as readonly string[]
const matched = MATCHED_STATUSES as readonly string[]

describe('payment enum regressions (the bugs that broke manual recording)', () => {
  it("'manually_matched' is a valid matched_status; 'matched' is not", () => {
    expect(matched).toContain('manually_matched')
    expect(matched).toContain('auto_matched')
    expect(matched).not.toContain('matched')
  })
  it("'sponsorship' is the valid payment_type, not 'sponsorship_credit'", () => {
    expect(types).toContain('sponsorship')
    expect(MANUAL_PAYMENT_TYPES).toContain('sponsorship')
    expect(MANUAL_PAYMENT_TYPES).not.toContain('sponsorship_credit')
  })
  it("'corporate_platform' is the valid payment_source, not 'corporate_match'", () => {
    expect(sources).toContain('corporate_platform')
    expect(MANUAL_PAYMENT_SOURCES).toContain('corporate_platform')
    expect(MANUAL_PAYMENT_SOURCES).not.toContain('corporate_match')
  })
  it('every manual-entry value is a real Postgres enum value', () => {
    for (const t of MANUAL_PAYMENT_TYPES) expect(types).toContain(t)
    for (const s of MANUAL_PAYMENT_SOURCES) expect(sources).toContain(s)
  })
})
