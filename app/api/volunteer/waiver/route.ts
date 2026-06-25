import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentVolunteer, ensureClearance, VOLUNTEER_SEASON, VOLUNTEER_WAIVER_TYPES } from '@/lib/volunteer'

// POST — sign the active, versioned volunteer agreements (VOLUNTEER_WAIVER_TYPES:
// Release of Liability, Center Use, Youth Protection summary, Registered Volunteer
// policy). Records a waiver_signature per document (version, body_hash snapshot, typed
// first+last name, acceptance date, email, IP/UA) and stamps the clearance signal once
// ALL required documents are signed.
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
  if (body.acknowledged !== true) return NextResponse.json({ error: 'You must accept the agreements to sign.' }, { status: 400 })

  const db = createAdminClient()

  // Resolve the active required templates server-side (don't trust the client list).
  const { data: templates } = await db
    .from('waiver_template')
    .select('id, waiver_type, version, body_hash')
    .eq('active', true)
    .in('waiver_type', VOLUNTEER_WAIVER_TYPES as unknown as string[])
  const required = (templates ?? []) as any[]
  if (!required.length) return NextResponse.json({ error: 'No active volunteer agreements to sign.' }, { status: 400 })

  // Skip ones already signed (append-only).
  const { data: existing } = await db
    .from('waiver_signature')
    .select('waiver_template_id')
    .eq('volunteer_id', vol.profileId)
    .eq('season', VOLUNTEER_SEASON)
  const signed = new Set((existing ?? []).map((s: any) => s.waiver_template_id))

  const typedName = `${first} ${last}`.trim()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ua = req.headers.get('user-agent') ?? null

  const rows = required
    .filter((t) => !signed.has(t.id))
    .map((t) => ({
      waiver_template_id: t.id,
      family_id: vol.familyId,
      guardian_id: vol.guardianId,
      volunteer_id: vol.profileId,
      season: VOLUNTEER_SEASON,
      waiver_type: t.waiver_type,
      waiver_version: t.version,
      body_hash: t.body_hash,
      typed_name: typedName,
      participant_typed_name: typedName,
      electronic_consent_checked: true,
      read_and_agree_checked: true,
      authenticated_email: user.email,
      ip_address: ip,
      user_agent: ua,
    }))

  if (rows.length) {
    const { error } = await db.from('waiver_signature').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // The clearance "annual agreements" signal is satisfied only when ALL required
  // documents are signed.
  const allSigned = required.every((t) => signed.has(t.id) || rows.some((r) => r.waiver_template_id === t.id))
  const clearance = await ensureClearance(db, vol.profileId)
  if (allSigned) {
    const patch: Record<string, unknown> = {
      waiver_signed_date: new Date().toISOString(),
      waiver_signature_text: typedName,
      waiver_signed_by_ip: ip,
      updated_at: new Date().toISOString(),
    }
    if ((clearance?.status ?? 'pending') === 'pending') patch.status = 'in_progress'
    await db.from('volunteer_clearance').update(patch).eq('id', clearance.id)
  }

  return NextResponse.json({ ok: true, signed: rows.length, allSigned })
}
