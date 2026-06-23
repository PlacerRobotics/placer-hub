import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/family/guardian2 — add/update a second guardian (contact only).
// guardian.login_email is NOT NULL + UNIQUE, so the email is stored there with
// can_authenticate=false (not a login unless they later request access). Does
// NOT touch auth.users.
export async function PATCH(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createAdminClient()
  const { data: me } = await db.from('guardian').select('id, family_id').ilike('login_email', user.email).maybeSingle()
  if (!me) return NextResponse.json({ error: 'No family found.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const first = String(body.first_name ?? '').trim()
  const last = String(body.last_name ?? '').trim()
  const emailIn = String(body.email ?? '').trim().toLowerCase()
  const phone = String(body.phone ?? '').trim()
  if (!first || !last) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })

  // Existing second guardian = any guardian on the family other than the caller.
  const { data: gAll } = await db.from('guardian').select('id').eq('family_id', me.family_id)
  const existing = (gAll ?? []).find((g: any) => g.id !== me.id)

  if (existing) {
    const upd: Record<string, unknown> = { first_name: first, last_name: last, phone: phone || '' }
    if (emailIn) upd.communication_email = emailIn
    const { error } = await db.from('guardian').update(upd).eq('id', existing.id)
    if (error) return NextResponse.json({ error: `Could not update second guardian: ${error.message}` }, { status: 500 })
    return NextResponse.json({ ok: true, updated: true })
  }

  if (!emailIn) return NextResponse.json({ error: 'An email is required to add a second guardian.' }, { status: 400 })
  // login_email is unique — guard against collisions with another account.
  const { data: clash } = await db.from('guardian').select('id').ilike('login_email', emailIn).maybeSingle()
  if (clash) return NextResponse.json({ error: 'That email is already associated with an account.' }, { status: 409 })

  const { error } = await db.from('guardian').insert({
    family_id: me.family_id,
    first_name: first,
    last_name: last,
    login_email: emailIn,
    communication_email: emailIn,
    phone: phone || '',
    role: 'secondary',
    can_authenticate: false,
  })
  if (error) return NextResponse.json({ error: `Could not add second guardian: ${error.message}` }, { status: 500 })
  return NextResponse.json({ ok: true, created: true })
}
