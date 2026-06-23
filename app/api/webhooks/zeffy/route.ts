import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findEnrollmentByRef, linkPaymentToEnrollment, SEASON } from '@/lib/payments'
import { sendEmail, iqTeamPaidNotifyHtml } from '@/lib/email'

/**
 * Zeffy payment webhook.
 *
 * CAPTURE-FIRST: the exact Zeffy payload shape is not yet confirmed, so this
 * route ALWAYS records the raw payload as an unmatched payment_transaction
 * BEFORE attempting any field extraction or matching. That guarantees a real
 * test payment is captured for inspection (read payment_transaction.raw_payload)
 * even if the guessed field mapping is wrong. Auto-matching is then attempted
 * best-effort and never throws. Once the real payload is known, the matching
 * block switches to guardian email + student name + program.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ZEFFY_WEBHOOK_SECRET
  if (secret) {
    const provided =
      request.headers.get('x-zeffy-signature') ?? new URL(request.url).searchParams.get('secret')
    if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Capture the raw body defensively — parse JSON, fall back to raw text.
  const rawText = await request.text()
  // Log the raw payload so it's visible in Vercel logs even if the DB insert
  // fails — this is how we confirm Zeffy is delivering and see the real shape.
  console.log('[zeffy] webhook received:', rawText || '(empty body)')
  let body: any
  try {
    body = rawText ? JSON.parse(rawText) : {}
  } catch {
    body = { _unparsed: rawText }
  }

  const db = createAdminClient()
  const now = new Date().toISOString()
  // Coerce a date safely — Zeffy may send a format Postgres can't cast to
  // timestamptz, which would otherwise fail the whole insert.
  const safeDate = (v: any): string => {
    if (!v) return now
    const d = new Date(v)
    return isNaN(d.getTime()) ? now : d.toISOString()
  }
  const sourcePaymentId = String(body.id ?? body.transactionId ?? body.paymentId ?? '') || null
  const amount = Number(body.amount ?? body.total ?? body.amountTotal ?? 0) || 0

  // Dedup on (source, source_payment_id) when we have an id.
  if (sourcePaymentId) {
    const { data: existing } = await db
      .from('payment_transaction')
      .select('id')
      .eq('source', 'zeffy')
      .eq('source_payment_id', sourcePaymentId)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, deduped: true })
  }

  // 1) ALWAYS record the raw payload first, as an unmatched transaction.
  const { data: pay, error } = await db
    .from('payment_transaction')
    .insert({
      family_id: null,
      season: SEASON,
      source: 'zeffy',
      source_payment_id: sourcePaymentId,
      amount,
      payment_type: 'unknown',
      donor_name: body.payerName ?? body.donorName ?? body.firstName ?? null,
      donor_email: body.payerEmail ?? body.donorEmail ?? body.email ?? null,
      received_at: safeDate(body.createdAt ?? body.date),
      matched_status: 'unmatched',
      raw_payload: body,
    })
    .select('id')
    .single()
  if (error) {
    // Primary insert failed — fall back to an ultra-minimal row so the payload
    // is still captured for inspection. 200 either way so Zeffy doesn't
    // retry-storm; everything is logged.
    console.error('[zeffy] primary insert failed, trying minimal:', error.message)
    const { error: e2 } = await db.from('payment_transaction').insert({
      season: SEASON,
      source: 'zeffy',
      source_payment_id: sourcePaymentId,
      amount: 0,
      payment_type: 'unknown',
      matched_status: 'unmatched',
      received_at: now,
      raw_payload: body,
    })
    if (e2) {
      console.error('[zeffy] minimal insert also failed:', e2.message)
      return NextResponse.json({ ok: false, error: e2.message }, { status: 200 })
    }
    return NextResponse.json({ ok: true, captured: true, minimal: true })
  }

  // 2) Try IQ team fee match FIRST (team_payment_reference_code, e.g. "IQT-XXXX").
  //    A team match short-circuits — it never falls through to enrollment matching.
  try {
    const tComment = String(body.comment ?? body.note ?? body.message ?? body.reference ?? '')
    const teamRef = tComment.match(/IQT-[A-Z0-9]+/i)?.[0]?.toUpperCase() ?? null
    if (teamRef) {
      const { data: team } = await db.from('team').select('id, team_name').eq('team_payment_reference_code', teamRef).maybeSingle()
      if (team) {
        await db.from('team').update({ team_fee_status: 'paid', status: 'pending_admin_confirmation', active: false }).eq('id', team.id)
        await db.from('payment_transaction').update({ payment_type: 'iq_team_fee', payment_reference_code: teamRef, matched_status: 'auto_matched', matched_at: now }).eq('id', pay.id)
        try {
          const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
          const { data: admins } = await db.from('admin_role_assignment').select('admin:admin_profile_id ( email )').in('role', ['iq_coordinator', 'super_admin']).is('revoked_at', null)
          const emails = [...new Set((admins ?? []).map((a: any) => (Array.isArray(a.admin) ? a.admin[0] : a.admin)?.email).filter(Boolean))] as string[]
          if (emails.length) await sendEmail({ to: emails, subject: `IQ Team Payment Received — ${team.team_name ?? 'IQ team'}`, html: iqTeamPaidNotifyHtml({ teamName: team.team_name ?? 'IQ team', amount, hubUrl: site }) })
        } catch (e: any) { console.error('[zeffy] iq notify failed:', e?.message) }
        return NextResponse.json({ ok: true, matched: 'iq_team' })
      }
    }
  } catch (e: any) {
    console.error('[zeffy] iq team match failed:', e?.message)
  }

  // 3) Best-effort enrollment auto-match — never throws; the payload is already captured.
  //    Current heuristic: a PART-… reference code in a comment field. Will be
  //    replaced with guardian email + student name + program once the real
  //    payload shape is confirmed from a test transaction.
  try {
    const comment = String(body.comment ?? body.note ?? body.message ?? body.reference ?? '')
    const ref = comment.match(/PART-[A-Z0-9-]+/i)?.[0]?.toUpperCase() ?? null
    const enrollment = ref ? await findEnrollmentByRef(db, ref) : null
    if (enrollment) {
      await db
        .from('payment_transaction')
        .update({
          family_id: enrollment.family_id,
          enrollment_id: enrollment.id,
          payment_reference_code: ref,
          payment_type: 'registration_fee',
          matched_status: 'auto_matched',
          matched_at: now,
        })
        .eq('id', pay.id)
      await linkPaymentToEnrollment(db, { paymentId: pay.id, enrollment, paymentType: 'registration_fee', adminId: null })
      return NextResponse.json({ ok: true, matched: true })
    }
  } catch (e: any) {
    console.error('[zeffy] auto-match failed (payload still captured):', e?.message)
  }

  return NextResponse.json({ ok: true, matched: false, captured: true })
}
