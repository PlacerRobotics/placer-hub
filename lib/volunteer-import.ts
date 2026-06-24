// Volunteer-registration CSV → canonical import fields. Kept pure (no UI/server
// deps) so it can be unit-tested and shared by the preview + the POST payload.
export type CsvRow = Record<string, string>

export const isYes = (v: unknown) => ['yes', 'true', 'y', '1', 'x'].includes(String(v ?? '').trim().toLowerCase())
const isNo = (v: string) => ['', 'no', 'n', 'false', '0'].includes(v.trim().toLowerCase())

// Direct header → canonical-field renames for the volunteer registration CSV.
const DIRECT: Record<string, string> = {
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Email Address': 'email',
  'Cell Phone': 'phone',
  'Street Address': 'street_address',
  'City': 'city',
  'State / Province': 'state',
  'Postal / Zip Code': 'zip',
  'APS UserID': 'aps_user_id',
  'APS ExternalID': 'aps_external_id',
  'APS Score': 'aps_score',
  'APS Cert Link': 'aps_cert_url',
  'Certificate Expiration Date': 'aps_cert_expiry',
}

// Map a raw CSV row (keyed by the form's column headers) to the canonical fields the
// preview + import API expect. Quizzes/DOJ store completion DATES in this CSV, so
// "has a value" means complete. Programs/role/team-coaching are intentionally NOT
// imported here — those are owned by registration + Teams; this is identity + clearance.
export function normalizeVolunteerRow(raw: CsvRow): CsvRow {
  const v = (k: string) => (raw[k] ?? '').trim()
  const o: CsvRow = {}
  for (const [csv, key] of Object.entries(DIRECT)) o[key] = v(csv)

  const rc = v('RC Quiz'); o.rc_quiz_passed = rc ? 'yes' : ''; o.rc_quiz_passed_date = rc
  const yp = v('AB506 YP Quiz'); o.yp_quiz_passed = yp ? 'yes' : ''; o.yp_quiz_passed_date = yp
  o.doj_cleared = isNo(v('DOJ Clear')) ? '' : 'yes'
  o.approved = (isYes(v('Approved!')) || isYes(v('Ready to Approve'))) ? 'yes' : ''
  o.is_returning = v('Are you a returning volunteer')
  o.has_door_access = v('Do you currently have robotics center door access via card or app?')
  return o
}
