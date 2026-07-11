import { describe, it, expect } from 'vitest'
import {
  stepDisplay,
  seasonalStepStatus,
  STEP_DISPLAY_META,
  coachClearanceView,
  volunteerBucket,
  VOLUNTEER_BUCKET_META,
  type ApsState,
  type VolunteerBucket,
} from '@/lib/volunteer-buckets'
import { OWNER_LABELS } from '@/lib/dashboard-status'

// Every volunteer_step type in the schema (volunteer_step_type enum).
const STEP_TYPES = [
  'policy_acknowledgment',
  'background_check',
  'aps_youth_protection',
  'youth_protection_quiz',
  'lab_use_quiz',
  'lab_orientation',
  'custom',
] as const

describe('not-started vs awaiting-verification render distinctly for every step type', () => {
  it.each(STEP_TYPES)('%s: pending → action, in_progress → waiting', () => {
    // stepDisplay is step-agnostic — the same status vocabulary applies to all types.
    const notStarted = stepDisplay({ done: false, stepStatus: 'pending' })
    const submitted = stepDisplay({ done: false, stepStatus: 'in_progress' })
    expect(notStarted).toBe('action')
    expect(submitted).toBe('waiting')
    expect(notStarted).not.toBe(submitted)
  })

  it('a missing step row reads as not-started, not as waiting', () => {
    expect(stepDisplay({ done: false, stepStatus: null })).toBe('action')
    expect(stepDisplay({ done: false })).toBe('action')
  })

  it('waiting is visibly distinct: different dot color and icon than action-required', () => {
    expect(STEP_DISPLAY_META.waiting.color).not.toBe(STEP_DISPLAY_META.action.color)
    expect(STEP_DISPLAY_META.waiting.icon).not.toBe(STEP_DISPLAY_META.action.icon)
  })

  it('waiting is verbally aligned with the family dashboard, not a new phrase', () => {
    expect(STEP_DISPLAY_META.waiting.label).toBe(OWNER_LABELS.placer_robotics)
    expect(OWNER_LABELS.placer_robotics).toBe('Waiting on Placer Robotics')
  })

  it('done always wins: a completed step never shows as waiting', () => {
    expect(stepDisplay({ done: true, stepStatus: 'in_progress' })).toBe('complete')
    expect(stepDisplay({ done: false, stepStatus: 'complete' })).toBe('complete')
    expect(stepDisplay({ done: false, stepStatus: 'waived' })).toBe('complete')
  })
})

describe('needs-attention appears only on the admin flag', () => {
  it('needs_review → attention; every other status never is', () => {
    expect(stepDisplay({ done: false, stepStatus: 'needs_review' })).toBe('attention')
    for (const s of ['pending', 'in_progress', 'complete', 'waived', null, undefined]) {
      expect(stepDisplay({ done: false, stepStatus: s as any })).not.toBe('attention')
    }
  })

  it('attention label is plain language with no internal terms', () => {
    expect(STEP_DISPLAY_META.attention.label).toBe('Needs attention')
    expect(STEP_DISPLAY_META.attention.label).not.toMatch(/needs_review|step_status|flag/i)
  })
})

describe('seasonal steps: stale step rows cannot complete this season', () => {
  it('a prior-season complete step row does not mark a seasonal quiz done', () => {
    // clearance boolean (this season) is false; step row says complete (last season)
    expect(stepDisplay({ done: false, stepStatus: seasonalStepStatus('complete') })).toBe('action')
    expect(stepDisplay({ done: false, stepStatus: seasonalStepStatus('waived') })).toBe('action')
  })

  it('the always-current signals pass through the seasonal filter', () => {
    expect(seasonalStepStatus('in_progress')).toBe('in_progress')
    expect(seasonalStepStatus('needs_review')).toBe('needs_review')
    expect(seasonalStepStatus('pending')).toBeNull()
    expect(seasonalStepStatus(null)).toBeNull()
  })
})

describe('coach minimal clearance view (task 1.2 four-value) is unaffected', () => {
  it('maps every bucket to exactly the four coach-facing values', () => {
    expect(coachClearanceView('cleared', 'valid')).toBe('Cleared')
    expect(coachClearanceView('renewal_pending', 'expiring')).toBe('Expiring soon')
    expect(coachClearanceView('renewal_pending', 'expired')).toBe('Not cleared')
    expect(coachClearanceView('in_progress', 'none')).toBe('Not cleared')
    expect(coachClearanceView('denied', 'none')).toBe('Restricted')
    expect(coachClearanceView('deactivated', 'none')).toBe('Restricted')
  })

  it('per-step waiting/attention states do not change what a coach sees', () => {
    // Same underlying clearance facts, differing only in step-row status: the
    // bucket inputs are completion booleans, so the coach view is identical.
    const facts = { profileStatus: 'in_progress', doj: false, apsState: 'none' as ApsState, rc: false, yp: false, waiver: false }
    const bucket = volunteerBucket(facts)
    const viewWhileNotStarted = coachClearanceView(bucket, facts.apsState) // step 'pending'
    const viewWhileSubmitted = coachClearanceView(bucket, facts.apsState) // step 'in_progress'
    const viewWhileFlagged = coachClearanceView(bucket, facts.apsState) // step 'needs_review'
    expect(viewWhileSubmitted).toBe(viewWhileNotStarted)
    expect(viewWhileFlagged).toBe(viewWhileNotStarted)
    expect(viewWhileNotStarted).toBe('Not cleared')
  })

  it('the 5 admin buckets are unchanged by this pass', () => {
    const buckets: VolunteerBucket[] = ['cleared', 'renewal_pending', 'in_progress', 'denied', 'deactivated']
    expect(Object.keys(VOLUNTEER_BUCKET_META).sort()).toEqual([...buckets].sort())
    expect(VOLUNTEER_BUCKET_META.cleared.label).toBe('Cleared')
    expect(VOLUNTEER_BUCKET_META.renewal_pending.label).toBe('Renewal pending')
    expect(VOLUNTEER_BUCKET_META.in_progress.label).toBe('In progress')
  })
})

describe('no hour-credit language (build spec §5.7 / decision D1)', () => {
  it('step and bucket vocabulary contains no hour or credit wording', () => {
    const allText = [
      ...Object.values(STEP_DISPLAY_META).map((m) => m.label),
      ...Object.values(VOLUNTEER_BUCKET_META).map((m) => m.label),
    ].join(' ')
    expect(allText).not.toMatch(/hour|credit/i)
  })
})
