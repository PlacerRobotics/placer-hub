const SEASON = '2026-27'

/** Find the enrollment a reference code belongs to (case-insensitive). */
export async function findEnrollmentByRef(db: any, ref: string) {
  const code = (ref ?? '').trim()
  if (!code) return null
  const { data } = await db
    .from('enrollment')
    .select('id, family_id, payment_reference_code, program')
    .ilike('payment_reference_code', code)
    .maybeSingle()
  return data ?? null
}

/**
 * Link a payment to an enrollment: marks the payment matched, copies the
 * enrollment's family, and (for registration fees) marks the enrollment paid.
 */
export async function linkPaymentToEnrollment(
  db: any,
  opts: {
    paymentId: string
    enrollment: { id: string; family_id: string }
    paymentType: string
    adminId?: string | null
  }
) {
  const now = new Date().toISOString()
  await db
    .from('payment_transaction')
    .update({
      // 'matched' is NOT a valid matched_status enum value. Admin-triggered =
      // manually_matched; automated (no adminId, e.g. webhook) = auto_matched.
      matched_status: opts.adminId ? 'manually_matched' : 'auto_matched',
      enrollment_id: opts.enrollment.id,
      family_id: opts.enrollment.family_id,
      matched_by: opts.adminId ?? null,
      matched_at: now,
    })
    .eq('id', opts.paymentId)

  if (opts.paymentType === 'registration_fee') {
    await db
      .from('enrollment')
      .update({ registration_fee_status: 'paid', registration_fee_paid_at: now })
      .eq('id', opts.enrollment.id)
  }
}

export { SEASON }
