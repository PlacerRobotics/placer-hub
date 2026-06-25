import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, volunteerApplicationReceivedHtml, volunteerAdminNotifyHtml } from '@/lib/email'

const SEASON = '2026-27'
const STANDARD_STEPS = ['policy_acknowledgment', 'background_check', 'aps_youth_protection', 'youth_protection_quiz', 'lab_orientation']
const ADMIN_EMAIL = process.env.VOLUNTEER_ADMIN_EMAIL || 'punita.gupta@placerrobotics.org'

/**
 * Public volunteer application. Creates (or reuses) a guardian+family for the
 * email, a volunteer_profile + standard steps, and a per-season volunteer_clearance.
 * Captures the richer application (programs, role, door/key access, APS) — team
 * assignments are NOT stored here (those live in team_member). Emails a confirmation
 * to the applicant and a notification to the registrar. No magic links.
 */
export async function POST(request: NextRequest) {
  let b: any
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }

  const first = String(b.first_name ?? '').trim()
  const last = String(b.last_name ?? '').trim()
  const email = String(b.email ?? '').trim().toLowerCase()
  const phone = String(b.phone ?? '').trim()
  const signature = String(b.signature ?? '').trim()
  if (!first || !last || !email || !phone) return NextResponse.json({ error: 'Please complete your name, email, and phone.' }, { status: 400 })
  if (!b.agreed_yp || !b.agreed_rc) return NextResponse.json({ error: 'You must agree to both policies.' }, { status: 400 })
  if (!signature) return NextResponse.json({ error: 'Please type your name to sign.' }, { status: 400 })

  const db = createAdminClient()

  // 1. Guardian + family.
  let familyId: string, guardianId: string
  const existing = (await db.from('guardian').select('id, family_id').ilike('login_email', email).maybeSingle()).data
  if (existing) { guardianId = existing.id; familyId = existing.family_id; if (phone) await db.from('guardian').update({ phone }).eq('id', guardianId) }
  else {
    const { data: fam, error: fe } = await db.from('family').insert({ primary_email: email, display_name: last }).select('id').single()
    if (fe) return NextResponse.json({ error: fe.message }, { status: 500 })
    familyId = fam.id
    const { data: g, error: ge } = await db.from('guardian').insert({ family_id: familyId, first_name: first, last_name: last, login_email: email, phone, role: 'single_guardian' }).select('id').single()
    if (ge) return NextResponse.json({ error: ge.message }, { status: 500 })
    guardianId = g.id
  }

  // 2. Volunteer profile.
  let profileId: string
  const ep = (await db.from('volunteer_profile').select('id').eq('guardian_id', guardianId).maybeSingle()).data
  if (ep) profileId = ep.id
  else {
    const { data: vp, error: ve } = await db.from('volunteer_profile').insert({ guardian_id: guardianId, family_id: familyId, status: 'pending', applied_at: new Date().toISOString() }).select('id').single()
    if (ve) return NextResponse.json({ error: ve.message }, { status: 500 })
    profileId = vp.id
  }

  // 3. Standard steps; policy_acknowledgment is complete (they signed).
  await db.from('volunteer_step').upsert(STANDARD_STEPS.map((step, i) => ({ volunteer_id: profileId, step, status: step === 'policy_acknowledgment' ? 'complete' : 'pending', completed_at: step === 'policy_acknowledgment' ? new Date().toISOString() : null, sort_order: i })), { onConflict: 'volunteer_id,step' })

  // 4. Per-season clearance.
  const programs: string[] = Array.isArray(b.programs) ? b.programs : []
  const keyReq = ['card', 'phone'].includes(b.key_access_request) ? b.key_access_request : b.key_access_request === 'renew' ? 'card' : 'none'
  const notes = [
    programs.length ? `Programs: ${programs.join(', ')}` : '',
    b.primary_role ? `Role: ${b.primary_role}` : '',
    b.is_returning ? 'Returning volunteer' : '',
    b.aps_choice === 'have' ? 'APS: has a current certificate (verify via APS sync)' : b.aps_choice === 'enroll' ? 'APS: needs enrollment' : '',
    (b.street_address || b.city) ? `Address: ${[b.street_address, b.city, b.state, b.zip].filter(Boolean).join(', ')}` : '',
    b.has_door_access ? `Has door access: ${b.door_access_type ?? 'yes'}` : '',
  ].filter(Boolean).join(' · ') || null
  // NOTE: the application's policy acknowledgment + signature gate the application
  // (recorded as the policy_acknowledgment step above). The annual signed agreements
  // (Release of Liability + Registered Volunteer policy) are a separate, legally
  // recorded step the volunteer completes in the portal (/volunteer/waiver) — do NOT
  // pre-set waiver_signed_date here, or the portal would skip the real signing.
  await db.from('volunteer_clearance').upsert({
    volunteer_id: profileId, season: SEASON, status: 'pending',
    application_submitted_at: new Date().toISOString(), application_source: 'hub',
    key_access_requested: keyReq,
    notes,
  }, { onConflict: 'volunteer_id,season' })

  // 5. Emails (best-effort). APS certificate dates are NOT collected here — they are
  // pulled automatically from APS (see lib/aps.ts, synced by the daily cron).
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  try {
    await sendEmail({ to: [email], subject: 'Placer Robotics Volunteer Application Received', html: volunteerApplicationReceivedHtml({ name: `${first} ${last}`, season: SEASON }) })
    await sendEmail({ to: [ADMIN_EMAIL], subject: `New Volunteer Application — ${first} ${last}`, html: volunteerAdminNotifyHtml({ name: `${first} ${last}`, email, programs: programs.join(', '), role: String(b.primary_role ?? ''), season: SEASON, hubUrl: site }) })
  } catch (e) { console.error('[volunteer/apply] email failed:', e) }

  return NextResponse.json({ ok: true, email })
}
