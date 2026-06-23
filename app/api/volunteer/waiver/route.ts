import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentVolunteer, ensureClearance } from '@/lib/volunteer'

export async function POST(req: NextRequest) {
  const vol = await getCurrentVolunteer()
  if (!vol) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const signature = String(body.signature ?? '').trim()
  if (!signature) return NextResponse.json({ error: 'Signature is required.' }, { status: 400 })
  if (body.acknowledged !== true) return NextResponse.json({ error: 'You must accept the policy to sign.' }, { status: 400 })

  const db = createAdminClient()
  const clearance = await ensureClearance(db, vol.profileId)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const patch: Record<string, unknown> = {
    waiver_signed_date: new Date().toISOString(),
    waiver_signature_text: signature,
    waiver_signed_by_ip: ip,
    updated_at: new Date().toISOString(),
  }
  if ((clearance?.status ?? 'pending') === 'pending') patch.status = 'in_progress'
  await db.from('volunteer_clearance').update(patch).eq('id', clearance.id)

  return NextResponse.json({ ok: true })
}
