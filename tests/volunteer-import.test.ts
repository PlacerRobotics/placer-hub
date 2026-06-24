import { describe, it, expect } from 'vitest'
import { normalizeVolunteerRow } from '@/lib/volunteer-import'

// A representative row from the "Current Reg'd Users" Google Form export.
const base: Record<string, string> = {
  'First Name': 'Rajani',
  'Last Name': 'Abraham',
  'Email Address': 'rajaniaby@gmail.com',
  'Cell Phone': '(408) 368-2159',
  'RC Quiz': '9/18/2024',
  'AB506 YP Quiz': '9/21/2024',
  'DOJ Clear': 'Yes',
  'Certificate Expiration Date': '09-18-2026',
  'Ready to Approve': 'Yes',
  'IQ Team': '',
  'V5 Team': '9537R',
  'Are you a V5 Coach?': 'Primary Coach',
}

describe('normalizeVolunteerRow', () => {
  it('maps the form headers onto canonical fields', () => {
    const r = normalizeVolunteerRow(base)
    expect(r.first_name).toBe('Rajani')
    expect(r.last_name).toBe('Abraham')
    expect(r.email).toBe('rajaniaby@gmail.com')
    expect(r.phone).toBe('(408) 368-2159')
    expect(r.aps_cert_expiry).toBe('09-18-2026')
  })

  it('treats a quiz completion DATE as passed (not yes/no in this CSV)', () => {
    const r = normalizeVolunteerRow(base)
    expect(r.rc_quiz_passed).toBe('yes')
    expect(r.rc_quiz_passed_date).toBe('9/18/2024')
    expect(r.yp_quiz_passed).toBe('yes')
    expect(r.yp_quiz_passed_date).toBe('9/21/2024')
  })

  it('an empty quiz cell is not passed', () => {
    expect(normalizeVolunteerRow({ ...base, 'RC Quiz': '' }).rc_quiz_passed).toBe('')
  })

  it('DOJ: a value means cleared; empty or No does not', () => {
    expect(normalizeVolunteerRow(base).doj_cleared).toBe('yes')
    expect(normalizeVolunteerRow({ ...base, 'DOJ Clear': '' }).doj_cleared).toBe('')
    expect(normalizeVolunteerRow({ ...base, 'DOJ Clear': 'No' }).doj_cleared).toBe('')
  })

  it('approved comes from "Ready to Approve" OR "Approved!"', () => {
    expect(normalizeVolunteerRow(base).approved).toBe('yes')
    expect(normalizeVolunteerRow({ ...base, 'Ready to Approve': '', 'Approved!': 'Yes' }).approved).toBe('yes')
    expect(normalizeVolunteerRow({ ...base, 'Ready to Approve': '', 'Approved!': '' }).approved).toBe('')
  })

  it('does NOT import programs or role (owned by registration + Teams)', () => {
    const r = normalizeVolunteerRow(base)
    expect(r.programs).toBeUndefined()
    expect(r.primary_role).toBeUndefined()
  })

  it('missing optional columns degrade to empty strings, never throw', () => {
    const r = normalizeVolunteerRow({ 'First Name': 'A', 'Last Name': 'B', 'Email Address': 'a@b.com' })
    expect(r.aps_cert_expiry).toBe('')
    expect(r.rc_quiz_passed).toBe('')
    expect(r.doj_cleared).toBe('')
    expect(r.approved).toBe('')
  })
})
