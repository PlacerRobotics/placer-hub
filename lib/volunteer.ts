import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const VOLUNTEER_SEASON = '2026-27'
// APS certificates must be valid through the end of the season.
export const APS_VALID_THROUGH = '2027-05-31'

// Volunteers acknowledge & sign the same agreements families do — EXCEPT the
// Student & Family Expectations (which is student-facing). Order shown to the user:
//  1. Release of Liability (student_participation, same as guardians)
//  2. Robotics Center Use — Summary of Key Policies (center_use_summary)
//  3. Youth Protection & Abuse Prevention Summary (youth_protection_summary)
//  4. Registered Volunteer Agreement (volunteer)
export const VOLUNTEER_WAIVER_TYPES = [
  'student_participation',
  'center_use_summary',
  'youth_protection_summary',
  'volunteer',
] as const

// Shown for awareness on the volunteer waiver page, but NOT required to sign.
export const VOLUNTEER_REMINDER_TYPES = ['expectations_agreement'] as const

export type CurrentVolunteer = {
  profileId: string
  status: string
  guardianId: string
  familyId: string
  firstName: string
  lastName: string
  name: string
  email: string
}

/**
 * Resolve the signed-in user to their volunteer_profile (guardian-linked).
 * Returns null if not signed in or not a volunteer. Uses the service-role client
 * for the lookups after authenticating via the session.
 */
export async function getCurrentVolunteer(): Promise<CurrentVolunteer | null> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return null
  const db = createAdminClient()
  const { data: g } = await db.from('guardian').select('id, family_id, first_name, last_name, login_email').ilike('login_email', user.email).maybeSingle()
  if (!g) return null
  const { data: vp } = await db.from('volunteer_profile').select('id, status').eq('guardian_id', g.id).maybeSingle()
  if (!vp) return null
  const firstName = g.first_name ?? ''
  const lastName = g.last_name ?? ''
  return { profileId: vp.id, status: vp.status, guardianId: g.id, familyId: g.family_id, firstName, lastName, name: `${firstName} ${lastName}`.trim(), email: g.login_email }
}

/** Get (or create) the per-season clearance row for a volunteer. */
export async function ensureClearance(db: any, volunteerId: string, season = VOLUNTEER_SEASON) {
  const { data } = await db.from('volunteer_clearance').select('*').eq('volunteer_id', volunteerId).eq('season', season).maybeSingle()
  if (data) return data
  const { data: created } = await db
    .from('volunteer_clearance')
    .insert({ volunteer_id: volunteerId, season, status: 'in_progress' })
    .select('*')
    .single()
  return created
}
