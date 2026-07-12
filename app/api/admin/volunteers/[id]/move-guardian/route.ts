import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanEmail } from '@/lib/email-input'

// POST /api/admin/volunteers/[id]/move-guardian — repoint a volunteer_profile
// to a different guardian (the duplicate-family case: a volunteer record landed
// under a spurious guardian created from an old/alternate email, e.g. a legacy
// yahoo address the historical APS import matched on).
//
// This is safe precisely because everything about the volunteer keys off
// volunteer_id, not the guardian: clearances, steps, youth-protection certs,
// and the APS linkage (aps_user_id — the daily MinistrySafe sync never uses
// email). Repointing guardian_id + family_id moves the entire history intact.
// The MinistrySafe account itself keeps whatever email it has; changing that
// is done in the MinistrySafe dashboard, not here.
//
// guardian_id is UNIQUE on volunteer_profile — if the target guardian already
// has their own volunteer record, merging two histories is a manual decision.
// body: { target_guardian_email }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: volunteerId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const email = cleanEmail(body.target_guardian_email)
  if (!email) return NextResponse.json({ error: 'Provide the target guardian’s login email.' }, { status: 400 })

  const db = createAdminClient()
  const { data: vp } = await db.from('volunteer_profile').select('id, guardian_id, family_id').eq('id', volunteerId).maybeSingle()
  if (!vp) return NextResponse.json({ error: 'Volunteer record not found.' }, { status: 404 })

  const { data: target } = await db.from('guardian').select('id, family_id, first_name, last_name').ilike('login_email', email).maybeSingle()
  if (!target) return NextResponse.json({ error: `No guardian found with login email ${email}.` }, { status: 404 })
  if (target.id === vp.guardian_id) return NextResponse.json({ error: 'The volunteer record already belongs to that guardian.' }, { status: 400 })

  const { data: existing } = await db.from('volunteer_profile').select('id').eq('guardian_id', target.id).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'That guardian already has their own volunteer record — merging two volunteer histories is a manual decision, not a move.' }, { status: 409 })
  }

  const { error } = await db.from('volunteer_profile').update({ guardian_id: target.id, family_id: target.family_id }).eq('id', volunteerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[admin volunteers/move-guardian] admin ${admin.id} moved volunteer ${volunteerId} from guardian ${vp.guardian_id} to ${target.id} (${target.first_name} ${target.last_name})`)
  return NextResponse.json({ ok: true, to: target.id })
}
