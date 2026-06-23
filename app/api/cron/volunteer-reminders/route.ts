import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { sendEmail, apsReminderHtml, volunteerRenewalReminderHtml } from '@/lib/email'
import { syncApsForAll } from '@/lib/aps'

const SEASON = '2026-27'
const PRIOR_SEASON = '2025-26'

function unwrapGuardian(row: any): { first_name?: string; last_name?: string; login_email?: string } | null {
  const vp = Array.isArray(row?.volunteer) ? row.volunteer[0] : row?.volunteer
  if (!vp) return null
  return Array.isArray(vp.guardian) ? vp.guardian[0] : vp.guardian
}

// GET /api/cron/volunteer-reminders — daily. Sends APS expiry warnings (90/30/14
// days) and, from September on, an annual renewal nudge to prior-season-cleared
// volunteers who haven't started this season. Vercel cron authenticates via
// CRON_SECRET; an admin can also trigger it manually.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  if (!isCron && !(await getAdminProfile())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  const db = createAdminClient()
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const now = new Date()
  let apsSent = 0
  let renewalSent = 0

  // Refresh APS certificate data first so reminders run off fresh dates.
  let apsSync: { updated: number; skipped: number; errors: number } | null = null
  if (process.env.APS_API_KEY) {
    apsSync = (await syncApsForAll(db, process.env.APS_API_KEY, process.env.APS_SURVEY_CODE || undefined)).summary
  }

  // --- APS expiry reminders (90/30/14 days) ---
  const { data: clearances } = await db
    .from('volunteer_clearance')
    .select('id, volunteer_id, reminder_90_sent_at, reminder_30_sent_at, reminder_14_sent_at, volunteer:volunteer_id ( guardian:guardian_id ( first_name, last_name, login_email ) )')
    .eq('season', SEASON)

  for (const c of clearances ?? []) {
    const cert = (await db.from('youth_protection_cert').select('expiration_date').eq('volunteer_id', c.volunteer_id).order('expiration_date', { ascending: false }).limit(1).maybeSingle()).data
    if (!cert?.expiration_date) continue
    const days = Math.ceil((new Date(cert.expiration_date).getTime() - now.getTime()) / 86400000)
    if (days < 0) continue
    let field: string | null = null
    if (days <= 14 && !c.reminder_14_sent_at) field = 'reminder_14_sent_at'
    else if (days <= 30 && !c.reminder_30_sent_at) field = 'reminder_30_sent_at'
    else if (days <= 90 && !c.reminder_90_sent_at) field = 'reminder_90_sent_at'
    if (!field) continue
    const g = unwrapGuardian(c)
    if (!g?.login_email) continue
    const name = `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim()
    const r = await sendEmail({ to: [g.login_email], subject: `Your APS certificate expires ${cert.expiration_date}`, html: apsReminderHtml({ name, expiry: cert.expiration_date, days }) })
    if (r.ok) { await db.from('volunteer_clearance').update({ [field]: now.toISOString() }).eq('id', c.id); apsSent++ }
  }

  // --- Annual renewal nudge (September onward) ---
  if (now.getMonth() >= 8) {
    const { data: priorCleared } = await db
      .from('volunteer_clearance')
      .select('id, volunteer_id, volunteer:volunteer_id ( guardian:guardian_id ( first_name, last_name, login_email ) )')
      .eq('season', PRIOR_SEASON)
      .eq('status', 'cleared')
      .is('renewal_reminder_sent_at', null)

    for (const pc of priorCleared ?? []) {
      const cur = (await db.from('volunteer_clearance').select('rc_quiz_passed, yp_quiz_passed, waiver_signed_date').eq('volunteer_id', pc.volunteer_id).eq('season', SEASON).maybeSingle()).data
      if (cur && (cur.rc_quiz_passed || cur.yp_quiz_passed || cur.waiver_signed_date)) continue
      const g = unwrapGuardian(pc)
      if (!g?.login_email) continue
      const name = `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim()
      const statusLines = ['APS certificate: renewal required', 'Robotics Center Quiz: not completed this season', 'Youth Protection Quiz: not completed this season', 'Annual waiver: not signed this season']
      const r = await sendEmail({ to: [g.login_email], subject: `${SEASON} Placer Robotics Volunteer Renewal Required`, html: volunteerRenewalReminderHtml({ name, season: SEASON, statusLines, renewUrl: `${site}/volunteer/renew` }) })
      if (r.ok) { await db.from('volunteer_clearance').update({ renewal_reminder_sent_at: now.toISOString() }).eq('id', pc.id); renewalSent++ }
    }
  }

  return NextResponse.json({ ok: true, apsSync, apsSent, renewalSent })
}
