import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchZeffyPayments, zeffyAnswer } from '@/lib/zeffy'
import { linkPaymentToEnrollment, SEASON } from '@/lib/payments'

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
// Zeffy `created` is a Unix epoch in seconds.
function epochToIso(created: any): string | null {
  const n = Number(created)
  if (!n) return null
  const ms = n < 1e12 ? n * 1000 : n
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// POST { apply?: boolean } — pulls the registration campaign's Zeffy payments and
// matches each ticket to an enrollment by guardian email + student name + program.
// apply=false (default) previews; apply=true records payments + marks fees paid.
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const apiKey = process.env.ZEFFY_API_KEY
  const campaignId = process.env.ZEFFY_REGISTRATION_CAMPAIGN_ID
  if (!apiKey || !campaignId) {
    return NextResponse.json(
      { error: 'Zeffy not configured — set ZEFFY_API_KEY and ZEFFY_REGISTRATION_CAMPAIGN_ID.' },
      { status: 400 }
    )
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  const apply = body?.apply === true

  let payments
  try {
    payments = await fetchZeffyPayments(apiKey, campaignId)
  } catch (e: any) {
    return NextResponse.json({ error: `Zeffy API: ${e.message}` }, { status: 502 })
  }

  const db = createAdminClient()
  const results: any[] = []
  let matched = 0, unmatched = 0, already = 0, applied = 0
  // Each enrollment's fee is satisfied by ONE payment — track enrollments
  // claimed within this batch so a second payment doesn't re-match the same one.
  const claimed = new Set<string>()

  for (const p of payments) {
    if (p.status && p.status !== 'succeeded') continue
    const buyerEmail = (p.buyer?.email ?? '').trim()
    // The "Placer Robotics Sign-In Email" is a buyer-level custom question and is
    // the intended match key; fall back to the Zeffy account email.
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

      const { data: existing } = await db
        .from('payment_transaction')
        .select('id')
        .eq('source', 'zeffy')
        .eq('source_payment_id', itemId)
        .maybeSingle()
      if (existing) {
        already++
        results.push({ itemId, studentName, guardianEmail, program: programRaw, status: 'already_recorded' })
        continue
      }

      let enrollment: any = null
      let reason = ''
      if (!guardianEmail) reason = 'no guardian email on ticket'
      else {
        const { data: g } = await db.from('guardian').select('family_id').ilike('login_email', guardianEmail).maybeSingle()
        if (!g) reason = `no family for ${guardianEmail}`
        else {
          const { data: studs } = await db.from('student').select('id, first_name, last_name').eq('family_id', g.family_id)
          const stu = (studs ?? []).find((s: any) => normName(`${s.first_name} ${s.last_name}`) === normName(studentName))
          if (!stu) reason = `no student "${studentName}" in that family`
          else {
            const { data: enrs } = await db
              .from('enrollment')
              .select('id, family_id, program, registration_fee_amount, registration_fee_status, fundraising_target, fundraising_methods, fundraising_received_at')
              .eq('student_id', stu.id)
              .eq('season', SEASON)
            const list = (enrs ?? []) as any[]
            enrollment =
              (program && list.find((e) => e.program === program)) ||
              list.find((e) => Number(e.registration_fee_amount) > 0) ||
              list[0] ||
              null
            if (!enrollment) reason = 'student is not registered (no enrollment)'
          }
        }
      }

      if (!enrollment) {
        unmatched++
        results.push({ itemId, studentName, guardianEmail, program: programRaw, status: 'unmatched', reason })
        continue
      }

      // Apply EVERY Zeffy payment tied to the student: the first covers the (still-open)
      // registration fee; anything beyond that is fundraising. We total all of a
      // student's Zeffy money and auto-mark the fundraising commitment received once it's
      // covered (fee + target), regardless of the declared method. Duplicate Zeffy items
      // are filtered above by source_payment_id, so totals don't double-count on re-sync.
      const feeOpen = !(enrollment.registration_fee_status === 'paid' || enrollment.registration_fee_status === 'waived') && !claimed.has(enrollment.id)
      const ptype = feeOpen ? 'registration_fee' : 'fundraising'

      matched++
      results.push({ itemId, studentName, guardianEmail, program: programRaw, status: 'matched', enrollmentId: enrollment.id, type: ptype })

      if (apply) {
        const amt = (Number(item.amount ?? p.amount ?? 0) || 0) / 100 // Zeffy amounts are in cents
        const { data: pay, error } = await db
          .from('payment_transaction')
          .insert({
            family_id: enrollment.family_id,
            season: SEASON,
            source: 'zeffy',
            source_payment_id: itemId,
            amount: amt,
            payment_type: ptype,
            donor_name: `${p.buyer?.first_name ?? ''} ${p.buyer?.last_name ?? ''}`.trim() || null,
            donor_email: buyerEmail || null,
            received_at: epochToIso(p.created) ?? safeIso(p.createdAt ?? p.created_at),
            matched_status: 'unmatched',
            raw_payload: p,
          })
          .select('id')
          .single()
        if (!error && pay) {
          await linkPaymentToEnrollment(db, { paymentId: pay.id, enrollment, paymentType: ptype, adminId: admin.id })
          if (ptype === 'registration_fee') claimed.add(enrollment.id)
          applied++

          // Total all of this enrollment's Zeffy money → auto-mark fundraising received
          // once it covers the fee + commitment.
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

  return NextResponse.json({
    ok: true,
    apply,
    fetched: payments.length,
    summary: { matched, unmatched, alreadyRecorded: already, applied },
    results,
  })
}
