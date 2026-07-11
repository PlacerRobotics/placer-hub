// Hub-side data gathering + orchestration for Slack reconciliation (task 1.6).
// The bucket math itself is pure and lives in lib/slack.ts; this file owns the
// database reads (service-role client) and the additive bot actions.

import { listSlackUsers, reconcileSlack, inviteToChannel, type HubPerson, type SlackReconciliation } from './slack'
import { isUnder13 } from './compliance'

// Who is EXPECTED in the main workspace: guardians of registered families this
// season, plus cleared volunteers. Identity = slack_email || login_email (PRD §19).
export async function gatherExpectedMembers(db: any, season: string): Promise<HubPerson[]> {
  const expected: HubPerson[] = []

  const { data: fseasons } = await db.from('family_season').select('family_id').eq('season', season).eq('status', 'registered')
  const familyIds = [...new Set(((fseasons ?? []) as any[]).map((f) => f.family_id).filter(Boolean))]
  if (familyIds.length) {
    const { data: gs } = await db.from('guardian').select('id, first_name, last_name, login_email, slack_email').in('family_id', familyIds)
    for (const g of (gs ?? []) as any[]) {
      const email = g.slack_email || g.login_email
      if (email) expected.push({ email, name: `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim(), kind: 'guardian', guardianId: g.id })
    }
  }

  const { data: vcs } = await db.from('volunteer_clearance').select('volunteer_id').eq('season', season).eq('status', 'cleared')
  const volIds = [...new Set(((vcs ?? []) as any[]).map((v) => v.volunteer_id).filter(Boolean))]
  if (volIds.length) {
    const { data: vps } = await db.from('volunteer_profile').select('id, guardian:guardian_id ( id, first_name, last_name, login_email, slack_email )').in('id', volIds)
    for (const vp of (vps ?? []) as any[]) {
      const g = Array.isArray(vp.guardian) ? vp.guardian[0] : vp.guardian
      const email = g?.slack_email || g?.login_email
      if (email) expected.push({ email, name: `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim(), kind: 'volunteer', guardianId: g.id ?? null })
    }
  }

  return expected
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
  const [expected, under13Emails, slackUsers] = await Promise.all([
    gatherExpectedMembers(db, season),
    gatherUnder13Emails(db),
    listSlackUsers(token),
  ])
  const recon = reconcileSlack({ expected, under13Emails, slackUsers })
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
