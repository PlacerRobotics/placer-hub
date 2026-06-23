import { NextResponse } from 'next/server'
import { createClient as createSupa } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { sendEmail, iqTeamApprovedHtml } from '@/lib/email'

const SEASON = '2026-27'

// POST /api/admin/iq-teams/[id]/approve — IQ Coordinator (or super admin) approves a
// pending IQ team: flips it to active, clears each member family to register, and
// THEN sends the parent magic links (the gate the whole flow waits on).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const db = createAdminClient()
  if (!(await hasAnyRole(db, admin.id, ['iq_coordinator', 'super_admin']))) {
    return NextResponse.json({ error: 'Only the IQ Coordinator can approve IQ teams.' }, { status: 403 })
  }

  const { id: teamId } = await params
  const { data: team } = await db.from('team').select('id, program, active, team_name').eq('id', teamId).maybeSingle()
  if (!team || team.program !== 'vex_iq') return NextResponse.json({ error: 'IQ team not found.' }, { status: 404 })

  // Approve the team.
  await db.from('team').update({ status: 'active', active: true }).eq('id', teamId)

  // Roster families are linked via the application's triage_notes "iq_team:<id>".
  const { data: apps } = await db.from('student_application').select('family_id').eq('season', SEASON).ilike('triage_notes', `%iq_team:${teamId}%`)
  const familyIds = [...new Set((apps ?? []).map((a: any) => a.family_id))]
  if (familyIds.length) {
    // Clear each family to register (don't downgrade anyone already further along).
    await db.from('family_season').update({ status: 'cleared_to_register' }).in('family_id', familyIds).eq('season', SEASON).in('status', ['prospect', 'applied', 'accepted', 'needs_follow_up'])
    await db.from('family_season').update({ magic_link_sent: true }).in('family_id', familyIds).eq('season', SEASON)
  }

  // Send the magic links now.
  const { data: guardians } = familyIds.length
    ? await db.from('guardian').select('login_email').in('family_id', familyIds)
    : { data: [] as any[] }
  const emails = [...new Set((guardians ?? []).map((g: any) => String(g.login_email ?? '').toLowerCase()).filter(Boolean))]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const sender = createSupa(url, anon)
  let sent = 0
  const failed: string[] = []
  for (const em of emails) {
    const { error } = await sender.auth.signInWithOtp({ email: em, options: { emailRedirectTo: `${site}/api/auth/callback?redirectTo=/register` } })
    if (error) failed.push(em); else sent++
  }

  // Email the coach that their team is approved (best-effort).
  try {
    const { data: coachTm } = await db.from('team_member').select('guardian:guardian_id(login_email, first_name, last_name)').eq('team_id', teamId).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
    const cg = coachTm ? (Array.isArray((coachTm as any).guardian) ? (coachTm as any).guardian[0] : (coachTm as any).guardian) : null
    if (cg?.login_email) {
      const html = iqTeamApprovedHtml({ coachName: `${cg.first_name ?? ''} ${cg.last_name ?? ''}`.trim(), teamName: team.team_name ?? null, season: SEASON, hubUrl: `${site}/dashboard` })
      await sendEmail({ to: [cg.login_email], subject: `Your IQ team is approved — Placer Robotics ${SEASON}`, html })
    }
  } catch (e) { console.error('[iq-approve] coach email failed:', e) }

  return NextResponse.json({ ok: true, invited: sent, failed })
}
