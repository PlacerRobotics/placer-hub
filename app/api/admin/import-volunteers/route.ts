import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { APS_VALID_THROUGH } from '@/lib/volunteer'

const DEFAULT_SEASON = '2026-27'

const yes = (v: any) => ['yes', 'true', 'y', '1', 'x'].includes(String(v ?? '').trim().toLowerCase())
const intOrNull = (v: any) => { const n = parseInt(String(v ?? '').trim(), 10); return Number.isFinite(n) ? n : null }
const dateOrNull = (v: any) => { const s = String(v ?? '').trim(); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10) }

// POST /api/admin/import-volunteers — bulk create/update volunteers from CSV rows.
// Maps onto the EXISTING guardian-linked model: guardian+family (identity),
// volunteer_profile (status), volunteer_clearance (per-season quizzes/key/status),
// youth_protection_cert (APS), volunteer_step (background_check = DOJ).
// Team assignments are NOT touched — those live in team_member. No magic links.
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: 'No rows.' }, { status: 400 })

  const db = createAdminClient()
  const summary = { volunteersCreated: 0, volunteersUpdated: 0, clearances: 0, errors: 0 }
  const results: { name: string; email: string; status: string }[] = []

  for (const r of rows) {
    const email = String(r.email ?? '').trim().toLowerCase()
    const first = String(r.first_name ?? '').trim()
    const last = String(r.last_name ?? '').trim()
    const name = `${first} ${last}`.trim()
    if (!email || !first || !last) { results.push({ name: name || '(blank)', email, status: 'skipped (missing name/email)' }); continue }

    try {
      // 1. Guardian + family.
      let g = (await db.from('guardian').select('id, family_id').ilike('login_email', email).maybeSingle()).data
      let created = false
      if (!g) {
        const { data: fam, error: fe } = await db.from('family').insert({ primary_email: email, display_name: last }).select('id').single()
        if (fe) throw new Error(fe.message)
        const { data: ng, error: ge } = await db.from('guardian').insert({ family_id: fam.id, first_name: first, last_name: last, login_email: email, phone: String(r.phone ?? '').trim() || '', role: 'primary' }).select('id, family_id').single()
        if (ge) throw new Error(ge.message)
        g = ng
      } else if (r.phone) {
        await db.from('guardian').update({ phone: String(r.phone).trim() }).eq('id', g.id)
      }

      // 2. Compute completion + status.
      const season = String(r.season ?? '').trim() || DEFAULT_SEASON
      const rcPassed = yes(r.rc_quiz_passed), ypPassed = yes(r.yp_quiz_passed), doj = yes(r.doj_cleared)
      const apsExpiry = dateOrNull(r.aps_cert_expiry)
      const apsValid = !!apsExpiry && apsExpiry >= APS_VALID_THROUGH
      const approved = yes(r.approved)
      const allComplete = rcPassed && ypPassed && doj && apsValid
      const status = approved ? (allComplete ? 'cleared' : 'in_progress') : 'pending'

      // 3. volunteer_profile (unique on guardian_id).
      let vp = (await db.from('volunteer_profile').select('id').eq('guardian_id', g.id).maybeSingle()).data
      if (!vp) {
        const { data: nvp, error: ve } = await db.from('volunteer_profile').insert({ guardian_id: g.id, family_id: g.family_id, status, applied_at: new Date().toISOString(), cleared_at: status === 'cleared' ? new Date().toISOString() : null, aps_user_id: String(r.aps_user_id ?? '').trim() || null, aps_external_id: String(r.aps_external_id ?? '').trim() || null }).select('id').single()
        if (ve) throw new Error(ve.message)
        vp = nvp; created = true
      } else {
        await db.from('volunteer_profile').update({ status, aps_user_id: String(r.aps_user_id ?? '').trim() || undefined, aps_external_id: String(r.aps_external_id ?? '').trim() || undefined }).eq('id', vp.id)
      }

      // 4. Per-season clearance (notes capture the fields with no dedicated column).
      const noteBits = [
        yes(r.is_returning) ? 'Returning volunteer' : '',
        r.aps_score ? `APS score: ${r.aps_score}` : '',
        (r.street_address || r.city) ? `Address: ${[r.street_address, r.city, r.state, r.zip].filter(Boolean).join(', ')}` : '',
        String(r.notes ?? '').trim(),
      ].filter(Boolean)
      const doorType = String(r.door_access_type ?? '').trim().toLowerCase()
      const hasDoor = yes(r.has_door_access) && (doorType === 'card' || doorType === 'phone')
      const clearancePayload: Record<string, unknown> = {
        volunteer_id: vp.id, season, status,
        application_submitted_at: new Date().toISOString(),
        rc_quiz_passed: rcPassed, rc_quiz_score: intOrNull(r.rc_quiz_score), rc_quiz_passed_date: dateOrNull(r.rc_quiz_passed_date),
        yp_quiz_passed: ypPassed, yp_quiz_score: intOrNull(r.yp_quiz_score), yp_quiz_passed_date: dateOrNull(r.yp_quiz_passed_date),
        key_access_requested: hasDoor ? doorType : 'none',
        key_access_granted: hasDoor,
        key_access_type: hasDoor ? doorType : 'none',
        key_access_granted_date: hasDoor ? new Date().toISOString().slice(0, 10) : null,
        notes: noteBits.join(' · ') || null,
      }
      const { error: ce } = await db.from('volunteer_clearance').upsert(clearancePayload, { onConflict: 'volunteer_id,season' })
      if (ce) throw new Error(ce.message)

      // 5. APS cert (existing youth_protection_cert). issued_date is a placeholder.
      if (apsExpiry) {
        const existingCert = (await db.from('youth_protection_cert').select('id').eq('volunteer_id', vp.id).eq('expiration_date', apsExpiry).maybeSingle()).data
        if (!existingCert) {
          const { error: ae } = await db.from('youth_protection_cert').insert({ volunteer_id: vp.id, expiration_date: apsExpiry, issued_date: apsExpiry, cert_url: String(r.aps_cert_url ?? '').trim() || null })
          if (ae) throw new Error(ae.message)
        }
      }

      // 6. DOJ → background_check step complete.
      if (doj) {
        const { error: de } = await db.from('volunteer_step').upsert({ volunteer_id: vp.id, step: 'background_check', status: 'complete', completed_at: new Date().toISOString() }, { onConflict: 'volunteer_id,step' })
        if (de) throw new Error(de.message)
      }

      summary.clearances++
      if (created) summary.volunteersCreated++; else summary.volunteersUpdated++
      results.push({ name, email, status: `${created ? 'created' : 'updated'} · ${status}` })
    } catch (e: any) {
      summary.errors++
      results.push({ name, email, status: `error: ${e?.message ?? 'failed'}` })
    }
  }

  return NextResponse.json({ ok: true, summary, results })
}
