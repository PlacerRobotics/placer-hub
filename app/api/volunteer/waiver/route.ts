import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentVolunteer, ensureClearance, VOLUNTEER_SEASON } from '@/lib/volunteer'

// POST — sign the active, versioned volunteer waiver. Records a waiver_signature
// (captures version, body_hash snapshot, typed first+last name, acceptance date,
// authenticated email, IP/UA) AND stamps volunteer_clearance for the checklist.
export async function POST(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const vol = await getCurrentVolunteer()
  if (!vol) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const first = String(body.first_name ?? '').trim()
  const last = String(body.last_name ?? '').trim()
  if (!first || !last) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
  if (body.acknowledged !== true) return NextResponse.json({ error: 'You must accept the policy to sign.' }, { status: 400 })

  const db = createAdminClient()

  // Resolve the active template server-side (don't trust the client-sent id/hash).
  const { data: tmpl } = await db
    .from('waiver_template')
    .select('id, version, body_hash')
    .eq('waiver_type', 'volunteer')
    .eq('active', true)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!tmpl) return NextResponse.json({ error: 'No active volunteer agreement to sign.' }, { status: 400 })

  const typedName = `${first} ${last}`.trim()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Append-only: skip if this volunteer already signed this template version this season.
  const { data: existing } = await db
    .from('waiver_signature')
    .select('id')
    .eq('volunteer_id', vol.profileId)
    .eq('waiver_template_id', tmpl.id)
    .eq('season', VOLUNTEER_SEASON)
    .maybeSingle()

  if (!existing) {
    const { error: sigErr } = await db.from('waiver_signature').insert({
      waiver_template_id: tmpl.id,
      family_id: vol.familyId,
      guardian_id: vol.guardianId,
      volunteer_id: vol.profileId,
      season: VOLUNTEER_SEASON,
      waiver_type: 'volunteer',
      waiver_version: tmpl.version,
      body_hash: tmpl.body_hash,
      typed_name: typedName,
      participant_typed_name: typedName,
      electronic_consent_checked: true,
      read_and_agree_checked: true,
      authenticated_email: user.email,
      ip_address: ip,
      user_agent: req.headers.get('user-agent') ?? null,
    })
    if (sigErr) return NextResponse.json({ error: sigErr.message }, { status: 500 })
  }

  // Mirror onto the per-season clearance row for the checklist signal.
  const clearance = await ensureClearance(db, vol.profileId)
  const patch: Record<string, unknown> = {
    waiver_signed_date: new Date().toISOString(),
    waiver_signature_text: typedName,
    waiver_signed_by_ip: ip,
    updated_at: new Date().toISOString(),
  }
  if ((clearance?.status ?? 'pending') === 'pending') patch.status = 'in_progress'
  await db.from('volunteer_clearance').update(patch).eq('id', clearance.id)

  return NextResponse.json({ ok: true })
}
