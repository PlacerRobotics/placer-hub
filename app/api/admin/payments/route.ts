import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { findEnrollmentByRef, SEASON } from '@/lib/payments'

const VALID_TYPES = ['registration_fee', 'fundraising', 'iq_team_fee', 'sponsorship_credit']
const VALID_SOURCES = ['check', 'cash', 'benevity', 'corporate_match', 'other']

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const paymentType = String(body.paymentType ?? '')
  const source = String(body.source ?? '')
  const paymentDate = String(body.paymentDate ?? '')
  if (!(amount > 0)) return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 })
  if (!VALID_TYPES.includes(paymentType)) return NextResponse.json({ error: 'Invalid payment type.' }, { status: 400 })
  if (!VALID_SOURCES.includes(source)) return NextResponse.json({ error: 'Invalid payment source.' }, { status: 400 })
  if (!paymentDate) return NextResponse.json({ error: 'Payment date is required.' }, { status: 400 })

  const db = createAdminClient()
  const ref = String(body.referenceCode ?? '').trim()
  const enrollment = ref ? await findEnrollmentByRef(db, ref) : null
  const matched = !!enrollment
  const now = new Date().toISOString()
  const checkNumber = source === 'check' ? String(body.checkNumber ?? '').trim() : ''

  const { data: pay, error } = await db
    .from('payment_transaction')
    .insert({
      family_id: enrollment?.family_id ?? body.familyId ?? null,
      season: SEASON,
      source,
      source_payment_id: checkNumber || null,
      amount,
      payment_type: paymentType,
      payment_reference_code: ref || null,
      received_at: paymentDate,
      matched_status: matched ? 'matched' : 'unmatched',
      enrollment_id: enrollment?.id ?? null,
      matched_by: matched ? admin.id : null,
      matched_at: matched ? now : null,
      notes: String(body.notes ?? '').trim() || null,
      raw_payload: {
        recorded_manually: true,
        deposit_date: body.depositDate || null,
        check_number: checkNumber || null,
      },
      created_by: admin.id,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (matched && paymentType === 'registration_fee' && enrollment) {
    await db
      .from('enrollment')
      .update({ registration_fee_status: 'paid', registration_fee_paid_at: now })
      .eq('id', enrollment.id)
  }

  return NextResponse.json({ ok: true, matched, paymentId: pay.id })
}
