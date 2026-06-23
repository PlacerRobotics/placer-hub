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
