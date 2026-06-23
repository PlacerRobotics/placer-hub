import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { findEnrollmentByRef, SEASON } from '@/lib/payments'
import { MANUAL_PAYMENT_TYPES as VALID_TYPES, MANUAL_PAYMENT_SOURCES as VALID_SOURCES } from '@/lib/payment-enums'

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
  // Not an enrollment ref? Try an IQ team-fee ref (e.g. IQT-XXXX) → attach to the team.
  const team = (!enrollment && ref)
    ? (await db.from('team').select('id, status, program').eq('team_payment_reference_code', ref).maybeSingle()).data
    : null
  const matched = !!enrollment || !!team
  const now = new Date().toISOString()
  const checkNumber = source === 'check' ? String(body.checkNumber ?? '').trim() : ''

  const { data: pay, error } = await db
    .from('payment_transaction')
    .insert({
      family_id: enrollment?.family_id ?? body.familyId ?? null,
      team_id: team?.id ?? null,
      season: SEASON,
      source,
      source_payment_id: checkNumber || null,
      amount,
      payment_type: team ? 'iq_team_fee' : paymentType,
      payment_reference_code: ref || null,
      received_at: paymentDate,
      deposited_at: body.depositDate ? new Date(body.depositDate).toISOString() : null,
      matched_status: matched ? 'manually_matched' : 'unmatched',
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
  if (team) {
    const newStatus = team.status === 'pending_payment' ? 'pending_admin_confirmation' : team.status
    await db.from('team').update({ team_fee_status: 'paid', status: newStatus }).eq('id', team.id)
  }

  return NextResponse.json({ ok: true, matched, matchedTeam: !!team, paymentId: pay.id })
}
