import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkPaymentToEnrollment } from '@/lib/payments'

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const paymentId = String(body.paymentId ?? '')
  const enrollmentId = String(body.enrollmentId ?? '')
  if (!paymentId || !enrollmentId) return NextResponse.json({ error: 'Missing ids.' }, { status: 400 })

  const db = createAdminClient()
  const { data: payment } = await db
    .from('payment_transaction')
    .select('id, payment_type')
    .eq('id', paymentId)
    .maybeSingle()
  const { data: enrollment } = await db
    .from('enrollment')
    .select('id, family_id')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (!payment || !enrollment) return NextResponse.json({ error: 'Payment or enrollment not found.' }, { status: 404 })

  await linkPaymentToEnrollment(db, {
    paymentId,
    enrollment,
    paymentType: payment.payment_type,
    adminId: admin.id,
  })
  return NextResponse.json({ ok: true })
}
