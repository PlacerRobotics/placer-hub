// IQ-camper status resolution — pure, tested in tests/iq-status.test.ts.
//
// Incident (2026-07-11): a family dashboard showed an IQ camper a live
// "$40 fee + $550 fundraising — Pay via Zeffy" V5/Combat payment demand, even
// though her team was Active/fee-paid and she was correctly on its roster. IQ
// participation is billed to the coach's team, never to the individual camper.
//
// Root cause: `isIqKid` was derived from exactly one signal — a regex match on
// `student_application.triage_notes` (a freeform column also used to carry
// drop-request/dropped markers). Any write to that field that clears the
// `iq_team:<id>` pointer — including a partially-failed drop (see
// lib/iq-team.ts dropIqStudent) — silently flips a still-rostered IQ camper back
// into the normal V5/Combat branch, where an already-existing $0 `enrollment`
// row (created at /register for waivers/emergency-contact, never meant to bill
// anyone) gets padded up to the generic $40/$550 display defaults.
//
// Fix: never trust one mutable signal alone. isIqKid is true if EITHER the
// triage_notes pointer OR an active team_member row (independently, on a
// vex_iq-program team) says so. And regardless of isIqKid, a vex_iq enrollment
// can never feed the non-IQ fee/registration computation — see nonIqEnrollments.

export type IqTeamRef = { id: string; team_name?: string | null; team_number?: string | null; program?: string | null; division?: string | null } | null | undefined

export type IqResolution = { isIqKid: boolean; label: string | undefined; teamId: string | undefined; division: string | undefined }

export function resolveIqStatus(a: {
  /** label already resolved from the triage_notes iq_team:<id> pointer, if any */
  triageLabel?: string | null
  triageTeamId?: string | null
  triageDivision?: string | null
  /** the student's active team_member team, from ANY program (may be non-IQ or undefined) */
  team?: IqTeamRef
}): IqResolution {
  const fromTeam = a.team?.program === 'vex_iq'
  const isIqKid = !!a.triageLabel || fromTeam
  if (!isIqKid) return { isIqKid: false, label: undefined, teamId: undefined, division: undefined }
  return {
    isIqKid: true,
    label: a.triageLabel ?? (a.team!.team_name || a.team!.team_number || 'IQ team'),
    teamId: a.triageTeamId ?? a.team!.id,
    division: a.triageDivision ?? (a.team!.division ?? undefined),
  }
}

// vex_iq enrollments are never an individual payment obligation. Strip them
// before any non-IQ fee/registration computation so a masked $0 IQ enrollment
// can never surface as a cash demand, even if isIqKid detection is ever wrong.
export function nonIqEnrollments<T extends { program?: string | null }>(enrs: T[]): T[] {
  return enrs.filter((e) => e.program !== 'vex_iq')
}
