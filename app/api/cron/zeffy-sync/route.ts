import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncRegistrationPayments, syncIqPayments } from '@/lib/zeffy-sync'

export const dynamic = 'force-dynamic'

// GET — daily. Auto-applies matched Zeffy payments (registration + IQ team fees).
// Idempotent (dedup by source_payment_id); unmatched payments are skipped for an
// admin to handle via the manual Preview/Apply. Vercel cron authenticates via
// CRON_SECRET; an admin can also trigger it manually.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  const admin = isCron ? null : await getAdminProfile()
  if (!isCron && !admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  const db = createAdminClient()
  const adminId = admin?.id ?? null
  const reg = await syncRegistrationPayments(db, { apply: true, adminId })
  const iq = await syncIqPayments(db, { apply: true, adminId })
  return NextResponse.json({
    ok: true,
    registration: reg.ok ? reg.summary : { error: reg.error },
    iq: iq.ok ? iq.summary : { error: iq.error },
  })
}
