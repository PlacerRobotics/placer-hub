import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { syncApsForAll } from '@/lib/aps'

// POST /api/admin/volunteers/aps-sync — pull APS (MinistrySafe) training results for
// every volunteer with an aps_user_id and update youth_protection_cert + the
// aps_youth_protection step. Optional APS_SURVEY_CODE pins the specific course.
export async function POST() {
  if (!(await requireWriteAdmin())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const apiKey = process.env.APS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'APS_API_KEY is not set.' }, { status: 400 })
  const { summary, results } = await syncApsForAll(createAdminClient(), apiKey, process.env.APS_SURVEY_CODE || undefined)
  return NextResponse.json({ ok: true, summary, results })
}
