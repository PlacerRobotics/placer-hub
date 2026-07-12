// Slack reconciliation bucket math (task 1.6 / D11) — pure logic in lib/slack.ts.

import { describe, it, expect } from 'vitest'
import { reconcileSlack, normalizeEmail, type HubPerson, type SlackUser } from '@/lib/slack'

const person = (email: string, kind: 'guardian' | 'volunteer' = 'guardian', name = email): HubPerson => ({ email, name, kind, guardianId: `g-${email}` })
const slack = (id: string, email: string | null, opts: Partial<SlackUser> = {}): SlackUser => ({ id, email, name: opts.name ?? id, deleted: false, isBot: false, ...opts })

describe('reconcileSlack', () => {
  it('sorts expected members into matched / not-joined / departed', () => {
    const r = reconcileSlack({
      expected: [person('in@ex.com'), person('missing@ex.com'), person('gone@ex.com')],
      under13Emails: [],
      slackUsers: [slack('U1', 'in@ex.com'), slack('U2', 'gone@ex.com', { deleted: true })],
    })
    expect(r.matched.map((m) => m.person.email)).toEqual(['in@ex.com'])
    expect(r.notJoined.map((p) => p.email)).toEqual(['missing@ex.com'])
    expect(r.departed.map((d) => d.person.email)).toEqual(['gone@ex.com'])
    expect(r.unexpected).toEqual([])
  })

  it('matching is case-insensitive and whitespace-tolerant', () => {
    const r = reconcileSlack({
      expected: [person(' Parent@Ex.com ')],
      under13Emails: [],
      slackUsers: [slack('U1', 'parent@ex.com')],
    })
    expect(r.matched).toHaveLength(1)
    expect(r.notJoined).toEqual([])
    expect(normalizeEmail(' A@B.Co ')).toBe('a@b.co')
  })

  it('flags active accounts matching under-13 student emails — the removal queue', () => {
    const r = reconcileSlack({
      expected: [],
      under13Emails: ['Kid@Ex.com'],
      slackUsers: [slack('U9', 'kid@ex.com', { name: 'Kid Alpha' })],
    })
    expect(r.under13Present).toEqual([{ email: 'kid@ex.com', slackUserId: 'U9', slackName: 'Kid Alpha' }])
    // Not double-reported as merely "unexpected".
    expect(r.unexpected).toEqual([])
  })

  it('a deactivated under-13 account is not queued for removal', () => {
    const r = reconcileSlack({
      expected: [],
      under13Emails: ['kid@ex.com'],
      slackUsers: [slack('U9', 'kid@ex.com', { deleted: true })],
    })
    expect(r.under13Present).toEqual([])
  })

  it('unknown active humans land in unexpected; bots and deleted accounts do not', () => {
    const r = reconcileSlack({
      expected: [person('in@ex.com')],
      under13Emails: [],
      slackUsers: [
        slack('U1', 'in@ex.com'),
        slack('U2', 'alum@ex.com', { name: 'Alum' }),
        slack('U3', null, { name: 'No Email Visible' }),
        slack('U4', 'bot@ex.com', { isBot: true }),
        slack('U5', 'left@ex.com', { deleted: true }),
      ],
    })
    expect(r.unexpected.map((u) => u.slackUserId).sort()).toEqual(['U2', 'U3'])
  })

  it('dedupes a person who is both guardian and volunteer', () => {
    const r = reconcileSlack({
      expected: [person('dual@ex.com', 'guardian'), person('dual@ex.com', 'volunteer')],
      under13Emails: [],
      slackUsers: [slack('U1', 'dual@ex.com')],
    })
    expect(r.matched).toHaveLength(1)
    expect(r.notJoined).toEqual([])
  })

  it('matches on a known alt email (guardian_email_alias), not just the primary one', () => {
    const p = { ...person('primary@ex.com'), altEmails: ['personal.gmail@ex.com'] }
    const r = reconcileSlack({
      expected: [p],
      under13Emails: [],
      slackUsers: [slack('U1', 'personal.gmail@ex.com')],
    })
    expect(r.matched.map((m) => m.person.email)).toEqual(['primary@ex.com'])
    expect(r.notJoined).toEqual([])
    expect(r.unexpected).toEqual([])
  })

  it('a person with an unmatched alt email appears once in notJoined, not once per email', () => {
    const p = { ...person('primary@ex.com'), altEmails: ['old.alias@ex.com'] }
    const r = reconcileSlack({ expected: [p], under13Emails: [], slackUsers: [] })
    expect(r.notJoined).toHaveLength(1)
  })
})
