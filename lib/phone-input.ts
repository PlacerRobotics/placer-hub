// Phone number normalization + validation — pure, tested in tests/phone-input.test.ts.
//
// Storage format: E.164 (e.g. "+16505551234") in the EXISTING `phone` text
// columns (guardian, student, emergency_contact, sponsor.contact_phone) — no
// schema change. E.164 already carries the country code, which is exactly what
// "add a country code, default to US" means in practice: a bare 10-digit number
// (however it's punctuated — dashes, parens, dots, spaces) is assumed US ("+1")
// unless the caller supplies their own "+<country code>" prefix, which is
// trusted and parsed as that country.
//
// Validation philosophy matches the rest of this codebase's loose, non-blocking
// checks (e.g. the email field only requires `.includes('@')`, not full RFC
// validation — see app/api/admin/families/[id]/change-email/route.ts). A phone
// number that libphonenumber-js can't validate as strictly correct (VOIP,
// Google Voice, and some legitimate edge cases fail strict national rules) is
// NOT hard-rejected — only inputs too short/garbled to plausibly be a phone
// number are. Registration must never block a real family over an edge case in
// a phone validator; the goal is clean, consistent data, not a hard gate.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

const DEFAULT_COUNTRY: CountryCode = 'US'

// Best-effort normalize to E.164. Empty input stays empty (required-ness is the
// caller's job — see isValidPhone). Unparseable-but-present input falls back to
// a light digit-preserving clean (not stored as garbage, not silently dropped)
// so a human reviewing the record can still recognize and fix it by hand.
export function cleanPhone(raw: string | null | undefined, defaultCountry: CountryCode = DEFAULT_COUNTRY): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  // parsePhoneNumberFromString will construct a PhoneNumber for almost any
  // digit string once a default region is given (e.g. "12345" → "+112345") —
  // isPossible() is the real gate for "this is plausibly a phone number", not
  // mere parse success. Trust the E.164 result only past that gate.
  const parsed = parsePhoneNumberFromString(s, defaultCountry)
  if (parsed?.isPossible()) return parsed.number // E.164, e.g. "+16505551234"
  // Fallback: keep only phone-shaped characters (digits and a leading +).
  const digits = s.replace(/[^\d+]/g, '')
  return digits || s.trim()
}

// Loose sanity check — true unless the input is too short/garbled to plausibly
// be a phone number. Deliberately NOT libphonenumber-js's strict `isValid()`
// (see file header) — that would reject real numbers (VOIP, some mobile
// carriers, temporarily-abroad families) that this org has no business turning
// away at the registration form.
export function isValidPhone(raw: string | null | undefined, defaultCountry: CountryCode = DEFAULT_COUNTRY): boolean {
  const s = (raw ?? '').trim()
  if (!s) return false
  const parsed = parsePhoneNumberFromString(s, defaultCountry)
  if (parsed?.isPossible()) return true
  // Not "possible" by libphonenumber's rules (or didn't parse at all) — still
  // accept anything with at least 7 digits (shortest plausible local number)
  // rather than hard-rejecting an edge case a real family could legitimately
  // have. Only genuinely digit-sparse input ("asdf", "123") fails this.
  return (s.match(/\d/g) ?? []).length >= 7
}

// Display formatting for an E.164-stored (or legacy raw) value. US numbers
// render as "(650) 555-1234"; anything else renders in its international
// format; anything unparseable is returned unchanged.
export function formatPhoneDisplay(stored: string | null | undefined): string {
  const s = (stored ?? '').trim()
  if (!s) return ''
  const parsed = parsePhoneNumberFromString(s, DEFAULT_COUNTRY)
  if (!parsed) return s
  return parsed.country === 'US' ? parsed.formatNational() : parsed.formatInternational()
}
