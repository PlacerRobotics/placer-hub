import { describe, it, expect } from 'vitest'
import { ageFromDob, isUnder13, needsCoppa, isSchoolDomain } from '@/lib/compliance'

const NOW = new Date(2026, 5, 23) // 2026-06-23 (local, unambiguous)

describe('ageFromDob', () => {
  it('computes age relative to now', () => {
    expect(ageFromDob('2014-06-10', NOW)).toBe(12)
    expect(ageFromDob('2010-06-10', NOW)).toBe(16)
  })
  it('subtracts a year when the birthday has not happened yet', () => {
    expect(ageFromDob('2014-12-01', NOW)).toBe(11)
  })
  it('returns null for empty/invalid input', () => {
    expect(ageFromDob('', NOW)).toBeNull()
    expect(ageFromDob('not-a-date', NOW)).toBeNull()
  })
})

describe('isUnder13', () => {
  it('12 → true, 13 → false, null → false', () => {
    expect(isUnder13(12)).toBe(true)
    expect(isUnder13(13)).toBe(false)
    expect(isUnder13(null)).toBe(false)
  })
})

describe('needsCoppa (grade 6/7 OR under 13)', () => {
  it('grade 6 → true', () => expect(needsCoppa(6, 11)).toBe(true))
  it('grade 7 → true', () => expect(needsCoppa(7, 13)).toBe(true))
  it('grade 8, age 14 → false', () => expect(needsCoppa(8, 14)).toBe(false))
  it('under 13 regardless of grade → true', () => expect(needsCoppa(8, 12)).toBe(true))
  it('grade 9, unknown age → false', () => expect(needsCoppa(9, null)).toBe(false))
})

describe('isSchoolDomain (warning matcher)', () => {
  it('flags k12.ca.us', () => expect(isSchoolDomain('a@students.rocklin.k12.ca.us')).toBe(true))
  it('flags .edu', () => expect(isSchoolDomain('a@foo.edu')).toBe(true))
  it('flags *usd* district domains', () => expect(isSchoolDomain('a@rocklinusd.org')).toBe(true))
  it('flags @student.*', () => expect(isSchoolDomain('a@student.foo.org')).toBe(true))
  it('allows a personal email', () => expect(isSchoolDomain('a@gmail.com')).toBe(false))
  it('returns false for a non-email', () => expect(isSchoolDomain('notanemail')).toBe(false))
})
