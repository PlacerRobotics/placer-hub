// gatherExpectedMembers (task 1.6) — the IQ-workspace-not-wired-in-yet
// program scoping, and alt-email (guardian_email_alias) attachment.

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { gatherExpectedMembers } from '@/lib/slack-recon'

const SEASON = '2026-27'

function baseFixture(): Tables {
  return {
    family_season: [],
    guardian: [],
    enrollment: [],
    student: [],
    team_member: [],
    team: [],
    volunteer_clearance: [],
    volunteer_profile: [],
    guardian_email_alias: [],
  }
}

describe('gatherExpectedMembers — IQ program scoping', () => {
  it('excludes a guardian whose only enrolled student is VEX IQ', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Iq', last_name: 'Only', login_email: 'iq@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_iq' }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected).toEqual([])
  })

  it('includes a guardian with a VEX V5 enrolled student', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'V5', last_name: 'Parent', login_email: 'v5@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5' }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected.map((p) => p.email)).toEqual(['v5@ex.com'])
  })

  it('includes a guardian with BOTH a V5 and an IQ student (still expected on the V5 side)', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Both', last_name: 'Parent', login_email: 'both@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }, { id: 's2', family_id: 'fam1' }]
    t.enrollment = [
      { student_id: 's1', season: SEASON, program: 'vex_v5' },
      { student_id: 's2', season: SEASON, program: 'vex_iq' },
    ]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected.map((p) => p.email)).toEqual(['both@ex.com'])
  })

  it('includes a guardian who coaches a Combat team even with no enrolled student on file', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Coach', last_name: 'Only', login_email: 'coach@ex.com', slack_email: null }]
    t.team = [{ id: 'team1', program: 'combat' }]
    t.team_member = [{ team_id: 'team1', guardian_id: 'g1', season: SEASON, team_role: 'coach', revoked_at: null }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected.map((p) => p.email)).toEqual(['coach@ex.com'])
  })

  it('excludes a guardian who only coaches an IQ team', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Iq', last_name: 'Coach', login_email: 'iqcoach@ex.com', slack_email: null }]
    t.team = [{ id: 'team1', program: 'vex_iq' }]
    t.team_member = [{ team_id: 'team1', guardian_id: 'g1', season: SEASON, team_role: 'coach', revoked_at: null }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected).toEqual([])
  })

  it('excludes a cleared volunteer whose guardian record is IQ-only', async () => {
    const t = baseFixture()
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Iq', last_name: 'Vol', login_email: 'iqvol@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_iq' }]
    t.volunteer_clearance = [{ volunteer_id: 'vp1', season: SEASON, status: 'cleared' }]
    t.volunteer_profile = [{ id: 'vp1', guardian_id: 'g1', guardian: { id: 'g1', first_name: 'Iq', last_name: 'Vol', login_email: 'iqvol@ex.com', slack_email: null } }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected).toEqual([])
  })

  it('includes a volunteer with no determinable program affiliation (e.g. a non-parent board member)', async () => {
    const t = baseFixture()
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Board', last_name: 'Member', login_email: 'board@ex.com', slack_email: null }]
    t.volunteer_clearance = [{ volunteer_id: 'vp1', season: SEASON, status: 'cleared' }]
    t.volunteer_profile = [{ id: 'vp1', guardian_id: 'g1', guardian: { id: 'g1', first_name: 'Board', last_name: 'Member', login_email: 'board@ex.com', slack_email: null } }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected.map((p) => p.email)).toEqual(['board@ex.com'])
  })
})

describe('gatherExpectedMembers — alt emails', () => {
  it('attaches known guardian_email_alias rows as altEmails', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Alt', last_name: 'Email', login_email: 'primary@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5' }]
    t.guardian_email_alias = [{ guardian_id: 'g1', email: 'personal.gmail@ex.com' }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected).toHaveLength(1)
    expect(expected[0].altEmails).toEqual(['personal.gmail@ex.com'])
  })
})
