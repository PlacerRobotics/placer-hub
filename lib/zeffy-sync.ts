// Zeffy reconciliation cores — shared by the admin "Sync from Zeffy" buttons and the
// daily cron. db = service-role client. Both are idempotent (dedup by source_payment_id)
// and skip unmatched payments, so they're safe to run unattended.
import { fetchZeffyPayments, zeffyAnswer } from '@/lib/zeffy'
import { linkPaymentToEnrollment, SEASON } from '@/lib/payments'
import { sendEmail, iqTeamPaidNotifyHtml } from '@/lib/email'

type SyncResult = { ok: boolean; error?: string; fetched?: number; summary?: any; results?: any[] }

const normName = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
function parseProgram(s: string): string | null {
  const t = s.toLowerCase()
  if (t.includes('combat')) return 'combat'
  if (t.includes('iq')) return 'vex_iq'
  if (t.includes('v5')) return 'vex_v5'
  return null
}
function safeIso(v: any): string {
  if (!v) return new Date().toISOString()
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
function epochToIso(created: any): string | null {
  const n = Number(created)
  if (!n) return null
  const ms = n < 1e12 ? n * 1000 : n
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
// First non-empty answer in one question array whose label contains any fragment.
function answerIn(questions: any[] | undefined, fragments: string[]): string {
  for (const f of fragments) {
    const m = (questions ?? []).find((q: any) => String(q?.question || '').toLowerCase().includes(f))
    if (m?.answer != null && String(m.answer).trim()) return String(m.answer).trim()
  }
  return ''
}

// Registration campaign → enrollments, matched by guardian email + student name + program.
export async function syncRegistrationPayments(db: any, { apply, adminId }: { apply: boolean; adminId: string | null }): Promise<SyncResult> {
  const apiKey = process.env.ZEFFY_API_KEY
  const campaignId = process.env.ZEFFY_REGISTRATION_CAMPAIGN_ID
  if (!apiKey || !campaignId) return { ok: false, error: 'Zeffy not configured — set ZEFFY_API_KEY and ZEFFY_REGISTRATION_CAMPAIGN_ID.' }

  let payments
  try { payments = await fetchZeffyPayments(apiKey, campaignId) } catch (e: any) { return { ok: false, error: `Zeffy API: ${e.message}` } }

  const results: any[] = []
  let matched = 0, unmatched = 0, already = 0, applied = 0
  const claimed = new Set<string>()

  for (const p of payments) {
    if (p.status && p.status !== 'succeeded') continue
    const buyerEmail = (p.buyer?.email ?? '').trim()
    const signInEmail = zeffyAnswer(p.buyer_questions, 'sign-in email') || zeffyAnswer(p.buyer_questions, 'guardian email')

    for (const item of p.items ?? []) {
      const itemId = String(item.id ?? '').trim()
      if (!itemId) continue
      const studentName = `${zeffyAnswer(item.questions, 'student first') || zeffyAnswer(item.questions, 'first name')} ${
        zeffyAnswer(item.questions, 'student last') || zeffyAnswer(item.questions, 'last name')
      }`.trim()
      const programRaw = zeffyAnswer(item.questions, 'program')
      const program = parseProgram(programRaw)
      const guardianEmail = (signInEmail || buyerEmail).trim().toLowerCase()

      const { data: existing } = await db.from('payment_transaction').select('id').eq('source', 'zeffy').eq('source_payment_id', itemId).maybeSingle()
      if (existing) { already++; results.push({ itemId, studentName, guardianEmail, program: programRaw, status: 'already_recorded' }); continue }

      let enrollment: any = null
      let reason = ''
      let via = 'email+name'

      // 1. Most reliable: the optional Payment Reference Number, when the parent pasted it.
      // Prefer a per-ticket answer; fall back to a buyer-level one only on single-ticket orders.
      const refCode = answerIn(item.questions, ['payment reference', 'reference']) || ((p.items?.length ?? 0) <= 1 ? answerIn(p.buyer_questions, ['payment reference', 'reference']) : '')
      if (refCode) {
        const { data: enrByRef } = await db.from('enrollment')
          .select('id, family_id, program, registration_fee_amount, registration_fee_status, fundraising_target, fundraising_methods, fundraising_received_at')
          .ilike('payment_reference_code', refCode).eq('season', SEASON).maybeSingle()
        if (enrByRef) { enrollment = enrByRef; via = 'reference' }
      }

      // 2. Fallback: guardian email + student name + program.
      if (!enrollment) {
        if (!guardianEmail) reason = 'no guardian email on ticket'
        else {
          const { data: g } = await db.from('guardian').select('family_id').ilike('login_email', guardianEmail).maybeSingle()
          if (!g) reason = `no family for ${guardianEmail}`
          else {
            const { data: studs } = await db.from('student').select('id, first_name, last_name').eq('family_id', g.family_id)
            const stu = (studs ?? []).find((s: any) => normName(`${s.first_name} ${s.last_name}`) === normName(studentName))
            if (!stu) reason = `no student "${studentName}" in that family`
            else {
              const { data: enrs } = await db.from('enrollment')
                .select('id, family_id, program, registration_fee_amount, registration_fee_status, fundraising_target, fundraising_methods, fundraising_received_at')
                .eq('student_id', stu.id).eq('season', SEASON)
              const list = (enrs ?? []) as any[]
              enrollment = (program && list.find((e) => e.program === program)) || list.find((e) => Number(e.registration_fee_amount) > 0) || list[0] || null
              if (!enrollment) reason = 'student is not registered (no enrollment)'
            }
          }
        }
      }

      if (!enrollment) { unmatched++; results.push({ itemId, studentName, guardianEmail, program: programRaw, status: 'unmatched', reason }); continue }

      const feeOpen = !(enrollment.registration_fee_status === 'paid' || enrollment.registration_fee_status === 'waived') && !claimed.has(enrollment.id)
      const ptype = feeOpen ? 'registration_fee' : 'fundraising'
      matched++
      results.push({ itemId, studentName, guardianEmail, program: programRaw, status: 'matched', enrollmentId: enrollment.id, type: ptype, via })

      if (apply) {
        const amt = (Number(item.amount ?? p.amount ?? 0) || 0) / 100
        const { data: pay, error } = await db.from('payment_transaction').insert({
          family_id: enrollment.family_id, season: SEASON, source: 'zeffy', source_payment_id: itemId, amount: amt, payment_type: ptype,
          donor_name: `${p.buyer?.first_name ?? ''} ${p.buyer?.last_name ?? ''}`.trim() || null, donor_email: buyerEmail || null,
          received_at: epochToIso(p.created) ?? safeIso(p.createdAt ?? p.created_at), matched_status: 'unmatched', raw_payload: p,
        }).select('id').single()
        if (!error && pay) {
          await linkPaymentToEnrollment(db, { paymentId: pay.id, enrollment, paymentType: ptype, adminId })
          if (ptype === 'registration_fee') claimed.add(enrollment.id)
          applied++
          const fee = Number(enrollment.registration_fee_amount) || 40
          const target = Number(enrollment.fundraising_target) || 0
          if (target > 0 && !enrollment.fundraising_received_at) {
            const { data: pays } = await db.from('payment_transaction').select('amount').eq('enrollment_id', enrollment.id)
            const total = (pays ?? []).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0)
            if (total >= fee + target) {
              const at = epochToIso(p.created) ?? safeIso(p.createdAt ?? p.created_at)
              await db.from('enrollment').update({ fundraising_received_at: at, fundraising_received_amount: Math.max(0, total - fee), fundraising_received_note: 'Zeffy contribution (auto)' }).eq('id', enrollment.id)
              enrollment.fundraising_received_at = at
            }
          }
        }
      }
    }
  }
  return { ok: true, fetched: payments.length, summary: { matched, unmatched, alreadyRecorded: already, applied }, results }
}

const REF_RE = /IQT-[A-Z0-9]{8}/i
function questionPools(p: any): any[][] { return [p.buyer_questions, ...(p.items ?? []).map((it: any) => it.questions)] }
function findRefCode(p: any): string | null {
  for (const qs of questionPools(p)) for (const q of qs ?? []) { const m = REF_RE.exec(String(q?.answer ?? '')); if (m) return m[0].toUpperCase() }
  return null
}
function findAnswer(p: any, fragments: string[]): string {
  for (const qs of questionPools(p)) for (const f of fragments) {
    const m = (qs ?? []).find((q: any) => String(q?.question || '').toLowerCase().includes(f))
    if (m?.answer != null && String(m.answer).trim()) return String(m.answer).trim()
  }
  return ''
}

// IQ team-fee campaign → teams, matched by reference code / coach email / team number.
// Marks a team paid only once the cumulative total covers the fee; notifies the IQ
// coordinators when a team first becomes fully paid.
export async function syncIqPayments(db: any, { apply, adminId }: { apply: boolean; adminId: string | null }): Promise<SyncResult> {
  const apiKey = process.env.ZEFFY_API_KEY
  const campaignId = process.env.ZEFFY_IQ_TEAM_CAMPAIGN_ID
  if (!apiKey || !campaignId) return { ok: false, error: 'IQ Zeffy not configured — set ZEFFY_API_KEY and ZEFFY_IQ_TEAM_CAMPAIGN_ID.' }

  let payments
  try { payments = await fetchZeffyPayments(apiKey, campaignId) } catch (e: any) { return { ok: false, error: `Zeffy API: ${e.message}` } }

  const results: any[] = []
  let matched = 0, unmatched = 0, already = 0, applied = 0
  const newlyPaid: { teamName: string; amount: number }[] = []

  for (const p of payments as any[]) {
    if (p.status && p.status !== 'succeeded') continue
    const paymentId = String(p.id ?? '').trim()
    if (!paymentId) continue
    const buyerEmail = (p.buyer?.email ?? '').trim().toLowerCase()
    const answeredEmail = findAnswer(p, ['sign-in email', 'coach email', 'guardian email', 'email']).toLowerCase()
    const email = answeredEmail || buyerEmail
    const refCode = findRefCode(p)
    const teamNumber = findAnswer(p, ['team number', 'team #', 'team no', 'team id', 'team'])
    const label = `${p.buyer?.first_name ?? ''} ${p.buyer?.last_name ?? ''}`.trim() || email || paymentId

    const { data: existing } = await db.from('payment_transaction').select('id').eq('source', 'zeffy').eq('source_payment_id', paymentId).maybeSingle()
    if (existing) { already++; results.push({ paymentId, coach: label, email, ref: refCode, status: 'already_recorded' }); continue }

    let team: any = null
    let reason = ''
    if (refCode) {
      const { data: t } = await db.from('team').select('id, status, team_payment_reference_code, team_number, team_name, team_fee_amount, team_fee_status').eq('program', 'vex_iq').eq('season', SEASON).eq('team_payment_reference_code', refCode).maybeSingle()
      if (t) team = t; else reason = `no IQ team for ref ${refCode}`
    }
    if (!team && email) {
      const { data: g } = await db.from('guardian').select('id').ilike('login_email', email).maybeSingle()
      if (g) {
        const { data: tms } = await db.from('team_member').select('team:team_id ( id, status, team_payment_reference_code, team_number, team_name, team_fee_amount, team_fee_status, program, season )').eq('guardian_id', g.id).eq('team_role', 'coach').eq('program', 'vex_iq').is('revoked_at', null)
        const teams = (tms ?? []).map((r: any) => (Array.isArray(r.team) ? r.team[0] : r.team)).filter((t: any) => t && t.program === 'vex_iq' && t.season === SEASON)
        team = teams.find((t: any) => t.status === 'pending_payment') || teams[0] || null
        if (!team && !reason) reason = `no IQ team coached by ${email}`
      } else if (!reason) reason = `no guardian for ${email}`
    }
    if (!team && teamNumber) {
      const { data: t } = await db.from('team').select('id, status, team_payment_reference_code, team_number, team_name, team_fee_amount, team_fee_status').eq('program', 'vex_iq').eq('season', SEASON).eq('team_number', teamNumber).maybeSingle()
      if (t) team = t; else if (!reason) reason = `no IQ team #${teamNumber}`
    }
    if (!team) { unmatched++; results.push({ paymentId, coach: label, email, ref: refCode, status: 'unmatched', reason: reason || 'no reference code, coach email, or team number on payment' }); continue }

    matched++
    results.push({ paymentId, coach: label, email, ref: team.team_payment_reference_code, teamNumber: team.team_number, status: 'matched' })

    if (apply) {
      const { data: coachTm } = await db.from('team_member').select('guardian:guardian_id ( family_id )').eq('team_id', team.id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
      const cg: any = coachTm ? (Array.isArray((coachTm as any).guardian) ? (coachTm as any).guardian[0] : (coachTm as any).guardian) : null
      if (!cg?.family_id) {
        results[results.length - 1].status = 'unmatched'; results[results.length - 1].reason = 'matched a team but it has no coach family on file'
        matched--; unmatched++; continue
      }
      const amt = (Number((p.items ?? [])[0]?.amount ?? p.amount ?? p.totalAmount ?? 0) || 0) / 100
      const { error: payErr } = await db.from('payment_transaction').insert({
        family_id: cg.family_id, team_id: team.id, season: SEASON, source: 'zeffy', source_payment_id: paymentId, amount: amt, payment_type: 'iq_team_fee',
        payment_reference_code: team.team_payment_reference_code, donor_name: `${p.buyer?.first_name ?? ''} ${p.buyer?.last_name ?? ''}`.trim() || null, donor_email: buyerEmail || null,
        received_at: epochToIso(p.created) ?? safeIso(p.createdAt ?? p.created_at), matched_status: 'auto_matched', matched_by: adminId, matched_at: new Date().toISOString(), raw_payload: p,
      })
      if (!payErr) {
        const { data: pays } = await db.from('payment_transaction').select('amount').eq('team_id', team.id)
        const total = (pays ?? []).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0)
        const fee = Number(team.team_fee_amount) || 1200
        const fullyPaid = total >= fee
        const newStatus = fullyPaid && team.status === 'pending_payment' ? 'pending_admin_confirmation' : team.status
        await db.from('team').update({ team_fee_status: fullyPaid ? 'paid' : 'unpaid', status: newStatus }).eq('id', team.id)
        results[results.length - 1].partial = !fullyPaid
        results[results.length - 1].paidTotal = total
        applied++
        if (fullyPaid && team.team_fee_status !== 'paid') newlyPaid.push({ teamName: team.team_name || team.team_number || 'IQ team', amount: fee })
      }
    }
  }

  // Notify IQ coordinators about teams that just became fully paid.
  if (newlyPaid.length) {
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
      const { data: admins } = await db.from('admin_role_assignment').select('admin:admin_profile_id ( email )').in('role', ['iq_coordinator', 'super_admin']).is('revoked_at', null)
      const emails = [...new Set((admins ?? []).map((a: any) => (Array.isArray(a.admin) ? a.admin[0] : a.admin)?.email).filter(Boolean))] as string[]
      for (const t of newlyPaid) {
        if (emails.length) await sendEmail({ to: emails, subject: `IQ Team Payment Received — ${t.teamName}`, html: iqTeamPaidNotifyHtml({ teamName: t.teamName, amount: t.amount, hubUrl: site }) })
      }
    } catch (e: any) { console.error('[zeffy-sync] iq notify failed:', e?.message) }
  }

  return { ok: true, fetched: payments.length, summary: { matched, unmatched, alreadyRecorded: already, applied }, results }
}
