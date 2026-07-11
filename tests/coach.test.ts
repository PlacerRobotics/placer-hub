// Coach-dashboard scoping + exposure tests (task 1.2).
//
// Drives lib/coach.ts getCoachTeams with the same in-memory, RLS-free Supabase
// stand-in the escalation suite uses: the mock returns any row a query matches
// (like the real service-role client), so team/roster invisibility here proves
// the coach-derived team-ID scoping in lib/coach.ts — not RLS.

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import {
  getCoachTeams,
  deriveTeamAlerts,
  coachTeamLabel,
  REGISTRAR_FOLLOW_UP,
} from '@/lib/coach'

const SEASON = '2026-27'
const OPTS = { season: SEASON, validThrough: '2027-05-31', today: '2026-07-10' }
const OLD = '2026-06-01T00:00:00Z' // before the 7-day roster-change window
const RECENT = '2026-07-08T00:00:00Z' // inside it

// Two teams with disjoint coaches/rosters. Rows deliberately carry every field a
// coach must NOT see (fees, fundraising, contact info, notes) so the leak scan
// below proves the output shape strips them.
function fixture(): Tables {
  return {
    team: [
      { id: 'team1', season: SEASON, program: 'vex_v5', division: 'MS', team_name: 'Navy Knights', team_number: '1001A', school_org: 'PHS', active: true, is_provisional: false },
      { id: 'team2', season: SEASON, program: 'vex_v5', division: 'HS', team_name: 'Gold Gears', team_number: '1002B', school_org: 'PHS', active: true, is_provisional: false },
    ],
    team_member: [
      // coaches
      { id: 'tmA', team_id: 'team1', guardian_id: 'gA', student_id: null, season: SEASON, team_role: 'coach', program: 'vex_v5', revoked_at: null, created_at: OLD },
      { id: 'tmB', team_id: 'team2', guardian_id: 'gB', student_id: null, season: SEASON, team_role: 'coach', program: 'vex_v5', revoked_at: null, created_at: OLD },
      { id: 'tmC', team_id: 'team1', guardian_id: 'gC', student_id: null, season: SEASON, team_role: 'assistant_coach', program: 'vex_v5', revoked_at: null, created_at: OLD },
      // team1 roster: sA complete · sB not registered · sD registered but unsigned (recent add)
      { id: 'tm1', team_id: 'team1', enrollment_id: 'eA', student_id: 'sA', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: null, created_at: OLD },
      { id: 'tm2', team_id: 'team1', enrollment_id: 'eB', student_id: 'sB', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: null, created_at: OLD },
      { id: 'tm3', team_id: 'team1', enrollment_id: 'eD', student_id: 'sD', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: null, created_at: RECENT },
      // team1: a recently removed student
      { id: 'tm4', team_id: 'team1', enrollment_id: 'eE', student_id: 'sE', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: RECENT, created_at: OLD },
      // team2 roster: one complete student
      { id: 'tm5', team_id: 'team2', enrollment_id: 'eC', student_id: 'sC', season: SEASON, team_role: 'student', program: 'vex_v5', revoked_at: null, created_at: OLD },
    ],
    student: [
      { id: 'sA', family_id: 'famA', first_name: 'Amy', last_name: 'Alpha', preferred_name: 'Ames', grade: 7, phone: '555-0001', communication_email: 'amy-kid@ex.com', city: 'Rocklin', zip_code: '95765' },
      { id: 'sB', family_id: 'famB', first_name: 'Ben', last_name: 'Beta', preferred_name: null, grade: 8, phone: '555-0002', communication_email: 'ben-kid@ex.com', city: 'Rocklin', zip_code: '95765' },
      { id: 'sD', family_id: 'famD', first_name: 'Dee', last_name: 'Delta', preferred_name: null, grade: 6, phone: '555-0004', communication_email: 'dee-kid@ex.com', city: 'Rocklin', zip_code: '95765' },
      { id: 'sC', family_id: 'famC', first_name: 'Cal', last_name: 'Gamma', preferred_name: null, grade: 10, phone: '555-0003', communication_email: 'cal-kid@ex.com', city: 'Rocklin', zip_code: '95765' },
    ],
    enrollment: [
      { id: 'eA', student_id: 'sA', season: SEASON, program: 'vex_v5', submitted_at: OLD, registration_fee_status: 'paid', fundraising_target: 550, payment_reference_code: 'SECRET-REF-A' },
      // sB has an enrollment but never submitted registration
      { id: 'eB', student_id: 'sB', season: SEASON, program: 'vex_v5', submitted_at: null, registration_fee_status: 'unpaid', fundraising_target: 550, payment_reference_code: 'SECRET-REF-B' },
      { id: 'eD', student_id: 'sD', season: SEASON, program: 'vex_v5', submitted_at: OLD, registration_fee_status: 'unpaid', fundraising_target: 550, payment_reference_code: 'SECRET-REF-D' },
      { id: 'eC', student_id: 'sC', season: SEASON, program: 'vex_v5', submitted_at: OLD, registration_fee_status: 'paid', fundraising_target: 550, payment_reference_code: 'SECRET-REF-C' },
    ],
    waiver_signature: [
      { id: 'wA', student_id: 'sA', season: SEASON },
      { id: 'wC', student_id: 'sC', season: SEASON },
    ],
    guardian: [
      { id: 'gA', family_id: 'famGA', first_name: 'Coach', last_name: 'Alpha', login_email: 'coach-a@ex.com', phone: '555-9001' },
      { id: 'gB', family_id: 'famGB', first_name: 'Coach', last_name: 'Beta', login_email: 'coach-b@ex.com', phone: '555-9002' },
      { id: 'gC', family_id: 'famGC', first_name: 'Assist', last_name: 'Gamma', login_email: 'coach-c@ex.com', phone: '555-9003' },
    ],
    financial_aid: [{ id: 'fa1', family_id: 'famA', season: SEASON, status: 'approved' }],
    // gA fully cleared; gB cleared except an APS cert that lapses before season end
    // (expiring); gC has no volunteer profile at all.
    volunteer_profile: [
      { id: 'vA', guardian_id: 'gA', status: 'active' },
      { id: 'vB', guardian_id: 'gB', status: 'active' },
    ],
    volunteer_clearance: [
      { id: 'vcA', volunteer_id: 'vA', season: SEASON, waiver_signed_date: '2026-07-01', rc_quiz_passed: true, yp_quiz_passed: true },
      { id: 'vcB', volunteer_id: 'vB', season: SEASON, waiver_signed_date: '2026-07-01', rc_quiz_passed: true, yp_quiz_passed: true },
    ],
    youth_protection_cert: [
      { id: 'ypA', volunteer_id: 'vA', expiration_date: '2027-08-01' }, // valid through season end
      { id: 'ypB', volunteer_id: 'vB', expiration_date: '2026-09-15' }, // expiring
    ],
    volunteer_step: [
      { id: 'vsA', volunteer_id: 'vA', step: 'background_check', status: 'complete' },
      { id: 'vsB', volunteer_id: 'vB', step: 'background_check', status: 'complete' },
    ],
  }
}

function coachView(tables: Tables, guardianId: string) {
  return getCoachTeams(makeAdminClient(tables), { guardianId, ...OPTS })
}

describe('getCoachTeams — scoping', () => {
  it('a coach sees only their assigned teams', async () => {
    const teams = await coachView(fixture(), 'gA')
    expect(teams).not.toBeNull()
    expect(teams!.map((t) => t.teamId)).toEqual(['team1'])

    // Nothing from team2 leaks anywhere in the payload.
    const json = JSON.stringify(teams)
    expect(json).not.toContain('team2')
    expect(json).not.toContain('Gold Gears')
    expect(json).not.toContain('Cal') // team2's student
  })

  it('scoping holds in both directions', async () => {
    const teams = await coachView(fixture(), 'gB')
    expect(teams!.map((t) => t.teamId)).toEqual(['team2'])
    expect(JSON.stringify(teams)).not.toContain('Amy')
  })

  it('a removed (revoked) coach loses access entirely', async () => {
    const tables = fixture()
    tables.team_member.find((m) => m.id === 'tmA')!.revoked_at = '2026-07-09T00:00:00Z'
    expect(await coachView(tables, 'gA')).toBeNull()
  })

  it('a coach membership from another season grants nothing', async () => {
    const tables = fixture()
    tables.team_member.find((m) => m.id === 'tmA')!.season = '2025-26'
    expect(await coachView(tables, 'gA')).toBeNull()
  })

  it('a plain guardian (no coach rows) gets null', async () => {
    expect(await coachView(fixture(), 'gZ')).toBeNull()
  })

  it('a non-coach role (manager) does not grant coach access', async () => {
    const tables = fixture()
    tables.team_member.push({ id: 'tmX', team_id: 'team2', guardian_id: 'gX', student_id: null, season: SEASON, team_role: 'manager', program: 'vex_v5', revoked_at: null, created_at: OLD })
    expect(await coachView(tables, 'gX')).toBeNull()
  })
})

describe('getCoachTeams — restricted exposure (D14 / no financial data)', () => {
  it('output carries no payment, fundraising, financial-aid, or contact data', async () => {
    const teams = await coachView(fixture(), 'gA')
    const json = JSON.stringify(teams)
    // Values present on the source rows that must be stripped by the shape:
    for (const secret of ['SECRET-REF', 'unpaid', 'paid', '550', 'fundraising', 'fee', 'financial', '555-', '@ex.com', 'famA', 'Rocklin', '95765']) {
      expect(json, `leaked "${secret}"`).not.toContain(secret)
    }
  })

  it('roster rows expose exactly the allowed fields', async () => {
    const teams = await coachView(fixture(), 'gA')
    const row = teams![0].roster.find((r) => r.name === 'Amy Alpha')!
    expect(Object.keys(row).sort()).toEqual(['agreementSigned', 'grade', 'name', 'preferredName', 'registered', 'studentId'])
    expect(row).toEqual({ studentId: 'sA', name: 'Amy Alpha', preferredName: 'Ames', grade: 7, registered: true, agreementSigned: true })
  })

  it('co-coach rows expose only name, role, and the four-value clearance', async () => {
    const teams = await coachView(fixture(), 'gA')
    for (const c of teams![0].staff) {
      expect(Object.keys(c).sort()).toEqual(['clearance', 'guardianId', 'name', 'role'])
      expect(['Cleared', 'Not cleared', 'Expiring soon', 'Restricted']).toContain(c.clearance)
    }
  })
})

describe('getCoachTeams — completion + clearance derivation', () => {
  it('derives registration and agreement completion per student', async () => {
    const teams = await coachView(fixture(), 'gA')
    const byName = Object.fromEntries(teams![0].roster.map((r) => [r.name, r]))
    expect(byName['Amy Alpha']).toMatchObject({ registered: true, agreementSigned: true })
    expect(byName['Ben Beta']).toMatchObject({ registered: false, agreementSigned: false }) // enrollment never submitted
    expect(byName['Dee Delta']).toMatchObject({ registered: true, agreementSigned: false })
  })

  it('maps co-coach clearance to the four values', async () => {
    const t1 = (await coachView(fixture(), 'gA'))![0]
    const byId = Object.fromEntries(t1.staff.map((c) => [c.guardianId, c.clearance]))
    expect(byId.gA).toBe('Cleared')
    expect(byId.gC).toBe('Not cleared') // no volunteer profile at all

    const t2 = (await coachView(fixture(), 'gB'))![0]
    expect(t2.staff.find((c) => c.guardianId === 'gB')!.clearance).toBe('Expiring soon')
  })

  it('raises the team alerts, using registrar-owned wording for registration', async () => {
    const t1 = (await coachView(fixture(), 'gA'))![0]
    const kinds = t1.alerts.map((a) => a.kind)
    expect(kinds).toContain('registration_incomplete')
    expect(kinds).toContain('agreement_missing')
    expect(kinds).toContain('assistant_not_cleared')
    expect(kinds).toContain('roster_changed')
    expect(t1.alerts.find((a) => a.kind === 'registration_incomplete')!.text).toContain(REGISTRAR_FOLLOW_UP)
    expect(t1.alerts.find((a) => a.kind === 'roster_changed')!.text).toContain('1 added, 1 removed')

    const t2 = (await coachView(fixture(), 'gB'))![0]
    expect(t2.alerts.map((a) => a.kind)).toEqual(['coach_clearance_expiring'])
  })
})

describe('deriveTeamAlerts — pure cases', () => {
  const cleared = { name: 'C', role: 'coach', clearance: 'Cleared' as const }

  it('is quiet when everything is complete', () => {
    expect(deriveTeamAlerts({ roster: [{ name: 'A', registered: true, agreementSigned: true }], staff: [cleared], recentlyAdded: 0, recentlyRemoved: 0 })).toEqual([])
  })

  it('an uncleared HEAD coach is not reported as an uncleared assistant', () => {
    const alerts = deriveTeamAlerts({ roster: [], staff: [{ name: 'H', role: 'coach', clearance: 'Not cleared' }], recentlyAdded: 0, recentlyRemoved: 0 })
    expect(alerts.map((a) => a.kind)).not.toContain('assistant_not_cleared')
  })

  it('a restricted mentor counts as an uncleared assistant', () => {
    const alerts = deriveTeamAlerts({ roster: [], staff: [{ name: 'M', role: 'mentor', clearance: 'Restricted' }], recentlyAdded: 0, recentlyRemoved: 0 })
    expect(alerts.map((a) => a.kind)).toEqual(['assistant_not_cleared'])
  })
})

describe('coachTeamLabel', () => {
  it('never surfaces the internal TBD name of a provisional team', () => {
    expect(coachTeamLabel({ team_name: 'Combat MS — TBD', team_number: null, program: 'combat', division: 'MS', is_provisional: true })).toBe('Combat MS — roster being finalized')
    expect(coachTeamLabel({ team_name: 'Navy Knights', team_number: '1001A', program: 'vex_v5', division: 'MS', is_provisional: false })).toBe('Navy Knights')
  })
})
