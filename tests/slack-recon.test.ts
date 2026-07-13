// gatherExpectedMembers (task 1.6) — the IQ-workspace-not-wired-in-yet
// program scoping, and alt-email (guardian_email_alias) attachment.

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { gatherExpectedMembers, gatherKnownStudents, gatherSlackDispositions, gatherFamiliesNotOnSlack } from '@/lib/slack-recon'
import type { SlackReconciliation } from '@/lib/slack'

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
    family: [],
  }
}

function emptyRecon(overrides: Partial<SlackReconciliation> = {}): SlackReconciliation {
  return { notJoined: [], departed: [], under13Present: [], unexpected: [], matched: [], ...overrides }
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

  it('includes a guardian on a cleared_to_register family, not just registered', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'cleared_to_register' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Cleared', last_name: 'Parent', login_email: 'cleared@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5' }]
    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected.map((p) => p.email)).toEqual(['cleared@ex.com'])
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

describe('gatherKnownStudents', () => {
  it('returns a registered student with a known slack_email, kind=student', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'cleared_to_register' }]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Rahul', last_name: 'Veluru', slack_email: 'rahul@ex.com', communication_email: null, fusion_education_email: null }]

    const students = await gatherKnownStudents(makeAdminClient(t), SEASON)
    expect(students).toEqual([{ email: 'rahul@ex.com', name: 'Rahul Veluru', kind: 'student', guardianId: null, programs: [], teamNumbers: [] }])
  })

  it('skips a student with no email on file at all', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'No', last_name: 'Email', slack_email: null, communication_email: null, fusion_education_email: null }]

    const students = await gatherKnownStudents(makeAdminClient(t), SEASON)
    expect(students).toEqual([])
  })

  it('falls back to communication_email then fusion_education_email', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Comm', last_name: 'Email', slack_email: null, communication_email: 'comm@ex.com', fusion_education_email: 'fusion@ex.com' }]

    const students = await gatherKnownStudents(makeAdminClient(t), SEASON)
    expect(students[0].email).toBe('comm@ex.com')
  })
})

describe('gatherExpectedMembers — program/team enrichment for the dashboard', () => {
  it('attaches the team_number a guardian coaches', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Coach', last_name: 'Only', login_email: 'coach@ex.com', slack_email: null }]
    t.team = [{ id: 'team1', program: 'vex_v5', team_number: '295A' }]
    t.team_member = [{ team_id: 'team1', guardian_id: 'g1', student_id: null, season: SEASON, team_role: 'coach', revoked_at: null }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected[0].programs).toEqual(['vex_v5'])
    expect(expected[0].teamNumbers).toEqual(['295A'])
  })

  it("attaches the guardian's kid's team_number even without a coach role", async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Parent', last_name: 'Only', login_email: 'parent@ex.com', slack_email: null }]
    t.student = [{ id: 's1', family_id: 'fam1' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5' }]
    t.team = [{ id: 'team1', program: 'vex_v5', team_number: '295B' }]
    t.team_member = [{ team_id: 'team1', guardian_id: null, student_id: 's1', season: SEASON, team_role: 'student', revoked_at: null }]

    const expected = await gatherExpectedMembers(makeAdminClient(t), SEASON)
    expect(expected[0].teamNumbers).toEqual(['295B'])
  })
})

describe('gatherKnownStudents — program/team enrichment', () => {
  it("attaches the student's own team_number", async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'OnTeam', slack_email: 'kid@ex.com', communication_email: null, fusion_education_email: null }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_iq' }]
    t.team = [{ id: 'team1', program: 'vex_iq', team_number: '1234A' }]
    t.team_member = [{ team_id: 'team1', guardian_id: null, student_id: 's1', season: SEASON, team_role: 'student', revoked_at: null }]

    const students = await gatherKnownStudents(makeAdminClient(t), SEASON)
    expect(students[0].programs).toEqual(['vex_iq'])
    expect(students[0].teamNumbers).toEqual(['1234A'])
  })
})

describe('gatherFamiliesNotOnSlack', () => {
  it('excludes a family where another guardian already matched', async () => {
    const t = baseFixture()
    t.guardian = [
      { id: 'g1', family_id: 'fam1', first_name: 'Amy', last_name: 'Chen', login_email: 'amy@ex.com', role: 'primary' },
      { id: 'g2', family_id: 'fam1', first_name: 'Bob', last_name: 'Chen', login_email: 'bob@ex.com', role: 'secondary' },
    ]
    const recon = emptyRecon({
      notJoined: [{ email: 'bob@ex.com', name: 'Bob Chen', kind: 'guardian', guardianId: 'g2', programs: ['vex_v5'], teamNumbers: ['295A'] }],
      matched: [{ person: { email: 'amy@ex.com', name: 'Amy Chen', kind: 'guardian', guardianId: 'g1' }, slackUserId: 'U1' }],
    })

    const families = await gatherFamiliesNotOnSlack(makeAdminClient(t), recon)
    expect(families).toEqual([])
  })

  it('includes a family with zero matched guardians, naming it and attaching program/team/students', async () => {
    const t = baseFixture()
    t.guardian = [{ id: 'g1', family_id: 'fam1', first_name: 'Cara', last_name: 'Diaz', login_email: 'cara@ex.com', role: 'primary' }]
    t.family = [{ id: 'fam1', display_name: null, primary_email: 'cara@ex.com' }]
    t.student = [{ family_id: 'fam1', first_name: 'Leo', last_name: 'Diaz' }]
    const recon = emptyRecon({
      notJoined: [{ email: 'cara@ex.com', name: 'Cara Diaz', kind: 'guardian', guardianId: 'g1', programs: ['combat'], teamNumbers: ['9537X'] }],
    })

    const families = await gatherFamiliesNotOnSlack(makeAdminClient(t), recon)
    expect(families).toEqual([{
      familyId: 'fam1',
      familyName: 'Diaz Family',
      guardianNames: ['Cara Diaz'],
      guardianEmails: ['cara@ex.com'],
      studentNames: ['Leo Diaz'],
      programs: ['combat'],
      teamNumbers: ['9537X'],
    }])
  })

  it('ignores student-kind notJoined entries (students are never expected to join)', async () => {
    const t = baseFixture()
    const recon = emptyRecon({ notJoined: [{ email: 's@ex.com', name: 'Stu Dent', kind: 'student', guardianId: null }] })
    const families = await gatherFamiliesNotOnSlack(makeAdminClient(t), recon)
    expect(families).toEqual([])
  })
})

describe('gatherSlackDispositions', () => {
  it('returns tags and notes keyed by slack_user_id', async () => {
    const t = baseFixture()
    t.slack_member_disposition = [
      { slack_user_id: 'U1', tags: ['alumni', 'employee'], notes: 'left 2024' },
      { slack_user_id: 'U2', tags: [], notes: null },
    ]
    const dispositions = await gatherSlackDispositions(makeAdminClient(t))
    expect(dispositions['U1']).toEqual({ tags: ['alumni', 'employee'], notes: 'left 2024' })
    expect(dispositions['U2']).toEqual({ tags: [], notes: null })
    expect(dispositions['U3']).toBeUndefined()
  })
})
