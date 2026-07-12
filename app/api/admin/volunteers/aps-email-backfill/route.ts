import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { backfillApsEmails } from '@/lib/aps'

// POST /api/admin/volunteers/aps-email-backfill — one-time (safe to re-run)
// pull of the APS login email of record for every volunteer with an
// aps_user_id but no aps_email yet. See docs/design_email_identity_v1_0.md §1.5.
export async function POST() {
  if (!(await requireWriteAdmin())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const apiKey = process.env.APS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'APS_API_KEY is not set.' }, { status: 400 })
  const { summary, results } = await backfillApsEmails(createAdminClient(), apiKey)
  return NextResponse.json({ ok: true, summary, results })
}
