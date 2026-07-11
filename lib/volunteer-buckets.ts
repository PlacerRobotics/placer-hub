// Shared, pure volunteer-status bucketing — safe to import from both server and
// client components (no Supabase/server imports here).
//
//  · Cleared        = everything done for the season (DOJ + APS valid through season
//                     end + both quizzes + agreements)
//  · Renewal pending = a returning volunteer (has/had an APS cert) with a season
//                     renewal outstanding — APS expiring/expired, quizzes, or agreements
//  · In progress     = new volunteer in initial setup. No APS cert ever → here.
//  · Denied / Deactivated = admin-set (from the profile status)

import { OWNER_LABELS } from './dashboard-status'

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

// ── Per-step display state (build spec §2.4 parity for the volunteer portal) ──
//
// volunteer_step.status vocabulary: 'pending' = the volunteer hasn't started,
// 'in_progress' = submitted / Placer Robotics is processing, 'needs_review' =
// admin-set exception flag (migration 0046), 'complete'/'waived' = done.
// stepDisplay() folds that with the season-clearance completion boolean so
// "not started" and "submitted, awaiting verification" never share a state.

export type StepDisplay = 'complete' | 'action' | 'waiting' | 'attention'

export function stepDisplay(a: { done: boolean; stepStatus?: string | null }): StepDisplay {
  if (a.done || a.stepStatus === 'complete' || a.stepStatus === 'waived') return 'complete'
  if (a.stepStatus === 'needs_review') return 'attention'
  if (a.stepStatus === 'in_progress') return 'waiting'
  return 'action'
}

// volunteer_step is NOT season-scoped (unique volunteer_id+step), but quizzes and
// the annual agreements renew every season. For those, completion must come from
// the season-scoped volunteer_clearance booleans only — a stale 'complete' step
// row from a prior season must not mark this season's item done. This filter keeps
// just the signals that are always current (submitted / admin-flagged).
export function seasonalStepStatus(s?: string | null): string | null {
  return s === 'in_progress' || s === 'needs_review' ? s : null
}

// Wording is shared with the family dashboard (OWNER_LABELS) — one vocabulary.
export const STEP_DISPLAY_META: Record<StepDisplay, { label: string; color: string; icon: string }> = {
  complete: { label: 'Complete', color: 'var(--color-success)', icon: '✓' },
  action: { label: OWNER_LABELS.you, color: 'var(--color-error)', icon: '○' },
  waiting: { label: OWNER_LABELS.placer_robotics, color: 'var(--color-info, #1E40AF)', icon: '◷' },
  attention: { label: 'Needs attention', color: 'var(--color-error)', icon: '!' },
}

// ── Coach-facing minimal clearance view (task 1.2 contract) ──────────────────
//
// Coaches see exactly four values and nothing about individual steps, so the
// per-step waiting/attention states above cannot leak into this view — it is
// derived only from the bucket + APS state.

export type CoachClearance = 'Cleared' | 'Not cleared' | 'Expiring soon' | 'Restricted'

export function coachClearanceView(bucket: VolunteerBucket, apsState: ApsState): CoachClearance {
  if (bucket === 'denied' || bucket === 'deactivated') return 'Restricted'
  if (bucket === 'cleared') return 'Cleared'
  if (bucket === 'renewal_pending' && apsState === 'expiring') return 'Expiring soon'
  return 'Not cleared'
}
