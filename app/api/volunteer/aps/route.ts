import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentVolunteer } from '@/lib/volunteer'

// POST { expiration_date, cert_url? } — a volunteer records/updates their own APS
// (CA Mandated Reporter) certificate. Writes the latest youth_protection_cert row.
// An admin can still verify/override from the volunteer detail page.
export async function POST(req: NextRequest) {
  const vol = await getCurrentVolunteer()
  if (!vol) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const exp = String(body.expiration_date ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) return NextResponse.json({ error: 'Enter a valid expiration date.' }, { status: 400 })
  const certUrl = body.cert_url ? String(body.cert_url).trim() : null

  const db = createAdminClient()

  // Update the most recent cert row if one exists; otherwise insert.
  const { data: latest } = await db
    .from('youth_protection_cert')
    .select('id')
    .eq('volunteer_id', vol.profileId)
    .order('expiration_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest) {
    const { error } = await db.from('youth_protection_cert')
      .update({ expiration_date: exp, cert_url: certUrl, updated_at: new Date().toISOString() })
      .eq('id', latest.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db.from('youth_protection_cert')
      .insert({ volunteer_id: vol.profileId, expiration_date: exp, issued_date: exp, cert_url: certUrl })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
