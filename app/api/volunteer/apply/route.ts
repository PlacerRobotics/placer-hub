import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Standard volunteer clearance steps created on signup.
const STANDARD_STEPS = [
  'policy_acknowledgment',
  'background_check',
  'aps_youth_protection',
  'youth_protection_quiz',
  'lab_orientation',
]

/**
 * Public volunteer signup. Creates (or reuses) a family + guardian for the
 * email, then a volunteer_profile and the standard clearance steps. No student
 * required — this is the path for volunteers who don't have a child enrolled.
 * Uses the service-role client (the applicant is unauthenticated).
 */
export async function POST(request: NextRequest) {
  let body: { first_name?: string; last_name?: string; email?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const first = body.first_name?.trim()
  const last = body.last_name?.trim()
  const email = body.email?.trim().toLowerCase()
  const phone = body.phone?.trim()
  if (!first || !last || !email || !phone) {
    return NextResponse.json({ error: 'Please complete all fields.' }, { status: 400 })
  }

  const db = createAdminClient()

  // 1. Resolve or create the guardian + family.
  let familyId: string
  let guardianId: string
  const { data: existingGuardian } = await db
    .from('guardian')
    .select('id, family_id')
    .ilike('login_email', email)
    .maybeSingle()

  if (existingGuardian) {
    guardianId = existingGuardian.id
    familyId = existingGuardian.family_id
  } else {
    const { data: fam, error: famErr } = await db
      .from('family')
      .insert({ primary_email: email, display_name: `${last}` })
      .select('id')
      .single()
    if (famErr) return NextResponse.json({ error: famErr.message }, { status: 500 })
    familyId = fam.id
    const { data: g, error: gErr } = await db
      .from('guardian')
      .insert({
        family_id: familyId,
        first_name: first,
        last_name: last,
        login_email: email,
        phone,
        role: 'single_guardian',
      })
      .select('id')
      .single()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    guardianId = g.id
  }

  // 2. Volunteer profile (one per guardian).
  const { data: existingProfile } = await db
    .from('volunteer_profile')
    .select('id')
    .eq('guardian_id', guardianId)
    .maybeSingle()

  let profileId: string
  if (existingProfile) {
    profileId = existingProfile.id
  } else {
    const { data: vp, error: vpErr } = await db
      .from('volunteer_profile')
      .insert({
        guardian_id: guardianId,
        family_id: familyId,
        status: 'pending',
        applied_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (vpErr) return NextResponse.json({ error: vpErr.message }, { status: 500 })
    profileId = vp.id
  }

  // 3. Standard clearance steps (idempotent via unique (volunteer_id, step)).
  const stepRows = STANDARD_STEPS.map((step, i) => ({
    volunteer_id: profileId,
    step,
    status: 'pending',
    sort_order: i,
  }))
  await db.from('volunteer_step').upsert(stepRows, { onConflict: 'volunteer_id,step' })

  return NextResponse.json({ ok: true, email })
}
