/**
 * Family-dashboard status derivation — pure, shared, tested (tests/dashboard-status.test.ts).
 *
 * Extends the binary done/todo model with two user-facing states (build spec §2.4):
 *  · 'waiting'   — in process at Placer Robotics; NO family action possible
 *                  (application under review, payment reconciliation, team placement).
 *                  Never rendered as ✗ and never listed in the "What's next" to-dos.
 *  · 'attention' — exception surfaced ONLY when an admin has flagged the record
 *                  (application needs_follow_up, waiver needs_review, payment
 *                  needs_review). Plain language + a contact path, no internal terms.
 *
 * The owner vocabulary is shared with components/ui/StepChecklist.tsx — one
 * definition, no parallel labels.
 */

export const OWNER_LABELS = {
  you: 'Your action needed',
  placer_robotics: 'Waiting on Placer Robotics',
  system: 'Automated',
} as const

export type CheckState = 'done' | 'todo' | 'waiting' | 'attention' | 'na'

// Glyph + color per state. 'waiting' deliberately reuses StepChecklist's
// in-progress clock — admin processing must not read as the family's failure (✗).
export const CHECK_META: Record<CheckState, { glyph: string; color: string }> = {
  done: { glyph: '✓', color: 'var(--color-success)' },
  todo: { glyph: '✗', color: '#C9971B' },
  waiting: { glyph: '◷', color: 'var(--color-info, #1E40AF)' },
  attention: { glyph: '!', color: 'var(--color-error)' },
  na: { glyph: '–', color: 'var(--color-text-muted)' },
}

export type StudentBadge = 'ready' | 'in_progress' | 'waiting' | 'attention'

export const BADGE_META: Record<StudentBadge, { label: string; variant: 'success' | 'warning' | 'info' | 'error' }> = {
  ready: { label: 'Ready', variant: 'success' },
  in_progress: { label: 'In progress', variant: 'warning' },
  waiting: { label: OWNER_LABELS.placer_robotics, variant: 'info' },
  attention: { label: 'Needs attention', variant: 'error' },
}

export type StudentStatusInput = {
  firstName: string
  isIqKid: boolean
  /** family_season.status is cleared_to_register or registered */
  familyCleared: boolean
  hasApplication: boolean
  /** admin flag: student_application.application_status === 'needs_follow_up' */
  applicationFlagged: boolean
  registered: boolean
  signed: boolean
  hasEnrollment: boolean
  feeUnpaid: boolean
  feeWaived: boolean
  /** admin flag: any enrollment.waiver_status === 'needs_review' */
  waiverFlagged: boolean
  hasTeam: boolean
  teamProvisional: boolean
  /** display label when a team is assigned (already family-safe) */
  teamLabel: string
  /** family has a captured-but-unreconciled payment while the fee reads unpaid */
  paymentPendingReconciliation: boolean
  /** admin flag: a family payment has matched_status === 'needs_review' */
  paymentFlagged: boolean
  /** e.g. 'Paid · Champion' — display value for the paid state */
  paidLabel?: string | null
}

export type Check = { cap: string; val: string; state: CheckState }

export type StudentStatus = {
  checks: Check[]
  badge: StudentBadge
  /** all family-action items resolved and nothing waiting/flagged */
  ready: boolean
  /** plain-language lines for the muted "In process at Placer Robotics" group */
  waitingItems: string[]
  /** plain-language lines for the admin-flagged "Needs attention" callout */
  attentionItems: string[]
  /** which "What's next" to-dos apply — waiting/attention items never do */
  familyActions: { registration: boolean; payment: boolean }
}

export function deriveStudentStatus(s: StudentStatusInput): StudentStatus {
  const waitingItems: string[] = []
  const attentionItems: string[] = []

  let checks: Check[]
  let familyActions = { registration: false, payment: false }

  if (s.isIqKid) {
    // IQ kids join through the coach flow — registration + fee are team-level.
    checks = [
      { cap: 'Registration', val: 'Team-managed', state: 'na' },
      { cap: 'Waivers', val: s.signed ? 'Signed' : 'Not signed', state: s.waiverFlagged ? 'attention' : s.signed ? 'done' : 'todo' },
      { cap: 'Payment', val: 'Team fee', state: 'na' },
      { cap: 'Team', val: s.teamLabel || 'Assigned', state: 'done' },
    ]
  } else {
    // Registration — before the family is cleared there is nothing they can do:
    // the application sits with Placer Robotics for review.
    let reg: Check
    if (s.registered) reg = { cap: 'Registration', val: 'Complete', state: 'done' }
    else if (!s.familyCleared && s.hasApplication) {
      reg = { cap: 'Registration', val: 'Under review', state: 'waiting' }
      waitingItems.push(`${s.firstName}’s application is being reviewed — we’ll email you when it’s approved`)
    } else {
      reg = { cap: 'Registration', val: 'Not started', state: 'todo' }
      familyActions.registration = true
    }

    // Waivers — signed in the registration wizard, so they inherit its availability.
    let waiv: Check
    if (s.waiverFlagged) waiv = { cap: 'Waivers', val: 'Needs attention', state: 'attention' }
    else if (s.signed) waiv = { cap: 'Waivers', val: 'Signed', state: 'done' }
    else if (reg.state === 'waiting') waiv = { cap: 'Waivers', val: 'Not started', state: 'na' }
    else waiv = { cap: 'Waivers', val: 'Not signed', state: 'todo' }

    // Payment.
    let pay: Check
    if (!s.hasEnrollment) pay = { cap: 'Payment', val: '—', state: 'na' }
    else if (s.feeUnpaid && s.paymentFlagged) pay = { cap: 'Payment', val: 'Needs attention', state: 'attention' }
    else if (s.feeUnpaid && s.paymentPendingReconciliation) {
      pay = { cap: 'Payment', val: 'Processing', state: 'waiting' }
      waitingItems.push(`We’re matching ${s.firstName}’s payment — it can take up to a day to show here. Please don’t pay again.`)
    } else if (s.feeUnpaid) {
      pay = { cap: 'Payment', val: 'Not paid', state: 'todo' }
      familyActions.payment = true
    } else if (s.feeWaived) pay = { cap: 'Payment', val: 'Waived', state: 'done' }
    else pay = { cap: 'Payment', val: s.paidLabel || 'Paid', state: 'done' }

    // Team — never a family action. Once the family side is done, placement is
    // in process at Placer Robotics; before that it's simply pending.
    let team: Check
    if (s.hasTeam && s.teamProvisional) {
      team = { cap: 'Team', val: 'Placement in progress', state: 'waiting' }
      waitingItems.push(`${s.firstName}’s final team placement is in progress`)
    } else if (s.hasTeam) team = { cap: 'Team', val: s.teamLabel || 'Assigned', state: 'done' }
    else if (s.registered && s.signed && s.hasEnrollment && !s.feeUnpaid) {
      team = { cap: 'Team', val: 'Assignment in progress', state: 'waiting' }
      waitingItems.push(`${s.firstName}’s team assignment is in progress`)
    } else team = { cap: 'Team', val: 'Pending', state: 'na' }

    checks = [reg, waiv, pay, team]
  }

  // Admin-flagged exceptions — plain language only; contact path added at render.
  if (s.applicationFlagged) attentionItems.push(`We have a question about ${s.firstName}’s application`)
  if (s.waiverFlagged) attentionItems.push(`One of ${s.firstName}’s signed agreements needs another look`)
  if (!s.isIqKid && s.feeUnpaid && s.paymentFlagged) attentionItems.push(`We’re double-checking a payment on your account`)

  const ready = checks.every((c) => c.state === 'done' || c.state === 'na') && attentionItems.length === 0 && waitingItems.length === 0
  const badge: StudentBadge = attentionItems.length
    ? 'attention'
    : checks.some((c) => c.state === 'todo')
    ? 'in_progress'
    : waitingItems.length
    ? 'waiting'
    : 'ready'

  return { checks, badge, ready, waitingItems, attentionItems, familyActions }
}
