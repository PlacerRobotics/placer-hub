import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'
const FUND = ['direct_donation', 'corporate_match', 'sponsored', 'paper_check', 'pending']

// PATCH /api/family/fundraising — a family edits their fundraising/payment method.
// Allowed only until a payment is recorded (re-checked here, not just in the UI).
export async function PATCH(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createAdminClient()
  const { data: guardian } = await db.from('guardian').select('family_id').ilike('login_email', user.email).maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family found.' }, { status: 403 })
  const familyId = guardian.family_id

  // Lock once a payment is recorded (paid enrollment or any payment on file).
  const { data: studs } = await db.from('student').select('id').eq('family_id', familyId)
  const studentIds = (studs ?? []).map((s: any) => s.id)
  const { data: paidEnr } = studentIds.length
    ? await db.from('enrollment').select('id').eq('season', SEASON).eq('registration_fee_status', 'paid').in('student_id', studentIds).limit(1)
    : { data: [] as any[] }
  const { data: payTx } = await db.from('payment_transaction').select('id').eq('family_id', familyId).eq('season', SEASON).limit(1)
  if ((paidEnr ?? []).length || (payTx ?? []).length) {
    return NextResponse.json({ error: 'A payment has been recorded — contact info@placerrobotics.org to change your method.' }, { status: 409 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const methods: string[] = Array.isArray(body.methods) ? body.methods.filter((m: string) => FUND.includes(m)) : []
  if (!methods.length) return NextResponse.json({ error: 'Pick at least one fundraising method.' }, { status: 400 })

  const primary = FUND.find((m) => methods.includes(m)) ?? methods[0]
  await db.from('family_season').update({ fundraising_methods: methods, fundraising_method: primary }).eq('family_id', familyId).eq('season', SEASON)

  if (methods.includes('corporate_match')) {
    await db.from('family').update({
      employer_match_company: String(body.employer_company ?? '').trim() || null,
      employer_match_pct: body.employer_pct ? Number(body.employer_pct) : null,
      employer_match_portal: String(body.employer_portal ?? '').trim() || null,
    }).eq('id', familyId)
  } else {
    await db.from('family').update({ employer_match_company: null, employer_match_pct: null, employer_match_portal: null }).eq('id', familyId)
  }

  await db.from('family_sponsor_interest').delete().eq('family_id', familyId).eq('season', SEASON).eq('source', 'registration_wizard')
  if (methods.includes('sponsored')) {
    await db.from('family_sponsor_interest').insert({
      family_id: familyId,
      season: SEASON,
      business_name: String(body.sponsor_business ?? '').trim() || null,
      contact_name: String(body.sponsor_contact ?? '').trim() || null,
      estimated_amount: body.sponsor_amount ? Number(body.sponsor_amount) : null,
      status: 'pending',
      source: 'registration_wizard',
    })
  }

  return NextResponse.json({ ok: true })
}
