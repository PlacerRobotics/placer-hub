import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

/**
 * Family financial-aid request. RLS keeps families from writing financial_aid
 * directly, so this verifies the session + family ownership, then writes with
 * the service-role client. One pending request per family per season (updated
 * if resubmitted).
 */
export async function POST(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const needDescription = String(body.needDescription ?? '').trim()
  if (!needDescription) {
    return NextResponse.json({ error: 'Please describe your need.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: guardian } = await db
    .from('guardian')
    .select('family_id')
    .ilike('login_email', user.email)
    .maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family account found.' }, { status: 403 })
  const familyId: string = guardian.family_id

  const fields = {
    need_description: needDescription,
    govt_program_name: String(body.govtProgram ?? '').trim() || null,
    registration_fee_waiver_requested: !!body.feeWaiverRequested,
  }

  const { data: existing } = await db
    .from('financial_aid')
    .select('id')
    .eq('family_id', familyId)
    .eq('season', SEASON)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    const { error } = await db.from('financial_aid').update(fields).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db
      .from('financial_aid')
      .insert({ family_id: familyId, season: SEASON, status: 'pending', ...fields })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[financial-aid] request submitted by ${user.email} (family ${familyId})`)
  return NextResponse.json({ ok: true })
}
