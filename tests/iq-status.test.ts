// Regression coverage for the production incident (2026-07-11): a still-rostered
// IQ camper's family dashboard showed a live V5/Combat "$40 fee + $550
// fundraising — Pay via Zeffy" demand, because isIqKid depended on exactly one
// mutable signal (a triage_notes regex) that had desynced from the student's
// real, active team_member row. See lib/iq-status.ts for the full writeup.

import { describe, it, expect } from 'vitest'
import { resolveIqStatus, nonIqEnrollments } from '@/lib/iq-status'

const iqTeam = { id: 'team-iq-1', team_name: 'The X Factors', team_number: '295R', program: 'vex_iq', division: 'ES' }
const v5Team = { id: 'team-v5-1', team_name: 'Navy Knights', team_number: '1001A', program: 'vex_v5', division: 'MS' }

describe('resolveIqStatus', () => {
  it('is IQ when only the triage_notes pointer says so (team not yet materialized)', () => {
    const r = resolveIqStatus({ triageLabel: 'The X Factors', triageTeamId: 'team-iq-1', triageDivision: 'ES', team: undefined })
    expect(r).toEqual({ isIqKid: true, label: 'The X Factors', teamId: 'team-iq-1', division: 'ES' })
  })

  it('is IQ when only the team_member/team signal says so — the exact desync from the incident', () => {
    // triage_notes has been cleared (e.g. an interrupted drop) but the student's
    // team_member row is still active on a vex_iq team. Before the fix, this
    // produced isIqKid=false and a live payment demand for a team-billed camper.
    const r = resolveIqStatus({ triageLabel: undefined, triageTeamId: undefined, triageDivision: undefined, team: iqTeam })
    expect(r.isIqKid).toBe(true)
    expect(r.teamId).toBe('team-iq-1')
    expect(r.label).toBe('The X Factors')
    expect(r.division).toBe('ES')
  })

  it('falls back to team_number, then a generic label, when the team has no name', () => {
    expect(resolveIqStatus({ team: { id: 't1', team_name: null, team_number: '42Q', program: 'vex_iq' } }).label).toBe('42Q')
    expect(resolveIqStatus({ team: { id: 't1', team_name: null, team_number: null, program: 'vex_iq' } }).label).toBe('IQ team')
  })

  it('the triage signal is authoritative for the label/team even when a team_member row also exists', () => {
    const r = resolveIqStatus({ triageLabel: 'Coach Custom Name', triageTeamId: 'team-iq-1', triageDivision: 'ES', team: iqTeam })
    expect(r.label).toBe('Coach Custom Name')
  })

  it('is not IQ when neither signal says so', () => {
    expect(resolveIqStatus({ team: undefined })).toEqual({ isIqKid: false, label: undefined, teamId: undefined, division: undefined })
    expect(resolveIqStatus({ team: v5Team })).toEqual({ isIqKid: false, label: undefined, teamId: undefined, division: undefined })
  })

  it('a V5/Combat team_member row never flips a non-IQ student to IQ', () => {
    const r = resolveIqStatus({ triageLabel: undefined, team: v5Team })
    expect(r.isIqKid).toBe(false)
  })
})

describe('nonIqEnrollments', () => {
  it('strips vex_iq rows, keeping everything else', () => {
    const enrs = [{ program: 'vex_iq', id: 'e1' }, { program: 'vex_v5', id: 'e2' }, { program: 'combat', id: 'e3' }]
    expect(nonIqEnrollments(enrs)).toEqual([{ program: 'vex_v5', id: 'e2' }, { program: 'combat', id: 'e3' }])
  })

  it('is a no-op for a normal V5/Combat family (no vex_iq rows)', () => {
    const enrs = [{ program: 'vex_v5', id: 'e1' }]
    expect(nonIqEnrollments(enrs)).toEqual(enrs)
  })

  it('empties out an IQ-only enrollment list — this is what makes the bug structurally impossible', () => {
    // Even if isIqKid were somehow wrong, an all-vex_iq enrollment set can never
    // produce a fee/registered/paid computation, because there's nothing left to
    // compute from.
    expect(nonIqEnrollments([{ program: 'vex_iq', id: 'e1' }])).toEqual([])
  })
})
