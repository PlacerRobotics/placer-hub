import { describe, it, expect } from 'vitest'
import { deriveStudentStatus, CHECK_META, BADGE_META, OWNER_LABELS, type StudentStatusInput } from '@/lib/dashboard-status'

// Baseline: a cleared, fully-registered non-IQ student on a real team.
function base(overrides: Partial<StudentStatusInput> = {}): StudentStatusInput {
  return {
    firstName: 'Avery',
    isIqKid: false,
    familyCleared: true,
    hasApplication: true,
    applicationFlagged: false,
    registered: true,
    signed: true,
    hasEnrollment: true,
    feeUnpaid: false,
    feeWaived: false,
    waiverFlagged: false,
    hasTeam: true,
    teamProvisional: false,
    teamLabel: '95070A',
    paymentPendingReconciliation: false,
    paymentFlagged: false,
    paidLabel: 'Paid · Champion',
    ...overrides,
  }
}

const check = (s: ReturnType<typeof deriveStudentStatus>, cap: string) => {
  const c = s.checks.find((c) => c.cap === cap)
  if (!c) throw new Error(`missing check ${cap}`)
  return c
}

describe('§11.6 waiting-on-Placer is distinct from family action', () => {
  it('application under review is waiting, not a family to-do', () => {
    const s = deriveStudentStatus(base({ familyCleared: false, registered: false, signed: false, hasEnrollment: false, hasTeam: false, teamLabel: '' }))
    expect(check(s, 'Registration').state).toBe('waiting')
    expect(s.familyActions.registration).toBe(false)
    expect(s.waitingItems.join(' ')).toContain('application is being reviewed')
    expect(s.badge).toBe('waiting')
  })

  it('the same unregistered student IS a family to-do once cleared', () => {
    const s = deriveStudentStatus(base({ familyCleared: true, registered: false, signed: false, hasEnrollment: false, hasTeam: false, teamLabel: '' }))
    expect(check(s, 'Registration').state).toBe('todo')
    expect(s.familyActions.registration).toBe(true)
    expect(s.badge).toBe('in_progress')
  })

  it('a payment awaiting reconciliation is waiting, not a pay to-do', () => {
    const s = deriveStudentStatus(base({ feeUnpaid: true, paymentPendingReconciliation: true, hasTeam: false, teamLabel: '' }))
    expect(check(s, 'Payment').state).toBe('waiting')
    expect(s.familyActions.payment).toBe(false)
    expect(s.waitingItems.join(' ')).toContain('up to a day')
  })

  it('an unpaid fee with no captured payment IS a pay to-do', () => {
    const s = deriveStudentStatus(base({ feeUnpaid: true }))
    expect(check(s, 'Payment').state).toBe('todo')
    expect(s.familyActions.payment).toBe(true)
  })

  it('team assignment after registration complete is waiting on Placer', () => {
    const s = deriveStudentStatus(base({ hasTeam: false, teamLabel: '' }))
    expect(check(s, 'Team').state).toBe('waiting')
    expect(s.badge).toBe('waiting')
    expect(s.waitingItems.join(' ')).toContain('team assignment')
  })

  it('a provisional team reads as placement in progress, never the internal name', () => {
    const s = deriveStudentStatus(base({ teamProvisional: true, teamLabel: 'Combat HS — TBD' }))
    const team = check(s, 'Team')
    expect(team.state).toBe('waiting')
    expect(team.val).not.toContain('TBD')
    expect(team.val.toLowerCase()).not.toContain('provisional')
  })

  it('waiting is never rendered with the failure glyph and carries a distinct label', () => {
    expect(CHECK_META.waiting.glyph).not.toBe('✗')
    expect(CHECK_META.waiting.glyph).not.toBe(CHECK_META.todo.glyph)
    expect(BADGE_META.waiting.label).toBe(OWNER_LABELS.placer_robotics)
    expect(BADGE_META.waiting.variant).not.toBe(BADGE_META.in_progress.variant)
  })

  it('team is never a family failure: pre-registration it is neutral, not ✗', () => {
    const s = deriveStudentStatus(base({ registered: false, signed: false, hasEnrollment: false, hasTeam: false, teamLabel: '' }))
    expect(check(s, 'Team').state).toBe('na')
  })
})

describe('§11.6 needs-attention appears only when an admin has flagged the record', () => {
  it('no flags → no attention items, ever', () => {
    for (const v of [base(), base({ feeUnpaid: true }), base({ familyCleared: false, registered: false })]) {
      expect(deriveStudentStatus(v).attentionItems).toEqual([])
    }
  })

  it('admin waiver flag → attention with plain language, no internal terms', () => {
    const s = deriveStudentStatus(base({ waiverFlagged: true }))
    expect(s.badge).toBe('attention')
    expect(check(s, 'Waivers').state).toBe('attention')
    const text = s.attentionItems.join(' ')
    expect(text).toContain('agreements')
    expect(text).not.toMatch(/needs_review|waiver_status|invalid/i)
  })

  it('admin payment flag → attention and no pay to-do', () => {
    const s = deriveStudentStatus(base({ feeUnpaid: true, paymentFlagged: true }))
    expect(check(s, 'Payment').state).toBe('attention')
    expect(s.familyActions.payment).toBe(false)
    expect(s.attentionItems.join(' ')).not.toMatch(/unmatched|matched_status/i)
  })

  it('admin application flag (needs_follow_up) → attention', () => {
    const s = deriveStudentStatus(base({ applicationFlagged: true }))
    expect(s.badge).toBe('attention')
    expect(s.attentionItems.join(' ')).toContain('application')
  })

  it('attention outranks waiting in the card badge', () => {
    const s = deriveStudentStatus(base({ hasTeam: false, teamLabel: '', waiverFlagged: true }))
    expect(s.badge).toBe('attention')
  })
})

describe('§11.6 only applicable steps appear', () => {
  it('IQ kids show team-managed registration/payment and no per-student fee actions', () => {
    const s = deriveStudentStatus(base({ isIqKid: true, teamLabel: 'RoboGlytch', registered: false, hasEnrollment: false, feeUnpaid: false }))
    expect(check(s, 'Registration').state).toBe('na')
    expect(check(s, 'Payment').state).toBe('na')
    expect(s.familyActions).toEqual({ registration: false, payment: false })
    expect(s.badge).toBe('ready') // signed → nothing left for the family
  })

  it('no waiting items while family actions are still outstanding', () => {
    // Unpaid + unsigned: team must not claim "assignment in progress" yet.
    const s = deriveStudentStatus(base({ signed: false, feeUnpaid: true, hasTeam: false, teamLabel: '' }))
    expect(s.waitingItems).toEqual([])
    expect(s.badge).toBe('in_progress')
  })

  it('payment check is not applicable before an enrollment exists', () => {
    const s = deriveStudentStatus(base({ registered: false, hasEnrollment: false, feeUnpaid: false, hasTeam: false, teamLabel: '' }))
    expect(check(s, 'Payment').state).toBe('na')
  })
})

describe('§11.6 multiple students display independently', () => {
  it('one waiting student does not bleed into a ready sibling', () => {
    const waiting = deriveStudentStatus(base({ firstName: 'Blake', hasTeam: false, teamLabel: '' }))
    const ready = deriveStudentStatus(base({ firstName: 'Avery' }))
    expect(waiting.badge).toBe('waiting')
    expect(ready.badge).toBe('ready')
    expect(ready.waitingItems).toEqual([])
    expect(waiting.waitingItems.join(' ')).toContain('Blake')
    expect(waiting.waitingItems.join(' ')).not.toContain('Avery')
  })

  it('a flagged student does not mark the sibling as needing attention', () => {
    const flagged = deriveStudentStatus(base({ firstName: 'Blake', waiverFlagged: true }))
    const clean = deriveStudentStatus(base({ firstName: 'Avery' }))
    expect(flagged.badge).toBe('attention')
    expect(clean.badge).toBe('ready')
    expect(clean.attentionItems).toEqual([])
  })
})
