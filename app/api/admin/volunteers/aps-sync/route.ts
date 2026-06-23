import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { fetchApsTrainings, pickTraining, expiryFromComplete } from '@/lib/aps'

// POST /api/admin/volunteers/aps-sync — pull APS (MinistrySafe) training results for
// every volunteer with an aps_user_id and update youth_protection_cert (expiry =
// complete_date + 2yr) + the aps_youth_protection step. Optional APS_SURVEY_CODE pins
// the specific course; otherwise the most recently completed training is used.
export async function POST() {
  if (!(await getAdminProfile())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const apiKey = process.env.APS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'APS_API_KEY is not set.' }, { status: 400 })
  const surveyCode = process.env.APS_SURVEY_CODE || undefined

  const db = createAdminClient()
  const { data: vols } = await db
    .from('volunteer_profile')
    .select('id, aps_user_id, guardian:guardian_id ( first_name, last_name )')
    .not('aps_user_id', 'is', null)

  const summary = { updated: 0, skipped: 0, errors: 0 }
  const results: { name: string; status: string }[] = []

  for (const v of vols ?? []) {
    const g: any = Array.isArray((v as any).guardian) ? (v as any).guardian[0] : (v as any).guardian
    const name = g ? `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() : (v as any).aps_user_id
    try {
      const trainings = await fetchApsTrainings(apiKey, (v as any).aps_user_id)
      const t = pickTraining(trainings, surveyCode)
      if (!t?.complete_date) { summary.skipped++; results.push({ name, status: 'no completed training' }); continue }
      const expiry = expiryFromComplete(t.complete_date)
      const issued = new Date(t.complete_date).toISOString().slice(0, 10)
      const exists = (await db.from('youth_protection_cert').select('id').eq('volunteer_id', v.id).eq('expiration_date', expiry).maybeSingle()).data
      if (!exists) await db.from('youth_protection_cert').insert({ volunteer_id: v.id, expiration_date: expiry, issued_date: issued, cert_url: t.certificate_url ?? null, aps_cert_id: t.id != null ? String(t.id) : null })
      await db.from('volunteer_step').upsert({ volunteer_id: v.id, step: 'aps_youth_protection', status: 'complete', completed_at: new Date().toISOString() }, { onConflict: 'volunteer_id,step' })
      summary.updated++; results.push({ name, status: `expires ${expiry}` })
    } catch (e: any) {
      summary.errors++; results.push({ name, status: `error: ${e?.message ?? 'failed'}` })
    }
  }

  return NextResponse.json({ ok: true, summary, results })
}
