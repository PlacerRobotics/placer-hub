import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

// A parent/legal guardian signs the active waivers from their own session.
// Records a waiver_signature per (active waiver x registered student) under THIS
// guardian's id, skipping any (waiver, student) this guardian already signed
// (waiver_signature is append-only). Independent of who registered the student.
export async function POST(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createAdminClient()
  const { data: guardian } = await db
    .from('guardian')
    .select('id, family_id')
    .ilike('login_email', user.email)
    .maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family found for this account.' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const signatureName = String(body.signatureName ?? '').trim()
  if (!signatureName) return NextResponse.json({ error: 'Please type your full legal name to sign.' }, { status: 400 })

  const { data: waivers } = await db
    .from('waiver_template')
    .select('id, waiver_type, version, body_hash')
    .eq('active', true)
  if (!waivers?.length) return NextResponse.json({ error: 'There are no agreements to sign.' }, { status: 400 })

  const { data: enrollments } = await db
    .from('enrollment')
    .select('id, student_id')
    .eq('family_id', guardian.family_id)
    .eq('season', SEASON)
  if (!enrollments?.length) return NextResponse.json({ error: 'No registered student to sign for yet.' }, { status: 400 })

  const { data: existing } = await db
    .from('waiver_signature')
    .select('waiver_template_id, student_id')
    .eq('guardian_id', guardian.id)
    .eq('season', SEASON)
  const seen = new Set((existing ?? []).map((s: any) => `${s.waiver_template_id}:${s.student_id}`))

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rows: Record<string, unknown>[] = []
  for (const w of waivers as any[]) {
    for (const e of enrollments as any[]) {
      if (seen.has(`${w.id}:${e.student_id}`)) continue
      rows.push({
        waiver_template_id: w.id,
        family_id: guardian.family_id,
        guardian_id: guardian.id,
        student_id: e.student_id,
        enrollment_id: e.id,
        season: SEASON,
        waiver_type: w.waiver_type,
        waiver_version: w.version,
        body_hash: w.body_hash,
        typed_name: signatureName,
        electronic_consent_checked: true,
        read_and_agree_checked: true,
        authenticated_email: user.email,
        ip_address: ip,
        user_agent: request.headers.get('user-agent') ?? null,
      })
    }
  }

  if (rows.length) {
    const { error } = await db.from('waiver_signature').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, signed: rows.length })
}
