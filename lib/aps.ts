// APS (powered by MinistrySafe "Safety System") training pull.
// Docs: https://abusepreventionsystems.com/developers/
// Auth: header `Authorization: Token token=<APS_API_KEY>`.
// The trainings response has no expiry — certs are valid 2 years from complete_date.

const APS_BASE = 'https://safetysystem.ministrysafe.com/api/v2'
export const APS_VALIDITY_YEARS = 2

export type ApsTraining = {
  id?: number
  winner?: boolean // completed/passed
  score?: number
  complete_date?: string // ISO 8601
  certificate_url?: string
  survey_name?: string
  survey_code?: string
}

export async function fetchApsTrainings(apiKey: string, userId: string): Promise<ApsTraining[]> {
  const res = await fetch(`${APS_BASE}/users/${encodeURIComponent(userId)}/trainings`, {
    headers: { Authorization: `Token token=${apiKey}` },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`APS ${res.status}`)
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data : (data?.trainings ?? [])
}

// Choose the training to record: completed only; pinned to surveyCode if provided,
// otherwise the most recently completed.
export function pickTraining(trainings: ApsTraining[], surveyCode?: string): ApsTraining | null {
  let done = trainings.filter((t) => t.winner && t.complete_date)
  if (surveyCode) done = done.filter((t) => t.survey_code === surveyCode)
  if (!done.length) return null
  done.sort((a, b) => ((b.complete_date ?? '') > (a.complete_date ?? '') ? 1 : -1))
  return done[0]
}

export function expiryFromComplete(completeDate: string, years = APS_VALIDITY_YEARS): string {
  const d = new Date(completeDate)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

// Pull APS training for every volunteer with an aps_user_id and update
// youth_protection_cert + the aps_youth_protection step. Shared by the manual
// "Sync from APS" button and the daily cron. `db` is a service-role client.
export async function syncApsForAll(db: any, apiKey: string, surveyCode?: string) {
  const { data: vols } = await db
    .from('volunteer_profile')
    .select('id, aps_user_id, guardian:guardian_id ( first_name, last_name )')
    .not('aps_user_id', 'is', null)

  const summary = { updated: 0, skipped: 0, errors: 0 }
  const results: { name: string; status: string }[] = []
  for (const v of vols ?? []) {
    const g: any = Array.isArray(v.guardian) ? v.guardian[0] : v.guardian
    const name = g ? `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() : v.aps_user_id
    try {
      const t = pickTraining(await fetchApsTrainings(apiKey, v.aps_user_id), surveyCode)
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
  return { summary, results }
}
