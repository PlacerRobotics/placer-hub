import { describe, it, expect } from 'vitest'
import { cleanPhone, isValidPhone, formatPhoneDisplay } from '@/lib/phone-input'

describe('cleanPhone', () => {
  it('normalizes a bare US number to E.164, defaulting the country code to +1', () => {
    expect(cleanPhone('650-555-1234')).toBe('+16505551234')
    expect(cleanPhone('(650) 555-1234')).toBe('+16505551234')
    expect(cleanPhone('650.555.1234')).toBe('+16505551234')
    expect(cleanPhone('6505551234')).toBe('+16505551234')
    expect(cleanPhone('1 650 555 1234')).toBe('+16505551234')
  })

  it('trusts an explicit + country code instead of forcing US', () => {
    expect(cleanPhone('+52 55 1234 5678')).toBe('+525512345678')
    expect(cleanPhone('+44 20 7946 0958')).toBe('+442079460958')
  })

  it('is idempotent — cleaning an already-clean E.164 value returns it unchanged', () => {
    expect(cleanPhone('+16505551234')).toBe('+16505551234')
  })

  it('empty input stays empty', () => {
    expect(cleanPhone('')).toBe('')
    expect(cleanPhone(null)).toBe('')
    expect(cleanPhone(undefined)).toBe('')
    expect(cleanPhone('   ')).toBe('')
  })

  it('falls back to a digit-preserving clean for unparseable input rather than discarding it', () => {
    // Too short to be a real number, but a human should still see what was typed.
    expect(cleanPhone('12345')).toBe('12345')
    expect(cleanPhone('call me')).toBe('call me')
  })
})

describe('isValidPhone', () => {
  it('accepts plausible US numbers in any punctuation', () => {
    expect(isValidPhone('650-555-1234')).toBe(true)
    expect(isValidPhone('(650) 555-1234')).toBe(true)
    expect(isValidPhone('6505551234')).toBe(true)
  })

  it('accepts a valid international number', () => {
    expect(isValidPhone('+52 55 1234 5678')).toBe(true)
  })

  it('rejects empty and obviously-not-a-phone-number input', () => {
    expect(isValidPhone('')).toBe(false)
    expect(isValidPhone(null)).toBe(false)
    expect(isValidPhone('asdf')).toBe(false)
    expect(isValidPhone('123')).toBe(false)
  })

  it('does not hard-reject a short-but-plausible number libphonenumber flags as merely "not possible" for the assumed region', () => {
    // 7 digits, no country code — too short to be a valid US number, but this
    // is exactly the "don't block a real family over an edge case" case: the
    // >=7-digit fallback in isValidPhone accepts it rather than bouncing the
    // registration. It only fails the stricter parsed.isPossible() check.
    expect(isValidPhone('1234567')).toBe(true)
  })
})

describe('formatPhoneDisplay', () => {
  it('formats a US E.164 value as a national-style number', () => {
    expect(formatPhoneDisplay('+16505551234')).toBe('(650) 555-1234')
  })

  it('formats a non-US E.164 value in international style', () => {
    expect(formatPhoneDisplay('+525512345678')).toBe('+52 55 1234 5678')
  })

  it('returns unparseable or empty input unchanged', () => {
    expect(formatPhoneDisplay('not a phone')).toBe('not a phone')
    expect(formatPhoneDisplay('')).toBe('')
    expect(formatPhoneDisplay(null)).toBe('')
  })
})
