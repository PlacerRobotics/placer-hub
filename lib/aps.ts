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

type ApsUser = { id: number; first_name?: string; last_name?: string; email?: string; direct_login_url?: string; external_id?: string }

// GET a user (has direct_login_url — a one-click link into their training).
export async function getApsUser(apiKey: string, userId: string): Promise<ApsUser | null> {
  const res = await fetch(`${APS_BASE}/users/${encodeURIComponent(userId)}`, { headers: { Authorization: `Token token=${apiKey}` } })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

// Create (enroll) a user — the account auto-assigns its training; returns the new
// user with a personal direct_login_url. user_type 'employee' = a Registered Volunteer.
export async function createApsUser(apiKey: string, u: { first_name: string; last_name: string; email: string; external_id?: string }): Promise<ApsUser | null> {
  const res = await fetch(`${APS_BASE}/users`, {
    method: 'POST',
    headers: { Authorization: `Token token=${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: u.first_name, last_name: u.last_name, email: u.email, user_type: 'employee', ...(u.external_id ? { external_id: u.external_id } : {}) }),
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

// Ensure a volunteer is enrolled in APS training and return their personal training
// link. Existing APS users → fetch direct_login_url; new ones → create the APS user
// (storing aps_user_id + aps_training_url so the daily sync can track their cert).
export async function enrollApsTraining(db: any, apiKey: string, volunteerId: string): Promise<{ ok: boolean; url?: string; created?: boolean; error?: string }> {
  const { data: vp } = await db.from('volunteer_profile').select('id, aps_user_id, aps_external_id, guardian:guardian_id ( first_name, last_name, login_email )').eq('id', volunteerId).maybeSingle()
  if (!vp) return { ok: false, error: 'Volunteer not found.' }
  const g: any = Array.isArray(vp.guardian) ? vp.guardian[0] : vp.guardian

  if (vp.aps_user_id) {
    const u = await getApsUser(apiKey, String(vp.aps_user_id))
    if (!u?.direct_login_url) return { ok: false, error: 'Could not reach APS for this user.' }
    await db.from('volunteer_profile').update({ aps_training_url: u.direct_login_url }).eq('id', volunteerId)
    return { ok: true, url: u.direct_login_url }
  }

  if (!g?.login_email) return { ok: false, error: 'No email on file for this volunteer.' }
  // New APS users get a sequential external_id starting at 200000 (kept separate from
  // the legacy 1000xx range), unless the volunteer already has one on file.
  let externalId: string | undefined = vp.aps_external_id ? String(vp.aps_external_id) : undefined
  if (!externalId) {
    const { data: rows } = await db.from('volunteer_profile').select('aps_external_id').not('aps_external_id', 'is', null)
    const max = Math.max(199999, ...((rows ?? []).map((r: any) => parseInt(String(r.aps_external_id), 10)).filter((n: number) => Number.isFinite(n) && n >= 200000)))
    externalId = String(max + 1)
  }
  const created = await createApsUser(apiKey, { first_name: g.first_name ?? '', last_name: g.last_name ?? '', email: g.login_email, external_id: externalId })
  if (!created?.id) return { ok: false, error: 'APS user creation failed.' }
  // Hub-created APS accounts always use login_email — recording it now means
  // this volunteer never joins the "forgot my APS login" class §1.5 exists for.
  await db.from('volunteer_profile').update({ aps_user_id: String(created.id), aps_external_id: externalId, aps_training_url: created.direct_login_url ?? null, aps_email: g.login_email }).eq('id', volunteerId)
  return { ok: true, url: created.direct_login_url, created: true }
}

// ── Bulk renewal enrollment (task 1.10) ─────────────────────────────────────

// Profile statuses an admin has closed off — never bulk-enroll these.
const APS_EXCLUDED_STATUSES = new Set(['denied', 'deactivated', 'suspended', 'withdrawn'])

/**
 * Pure eligibility rule: a volunteer needs APS renewal enrollment when their
 * latest cert doesn't carry them through season end (or they have no cert at
 * all — which covers never-enrolled volunteers), unless an admin has closed
 * their profile. `validThrough` = season-end date (lib/volunteer APS_VALID_THROUGH).
 */
export function needsApsRenewal(v: { status: string; latestExpiry: string | null }, validThrough: string): boolean {
  if (APS_EXCLUDED_STATUSES.has(v.status)) return false
  return !v.latestExpiry || v.latestExpiry < validThrough
}

export type ApsRenewalCandidate = {
  volunteerId: string
  name: string
  email: string
  hasApsAccount: boolean
  latestExpiry: string | null
}

// Everyone the bulk-enroll run would touch. Shared by the preview and the run
// itself so the admin confirms exactly what will execute.
export async function listApsRenewalCandidates(db: any, validThrough: string): Promise<ApsRenewalCandidate[]> {
  const { data: vols } = await db
    .from('volunteer_profile')
    .select('id, status, aps_user_id, guardian:guardian_id ( first_name, last_name, login_email )')
  const { data: certs } = await db
    .from('youth_protection_cert')
    .select('volunteer_id, expiration_date')
    .order('expiration_date', { ascending: false })
  const latestByVol: Record<string, string> = {}
  for (const c of certs ?? []) if (!latestByVol[c.volunteer_id]) latestByVol[c.volunteer_id] = c.expiration_date

  return (vols ?? [])
    .map((v: any) => {
      const g = Array.isArray(v.guardian) ? v.guardian[0] : v.guardian
      return {
        volunteerId: v.id as string,
        status: v.status as string,
        name: g ? `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() : 'Unknown volunteer',
        email: g?.login_email ?? '',
        hasApsAccount: !!v.aps_user_id,
        latestExpiry: latestByVol[v.id] ?? null,
      }
    })
    .filter((v: any) => v.email && needsApsRenewal(v, validThrough))
    .map(({ status: _s, ...rest }: any) => rest as ApsRenewalCandidate)
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

// ── APS login email of record (task: docs/design_email_identity_v1_0.md §1.5) ──
//
// Backfills volunteer_profile.aps_email — the MinistrySafe account's login
// email — from the MinistrySafe API itself (GET /users/:id already returns
// it), so nobody has to remember a years-old yahoo/outlook address. Also
// records that address as a guardian_email_alias (source 'aps_legacy') so a
// future import/roster-add under the same address resolves to the real
// guardian instead of minting a duplicate family. Only fills volunteers
// missing aps_email — safe to re-run, and cheap since it usually touches
// nothing after the first pass.
export async function backfillApsEmails(db: any, apiKey: string) {
  const { data: vols } = await db
    .from('volunteer_profile')
    .select('id, guardian_id, aps_user_id, guardian:guardian_id ( first_name, last_name )')
    .not('aps_user_id', 'is', null)
    .is('aps_email', null)

  const summary = { updated: 0, skipped: 0, errors: 0 }
  const results: { name: string; status: string }[] = []
  for (const v of vols ?? []) {
    const g: any = Array.isArray(v.guardian) ? v.guardian[0] : v.guardian
    const name = g ? `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() : v.aps_user_id
    try {
      const u = await getApsUser(apiKey, String(v.aps_user_id))
      const email = (u?.email ?? '').trim().toLowerCase()
      if (!email) { summary.skipped++; results.push({ name, status: 'MinistrySafe has no email on file' }); continue }
      await db.from('volunteer_profile').update({ aps_email: email }).eq('id', v.id)
      // Best-effort — a collision here just means the address is already
      // known (as someone's login or another alias); never worth failing over.
      const { data: clash } = await db.from('guardian').select('id').ilike('login_email', email).maybeSingle()
      if (!clash) await db.from('guardian_email_alias').insert({ guardian_id: v.guardian_id, email, source: 'aps_legacy' })
      summary.updated++; results.push({ name, status: email })
    } catch (e: any) {
      summary.errors++; results.push({ name, status: `error: ${e?.message ?? 'failed'}` })
    }
  }
  return { summary, results }
}
