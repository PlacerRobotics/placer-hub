import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findEnrollmentByRef, linkPaymentToEnrollment, SEASON } from '@/lib/payments'

/**
 * Zeffy payment webhook (best-effort). STUB: the exact Zeffy payload shape must
 * be confirmed against their API (PRD 12.1) — the field mapping below is a
 * reasonable guess. Auto-creates a payment_transaction and, if the payment
 * comment contains a PART reference code, auto-matches it to the enrollment.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ZEFFY_WEBHOOK_SECRET
  if (secret) {
    const provided =
      request.headers.get('x-zeffy-signature') ?? new URL(request.url).searchParams.get('secret')
    if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const db = createAdminClient()
  const sourcePaymentId = String(body.id ?? body.transactionId ?? body.paymentId ?? '')
  const amount = Number(body.amount ?? body.total ?? body.amountTotal ?? 0)
  const comment = String(body.comment ?? body.note ?? body.message ?? body.reference ?? '')
  const ref = comment.match(/PART-[A-Z0-9-]+/i)?.[0]?.toUpperCase() ?? null

  // Dedup on (source, source_payment_id).
  if (sourcePaymentId) {
    const { data: existing } = await db
      .from('payment_transaction')
      .select('id')
      .eq('source', 'zeffy')
      .eq('source_payment_id', sourcePaymentId)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, deduped: true })
  }

  const enrollment = ref ? await findEnrollmentByRef(db, ref) : null
  const matched = !!enrollment
  const now = new Date().toISOString()
  // A ref that matches an enrollment is that enrollment's registration payment.
  const paymentType = matched ? 'registration_fee' : 'fundraising'

  const { data: pay, error } = await db
    .from('payment_transaction')
    .insert({
      family_id: enrollment?.family_id ?? null,
      season: SEASON,
      source: 'zeffy',
      source_payment_id: sourcePaymentId || null,
      amount: amount || 0,
      payment_type: paymentType,
      donor_name: body.payerName ?? body.donorName ?? null,
      donor_email: body.payerEmail ?? body.donorEmail ?? null,
      payment_reference_code: ref,
      received_at: body.createdAt ?? body.date ?? now,
      matched_status: matched ? 'matched' : 'unmatched',
      enrollment_id: enrollment?.id ?? null,
      matched_at: matched ? now : null,
      raw_payload: body,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (matched && enrollment) {
    await linkPaymentToEnrollment(db, { paymentId: pay.id, enrollment, paymentType, adminId: null })
  }

  return NextResponse.json({ ok: true, matched })
}
