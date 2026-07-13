// Hub-side data gathering + orchestration for Slack reconciliation (task 1.6).
// The bucket math itself is pure and lives in lib/slack.ts; this file owns the
// database reads (service-role client) and the additive bot actions.

import { listSlackUsers, reconcileSlack, inviteToChannel, fuzzyMatchUnexpected, type HubPerson, type SlackReconciliation, type FuzzyMatch, type FuzzyMatchCandidate } from './slack'
import { isUnder13 } from './compliance'

// Programs already wired into THIS (main HS/MS) workspace. VEX IQ has its own,
// separate Slack workspace — a different invite link is already live for it,
// but no bot token yet, so there's nothing to reconcile IQ people against.
// Until that's wired in, a guardian/volunteer whose ONLY program affiliation is
// IQ must not be flagged "not joined" here — they were never expected in this
// workspace. Someone with BOTH V5/Combat and IQ kids still counts (their
// V5/Combat side IS expected here).
const MAIN_WORKSPACE_PROGRAMS = new Set(['vex_v5', 'combat'])

// guardianId -> set of programs (this season), from (a) their family's
// enrolled students and (b) any team they coach/manage. An empty set means no
// determinable program affiliation (e.g. a non-parent board member) — that
// never excludes someone, only a KNOWN all-IQ affiliation does.
async function gatherGuardianPrograms(db: any, season: string): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  const add = (gid: string | null | undefined, program: string | null | undefined) => {
    if (!gid || !program) return
    if (!out.has(gid)) out.set(gid, new Set())
    out.get(gid)!.add(program)
  }

  const { data: guardians } = await db.from('guardian').select('id, family_id')
  const familyToGuardians: Record<string, string[]> = {}
  for (const g of (guardians ?? []) as any[]) (familyToGuardians[g.family_id] ??= []).push(g.id)

  const { data: enrs } = await db.from('enrollment').select('student_id, program').eq('season', season)
  const studentIds = [...new Set(((enrs ?? []) as any[]).map((e) => e.student_id).filter(Boolean))]
  if (studentIds.length) {
    const { data: studs } = await db.from('student').select('id, family_id').in('id', studentIds)
    const familyByStudent: Record<string, string> = Object.fromEntries(((studs ?? []) as any[]).map((s) => [s.id, s.family_id]))
    for (const e of (enrs ?? []) as any[]) {
      for (const gid of familyToGuardians[familyByStudent[e.student_id]] ?? []) add(gid, e.program)
    }
  }

  const { data: tms } = await db.from('team_member').select('team_id, guardian_id').eq('season', season).is('revoked_at', null).not('guardian_id', 'is', null)
  const teamIds = [...new Set(((tms ?? []) as any[]).map((t) => t.team_id).filter(Boolean))]
  if (teamIds.length) {
    const { data: teams } = await db.from('team').select('id, program').in('id', teamIds)
    const programByTeam: Record<string, string> = Object.fromEntries(((teams ?? []) as any[]).map((t) => [t.id, t.program]))
    for (const t of (tms ?? []) as any[]) add(t.guardian_id, programByTeam[t.team_id])
  }

  return out
}

function isMainWorkspaceExpected(programs: Set<string> | undefined): boolean {
  if (!programs || programs.size === 0) return true // no determinable affiliation — don't exclude
  return [...programs].some((p) => MAIN_WORKSPACE_PROGRAMS.has(p))
}

// Who is EXPECTED in the main workspace: guardians of registered families this
// season, plus cleared volunteers — excluding anyone whose ONLY program
// affiliation is VEX IQ (see MAIN_WORKSPACE_PROGRAMS above). Identity =
// slack_email || login_email, plus any known guardian_email_alias rows (design:
// docs/design_email_identity_v1_0.md §1) — a match on an alias counts too.
export async function gatherExpectedMembers(db: any, season: string): Promise<HubPerson[]> {
  const expected: HubPerson[] = []
  const programsByGuardian = await gatherGuardianPrograms(db, season)
  const guardianIds: string[] = []

  const { data: fseasons } = await db.from('family_season').select('family_id').eq('season', season).eq('status', 'registered')
  const familyIds = [...new Set(((fseasons ?? []) as any[]).map((f) => f.family_id).filter(Boolean))]
  if (familyIds.length) {
    const { data: gs } = await db.from('guardian').select('id, first_name, last_name, login_email, slack_email').in('family_id', familyIds)
    for (const g of (gs ?? []) as any[]) {
      if (!isMainWorkspaceExpected(programsByGuardian.get(g.id))) continue
      const email = g.slack_email || g.login_email
      if (email) { expected.push({ email, name: `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim(), kind: 'guardian', guardianId: g.id }); guardianIds.push(g.id) }
    }
  }

  const { data: vcs } = await db.from('volunteer_clearance').select('volunteer_id').eq('season', season).eq('status', 'cleared')
  const volIds = [...new Set(((vcs ?? []) as any[]).map((v) => v.volunteer_id).filter(Boolean))]
  if (volIds.length) {
    const { data: vps } = await db.from('volunteer_profile').select('id, guardian:guardian_id ( id, first_name, last_name, login_email, slack_email )').in('id', volIds)
    for (const vp of (vps ?? []) as any[]) {
      const g = Array.isArray(vp.guardian) ? vp.guardian[0] : vp.guardian
      if (!g || !isMainWorkspaceExpected(programsByGuardian.get(g.id))) continue
      const email = g.slack_email || g.login_email
      if (email) { expected.push({ email, name: `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim(), kind: 'volunteer', guardianId: g.id ?? null }); if (g.id) guardianIds.push(g.id) }
    }
  }

  if (guardianIds.length) {
    const { data: aliases } = await db.from('guardian_email_alias').select('guardian_id, email').in('guardian_id', [...new Set(guardianIds)])
    const aliasesByGuardian: Record<string, string[]> = {}
    for (const a of (aliases ?? []) as any[]) (aliasesByGuardian[a.guardian_id] ??= []).push(a.email)
    for (const p of expected) {
      if (p.guardianId && aliasesByGuardian[p.guardianId]?.length) p.altEmails = aliasesByGuardian[p.guardianId]
    }
  }

  return expected
}

// Registered/cleared students who already have a known email on file
// (slack_email / communication_email / fusion_education_email). Students are
// never "expected" to join (many legally can't — COPPA), but if one is
// already correctly recorded and it happens to match a real Slack account,
// that must be recognized — otherwise the reconciliation has no way to know
// they're accounted for and endlessly re-flags them as "unexpected" even
// though there's nothing to review. No program scoping here (unlike
// gatherExpectedMembers): once an email is genuinely on file, it's on file
// regardless of which workspace-scoping question applies to invites.
export async function gatherKnownStudents(db: any, season: string): Promise<HubPerson[]> {
  const { data: fseasons } = await db.from('family_season').select('family_id').eq('season', season).in('status', ['registered', 'cleared_to_register'])
  const familyIds = [...new Set(((fseasons ?? []) as any[]).map((f) => f.family_id).filter(Boolean))]
  if (!familyIds.length) return []
  const { data: studs } = await db.from('student').select('id, family_id, first_name, last_name, slack_email, communication_email, fusion_education_email').in('family_id', familyIds)
  const out: HubPerson[] = []
  for (const s of (studs ?? []) as any[]) {
    const email = s.slack_email || s.communication_email || s.fusion_education_email
    if (!email) continue
    out.push({ email, name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(), kind: 'student', guardianId: null })
  }
  return out
}

// Every email on file for an under-13 student — none of these may hold a Slack
// account (COPPA policy; register flow already blocks consent under 13).
export async function gatherUnder13Emails(db: any): Promise<string[]> {
  const { data: studs } = await db.from('student').select('birthdate, communication_email, slack_email, fusion_education_email')
  const out: string[] = []
  for (const s of (studs ?? []) as any[]) {
    if (!s.birthdate || !isUnder13(s.birthdate)) continue
    for (const e of [s.communication_email, s.slack_email, s.fusion_education_email]) if (e) out.push(e)
  }
  return out
}

// guardianId → team Slack channel IDs they belong in: teams they actively coach
// plus teams their students are on (channel set on the team row, this season).
export async function gatherChannelPlacements(db: any, season: string): Promise<Record<string, Set<string>>> {
  const { data: teams } = await db.from('team').select('id, slack_channel_id').eq('season', season)
  const channelByTeam: Record<string, string> = {}
  for (const t of (teams ?? []) as any[]) if (t.slack_channel_id) channelByTeam[t.id] = t.slack_channel_id
  const teamIds = Object.keys(channelByTeam)
  const placements: Record<string, Set<string>> = {}
  if (!teamIds.length) return placements

  const { data: members } = await db
    .from('team_member')
    .select('team_id, guardian_id, student_id, team_role')
    .in('team_id', teamIds)
    .eq('season', season)
    .is('revoked_at', null)
  const add = (gid: string | null, teamId: string) => {
    if (gid) (placements[gid] ??= new Set()).add(channelByTeam[teamId])
  }
  const studentTeams: { studentId: string; teamId: string }[] = []
  for (const m of (members ?? []) as any[]) {
    if (m.guardian_id) add(m.guardian_id, m.team_id)
    else if (m.student_id) studentTeams.push({ studentId: m.student_id, teamId: m.team_id })
  }

  if (studentTeams.length) {
    const studentIds = [...new Set(studentTeams.map((s) => s.studentId))]
    const { data: studs } = await db.from('student').select('id, family_id').in('id', studentIds)
    const familyByStudent: Record<string, string> = Object.fromEntries(((studs ?? []) as any[]).map((s) => [s.id, s.family_id]))
    const familyIds = [...new Set(Object.values(familyByStudent).filter(Boolean))]
    const { data: gs } = familyIds.length ? await db.from('guardian').select('id, family_id').in('family_id', familyIds) : { data: [] }
    const guardiansByFamily: Record<string, string[]> = {}
    for (const g of (gs ?? []) as any[]) (guardiansByFamily[g.family_id] ??= []).push(g.id)
    for (const st of studentTeams) {
      for (const gid of guardiansByFamily[familyByStudent[st.studentId]] ?? []) add(gid, st.teamId)
    }
  }

  return placements
}

export type SlackReconRun = {
  recon: SlackReconciliation
  expectedCount: number
  invitesSent: number
  inviteErrors: number
  matchedRecorded: number
}

// Full reconciliation pass. `act: false` (admin page) computes the report only;
// `act: true` (nightly cron) also records matches on guardian rows and performs
// the ADDITIVE channel placement — removals always stay in the admin queue (D11).
export async function runSlackReconciliation(db: any, token: string, season: string, act: boolean): Promise<SlackReconRun> {
  const [expected, knownStudents, under13Emails, slackUsers] = await Promise.all([
    gatherExpectedMembers(db, season),
    gatherKnownStudents(db, season),
    gatherUnder13Emails(db),
    listSlackUsers(token),
  ])
  const recon = reconcileSlack({ expected: [...expected, ...knownStudents], under13Emails, slackUsers })
  const run: SlackReconRun = { recon, expectedCount: expected.length, invitesSent: 0, inviteErrors: 0, matchedRecorded: 0 }
  if (!act) return run

  // Record the match on the guardian (slack_user_id + invite accepted).
  for (const m of recon.matched) {
    if (!m.person.guardianId) continue
    await db.from('guardian').update({ slack_user_id: m.slackUserId, slack_invite_status: 'accepted' }).eq('id', m.person.guardianId)
    run.matchedRecorded++
  }

  // Post-join channel placement (additive only). sync_log records real actions,
  // not already-in-channel no-ops.
  const placements = await gatherChannelPlacements(db, season)
  for (const m of recon.matched) {
    if (!m.person.guardianId) continue
    for (const channelId of placements[m.person.guardianId] ?? []) {
      const res = await inviteToChannel(token, channelId, m.slackUserId)
      if (res.ok && !res.alreadyIn) run.invitesSent++
      else if (!res.ok) run.inviteErrors++
      if (!res.alreadyIn) {
        await db.from('sync_log').insert({
          sync_type: 'slack_channel_invite',
          action: 'invite',
          email: m.person.email,
          slack_group: channelId,
          success: res.ok,
          error_message: res.ok ? null : res.error ?? 'unknown',
        })
      }
    }
  }

  return run
}

// Candidate pool for fuzzy name matching: guardians we're specifically missing
// (notJoined — from this same reconciliation pass, so already program-scoped)
// plus every student on a registered/cleared family this season. Students
// aren't part of "expected" at all today (no per-student Slack expectation is
// tracked), so all of them are offered as candidates rather than a filtered
// "not joined" subset.
export async function gatherFuzzyMatchCandidates(db: any, season: string, notJoined: HubPerson[]): Promise<FuzzyMatchCandidate[]> {
  const candidates: FuzzyMatchCandidate[] = []
  for (const p of notJoined) {
    if (p.guardianId) candidates.push({ id: p.guardianId, name: p.name, kind: 'guardian' })
  }

  const { data: fseasons } = await db.from('family_season').select('family_id').eq('season', season).in('status', ['registered', 'cleared_to_register'])
  const familyIds = [...new Set(((fseasons ?? []) as any[]).map((f) => f.family_id).filter(Boolean))]
  if (familyIds.length) {
    const { data: studs } = await db.from('student').select('id, family_id, first_name, last_name').in('family_id', familyIds)
    for (const s of (studs ?? []) as any[]) {
      const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
      if (name) candidates.push({ id: s.id, name, kind: 'student' })
    }
  }

  return candidates
}

// Fuzzy-match "unexpected" Slack members (in the workspace, but not matched to
// anyone we know) against people we're missing, by name. Read-only / proposal
// only — see app/api/admin/slack/confirm-alt-email/route.ts for the write side
// an admin triggers after reviewing each suggestion.
export async function computeFuzzyMatches(db: any, season: string, recon: SlackReconciliation): Promise<FuzzyMatch[]> {
  const candidates = await gatherFuzzyMatchCandidates(db, season, recon.notJoined)
  return fuzzyMatchUnexpected(recon.unexpected, candidates)
}

export type SlackDisposition = { tags: string[]; notes: string | null }

// Standing per-account decisions (Alumni, Volunteer, Dropped, etc. — see
// app/admin/slack/disposition-editor.tsx) keyed by slack_user_id, which is
// stable across email changes. Lets /admin/slack separate "already reviewed"
// from "genuinely new" on every future sync instead of re-surfacing the same
// people every time.
export async function gatherSlackDispositions(db: any): Promise<Record<string, SlackDisposition>> {
  const { data } = await db.from('slack_member_disposition').select('slack_user_id, tags, notes')
  const out: Record<string, SlackDisposition> = {}
  for (const row of (data ?? []) as any[]) out[row.slack_user_id] = { tags: row.tags ?? [], notes: row.notes ?? null }
  return out
}
