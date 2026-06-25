import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, apsReminderHtml, volunteerWaiverReminderHtml } from '@/lib/email'
import { VOLUNTEER_SEASON as SEASON } from '@/lib/volunteer'

const chunk = <T,>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

// POST /api/admin/volunteers/bulk — coordinator bulk actions on selected volunteers.
// action: 'doj_complete' | 'notify_waiver' | 'notify_aps'. volunteerIds = profile ids.
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const ids: string[] = Array.isArray(body.volunteerIds) ? body.volunteerIds.filter((x: any) => typeof x === 'string') : []
  const action = String(body.action ?? '')
  if (!ids.length) return NextResponse.json({ error: 'No volunteers selected.' }, { status: 400 })

  const db = createAdminClient()
  const now = new Date().toISOString()
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const idSet = new Set(ids)

  if (action === 'doj_complete') {
    // Single array upsert — ids ride in the POST body, so no URL-length limit.
    const rows = ids.map((vid) => ({ volunteer_id: vid, step: 'background_check', status: 'complete', completed_at: now }))
    const { error } = await db.from('volunteer_step').upsert(rows, { onConflict: 'volunteer_id,step' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action, processed: ids.length })
  }

  if (action === 'notify_waiver' || action === 'notify_aps') {
    // Load all profiles and filter in memory (avoid an oversized .in()).
    const { data: vpsAll } = await db.from('volunteer_profile').select('id, guardian:guardian_id ( first_name, last_name, login_email )')
    const vps = (vpsAll ?? []).filter((v: any) => idSet.has(v.id))

    const certByVol: Record<string, string> = {}
    if (action === 'notify_aps') {
      const { data: certs } = await db.from('youth_protection_cert').select('volunteer_id, expiration_date').order('expiration_date', { ascending: false })
      for (const c of (certs ?? []) as any[]) if (!certByVol[c.volunteer_id]) certByVol[c.volunteer_id] = c.expiration_date
    }

    let emailed = 0, skipped = 0, failed = 0, emailDisabled = false
    for (const v of vps as any[]) {
      const g = Array.isArray(v.guardian) ? v.guardian[0] : v.guardian
      const email = g?.login_email
      const name = g ? `${g.first_name} ${g.last_name}`.trim() : ''
      if (!email) { skipped++; continue }
      let r: { ok: boolean; error?: string }
      if (action === 'notify_waiver') {
        r = await sendEmail({ to: [email], subject: `Sign your ${SEASON} volunteer agreement`, html: volunteerWaiverReminderHtml({ name, season: SEASON, waiverUrl: `${site}/volunteer/waiver` }) })
      } else {
        const exp = certByVol[v.id]
        if (!exp) { skipped++; continue }
        const days = Math.max(0, Math.round((new Date(exp).getTime() - Date.now()) / 86400000))
        r = await sendEmail({ to: [email], subject: `Your APS certificate expires ${exp}`, html: apsReminderHtml({ name, expiry: exp, days }) })
      }
      if (r.ok) emailed++
      else { failed++; if (r.error === 'no_api_key') emailDisabled = true }
    }
    return NextResponse.json({ ok: true, action, emailed, skipped, failed, emailDisabled })
  }

  if (action === 'mark_cleared' || action === 'suspend' || action === 'orientation_done') {
    const today = now.slice(0, 10)
    // Updates put the id filter in the URL too, so chunk to stay under the limit.
    for (const batch of chunk(ids, 50)) {
      if (action === 'orientation_done') {
        const { error } = await db.from('volunteer_clearance').update({ orientation_completed: true, orientation_completed_date: today }).in('volunteer_id', batch).eq('season', SEASON)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const status = action === 'mark_cleared' ? 'cleared' : 'suspended'
        const clearancePatch: Record<string, unknown> = { status }
        const profilePatch: Record<string, unknown> = { status }
        if (action === 'mark_cleared') { clearancePatch.approved_by = admin.id; clearancePatch.approved_at = now; profilePatch.cleared_at = now }
        const { error: e1 } = await db.from('volunteer_clearance').update(clearancePatch).in('volunteer_id', batch).eq('season', SEASON)
        if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
        const { error: e2 } = await db.from('volunteer_profile').update(profilePatch).in('id', batch)
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true, action, processed: ids.length })
  }

  // Admin-only lifecycle: Denied / Deactivated (and reactivate back to In Progress).
  if (action === 'deny' || action === 'deactivate' || action === 'reactivate') {
    const status = action === 'deny' ? 'denied' : action === 'deactivate' ? 'deactivated' : 'in_progress'
    for (const batch of chunk(ids, 50)) {
      const { error: e1 } = await db.from('volunteer_profile').update({ status }).in('id', batch)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      const { error: e2 } = await db.from('volunteer_clearance').update({ status }).in('volunteer_id', batch).eq('season', SEASON)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action, processed: ids.length })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
