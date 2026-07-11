import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncIqPayments } from '@/lib/zeffy-sync'

// POST { apply?: boolean } — pull the IQ team-fee Zeffy campaign and match each
// payment to an IQ team by reference code / coach email / team number. apply=false
// previews; apply=true records the payment, marks the fee paid once it covers the
// team fee, and advances pending_payment → pending_admin_confirmation.
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await hasAnyRole(db, admin.id, ['iq_coordinator', 'super_admin', 'payment_admin']))) {
    return NextResponse.json({ error: 'Only the IQ Coordinator or a payment admin can sync IQ payments.' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  const apply = body?.apply === true

  const r = await syncIqPayments(db, { apply, adminId: admin.id })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error?.startsWith('Zeffy API') ? 502 : 400 })
  return NextResponse.json({ ok: true, apply, fetched: r.fetched, summary: r.summary, results: r.results })
}
