import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createSupa } from '@supabase/supabase-js'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

/**
 * POST /api/admin/registrations/bulk
 * body: { action: 'send_invites' | 'cancel' | 'assign_team', ids: string[], team_id?: string }
 *  - send_invites / cancel: ids are family_season ids
 *  - assign_team: ids are student ids (+ team_id)
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const action = String(body.action ?? '')
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  if (!ids.length) return NextResponse.json({ error: 'No rows selected.' }, { status: 400 })

  const db = createAdminClient()

  if (action === 'cancel') {
    let count = 0
    for (const fsId of ids) {
      const { data: fs } = await db.from('family_season').select('status').eq('id', fsId).maybeSingle()
      if (!fs) continue
      await db.from('family_season').update({ status: 'cancelled' }).eq('id', fsId)
      await logRegAudit(db, { familySeasonId: fsId, field: 'status', oldValue: fs.status, newValue: 'cancelled', changedBy: admin.id })
      count++
    }
    return NextResponse.json({ ok: true, cancelled: count })
  }

  if (action === 'send_invites') {
    // Only cleared_to_register + not yet invited. One email per unique guardian.
    const { data: rows } = await db
      .from('family_season')
      .select('id, magic_link_sent, status, family:family_id ( primary_email )')
      .in('id', ids)
      .eq('status', 'cleared_to_register')
      .eq('magic_link_sent', false)
    const eligible = (rows ?? []) as any[]
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const sender = createSupa(url, anon)
    const sentEmails = new Set<string>()
    let sent = 0
    const failures: string[] = []
    for (const fs of eligible) {
      const email = fs.family?.primary_email
      if (!email) continue
      if (!sentEmails.has(email)) {
        const { error } = await sender.auth.signInWithOtp({ email, options: { emailRedirectTo: `${site}/api/auth/callback` } })
        if (error) { failures.push(`${email}: ${error.message}`); continue }
        sentEmails.add(email)
        sent++
      }
      await db.from('family_season').update({ magic_link_sent: true }).eq('id', fs.id)
      await logRegAudit(db, { familySeasonId: fs.id, field: 'magic_link_sent', oldValue: 'false', newValue: 'true', changedBy: admin.id, notes: `bulk invite to ${email}` })
    }
    return NextResponse.json({ ok: true, sent, guardians: sentEmails.size, failures })
  }

  if (action === 'assign_team') {
    const teamId = String(body.team_id ?? '')
    if (!teamId) return NextResponse.json({ error: 'team_id is required.' }, { status: 400 })
    let count = 0
    const skipped: string[] = []
    for (const studentId of ids) {
      const { data: enr } = await db.from('enrollment').select('id, program').eq('student_id', studentId).eq('season', SEASON).maybeSingle()
      if (!enr) { skipped.push(studentId); continue }
      const { data: existing } = await db.from('team_member').select('id, team_id').eq('enrollment_id', enr.id).eq('season', SEASON).eq('team_role', 'student').maybeSingle()
      if (existing) await db.from('team_member').update({ team_id: teamId }).eq('id', existing.id)
      else await db.from('team_member').insert({ team_id: teamId, enrollment_id: enr.id, student_id: studentId, season: SEASON, team_role: 'student', program: enr.program })
      const { data: stu } = await db.from('student').select('family_id').eq('id', studentId).maybeSingle()
      const { data: fs } = stu?.family_id
        ? await db.from('family_season').select('id').eq('family_id', stu.family_id).eq('season', SEASON).maybeSingle()
        : { data: null as any }
      if (fs?.id) await logRegAudit(db, { familySeasonId: fs.id, field: 'team', oldValue: existing?.team_id ?? null, newValue: teamId, changedBy: admin.id, notes: `bulk · student ${studentId}` })
      count++
    }
    return NextResponse.json({ ok: true, assigned: count, skipped })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
