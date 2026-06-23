/**
 * Zeffy API client — read-only payment pulls for the registration campaign.
 * Mirrors the proven Apps Script integration (GET /api/v1/payments, Bearer
 * auth, cursor pagination). Shares the account's API key with other Zeffy
 * integrations (reads don't interfere with them).
 */
const ZEFFY_API = 'https://api.zeffy.com/api/v1'

export type ZeffyQuestion = { question?: string; answer?: unknown }
export type ZeffyItem = {
  id?: string
  rate_id?: string
  amount?: number
  price?: number
  questions?: ZeffyQuestion[]
}
export type ZeffyPayment = {
  id?: string
  status?: string
  amount?: number
  totalAmount?: number
  createdAt?: string
  created_at?: string
  buyer?: { email?: string; first_name?: string; last_name?: string }
  buyer_questions?: ZeffyQuestion[]
  items?: ZeffyItem[]
}

/** Find a question whose text contains `fragment` (case-insensitive); return its answer as a clean string. */
export function zeffyAnswer(questions: ZeffyQuestion[] | undefined, fragment: string): string {
  if (!questions) return ''
  const f = fragment.toLowerCase()
  const m = questions.find((q) => String(q.question || '').toLowerCase().includes(f))
  if (!m || m.answer == null) return ''
  if (typeof m.answer === 'boolean') return m.answer ? 'Yes' : 'No'
  return String(m.answer).trim().replace(/[–—]/g, '-')
}

/** Fetch all payments for a campaign (paginated, capped at 20 pages of 100). */
export async function fetchZeffyPayments(apiKey: string, campaignId: string): Promise<ZeffyPayment[]> {
  const all: ZeffyPayment[] = []
  let cursor: string | null = null
  for (let page = 0; page < 20; page++) {
    let url = `${ZEFFY_API}/payments?limit=100&campaign=${encodeURIComponent(campaignId)}`
    if (cursor) url += `&starting_after=${encodeURIComponent(cursor)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
    const json: any = await res.json()
    if (json.message || json.error) throw new Error(String(json.message ?? json.error))
    all.push(...((json.data ?? []) as ZeffyPayment[]))
    if (!json.has_more) break
    cursor = json.next_cursor ?? null
    if (!cursor) break
  }
  return all
}
