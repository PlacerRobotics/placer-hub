// Shared, pure volunteer-status bucketing — safe to import from both server and
// client components (no Supabase/server imports here).
//
//  · Cleared        = everything done for the season (DOJ + APS valid through season
//                     end + both quizzes + agreements)
//  · Renewal pending = a returning volunteer (has/had an APS cert) with a season
//                     renewal outstanding — APS expiring/expired, quizzes, or agreements
//  · In progress     = new volunteer in initial setup. No APS cert ever → here.
//  · Denied / Deactivated = admin-set (from the profile status)

export type VolunteerBucket = 'cleared' | 'renewal_pending' | 'in_progress' | 'denied' | 'deactivated'
export type ApsState = 'valid' | 'expiring' | 'expired' | 'none'

export function volunteerBucket(a: {
  profileStatus: string
  doj: boolean
  apsState: ApsState
  rc: boolean
  yp: boolean
  waiver: boolean
}): VolunteerBucket {
  if (a.profileStatus === 'denied') return 'denied'
  if (a.profileStatus === 'deactivated' || a.profileStatus === 'suspended' || a.profileStatus === 'withdrawn') return 'deactivated'
  const core = a.doj && a.apsState === 'valid' && a.rc && a.yp
  if (core && a.waiver) return 'cleared'
  if (a.apsState !== 'none') return 'renewal_pending' // has/had an APS cert → renewal, not initial setup
  return 'in_progress'
}

type Variant = 'success' | 'warning' | 'info' | 'error' | 'neutral'
export const VOLUNTEER_BUCKET_META: Record<VolunteerBucket, { label: string; variant: Variant; color: string }> = {
  cleared: { label: 'Cleared', variant: 'success', color: 'var(--color-success)' },
  renewal_pending: { label: 'Renewal pending', variant: 'info', color: 'var(--color-info)' },
  in_progress: { label: 'In progress', variant: 'warning', color: '#C9971B' },
  denied: { label: 'Denied', variant: 'error', color: 'var(--color-error)' },
  deactivated: { label: 'Deactivated', variant: 'neutral', color: 'var(--color-text-muted)' },
}
