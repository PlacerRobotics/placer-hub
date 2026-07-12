import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanEmail } from '@/lib/email-input'
import { findGuardianByEmail } from '@/lib/guardian-lookup'

// POST /api/admin/guardians/[id]/aliases — manually record a known-alternate
// email for a guardian (an APS-era yahoo, an abandoned login, whatever an
// admin has confirmed belongs to this person). Design: docs/
// design_email_identity_v1_0.md §1. body: { email, source? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: guardianId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const email = cleanEmail(body.email)
  if (!email) return NextResponse.json({ error: 'Provide an email.' }, { status: 400 })

  const db = createAdminClient()
  const { data: guardian } = await db.from('guardian').select('id, login_email').eq('id', guardianId).maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'Guardian not found.' }, { status: 404 })
  if (email === (guardian.login_email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'That’s already this guardian’s login email.' }, { status: 400 })
  }

  const existing = await findGuardianByEmail(db, email)
  if (existing && existing.id !== guardianId) {
    return NextResponse.json({ error: 'That email already belongs to a different guardian.' }, { status: 409 })
  }
  if (existing) return NextResponse.json({ ok: true, alreadyKnown: true })

  const { error } = await db.from('guardian_email_alias').insert({ guardian_id: guardianId, email, source: String(body.source ?? 'manual'), created_by: admin.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/guardians/[id]/aliases?alias_id=... — remove a recorded alias.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: guardianId } = await params
  const aliasId = new URL(req.url).searchParams.get('alias_id')
  if (!aliasId) return NextResponse.json({ error: 'Missing alias_id.' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('guardian_email_alias').delete().eq('id', aliasId).eq('guardian_id', guardianId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
