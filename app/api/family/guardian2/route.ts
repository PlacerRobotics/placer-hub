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
  const commIn = body.communication_email !== undefined ? String(body.communication_email).trim().toLowerCase() || null : undefined
  const phone = String(body.phone ?? '').trim()
  const addr = {
    street_address: body.street_address !== undefined ? String(body.street_address).trim() || null : undefined,
    city: body.city !== undefined ? String(body.city).trim() || null : undefined,
    state: body.state !== undefined ? String(body.state).trim() || null : undefined,
    zip_code: body.zip_code !== undefined ? String(body.zip_code).trim() || null : undefined,
  }
  if (!first || !last) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })

  // Existing second guardian = any guardian on the family other than the caller.
  const { data: gAll } = await db.from('guardian').select('id, login_email, slack_email').eq('family_id', me.family_id)
  const existing = (gAll ?? []).find((g: any) => g.id !== me.id)

  if (existing) {
    const upd: Record<string, unknown> = { first_name: first, last_name: last, phone: phone || '' }
    if (commIn !== undefined) upd.communication_email = commIn
    for (const [k, v] of Object.entries(addr)) if (v !== undefined) upd[k] = v
    // login (primary) email — editable for a contact-only guardian; guard uniqueness.
    if (emailIn && emailIn !== (existing.login_email ?? '').toLowerCase()) {
      const { data: clash } = await db.from('guardian').select('id').ilike('login_email', emailIn).maybeSingle()
      if (clash && clash.id !== existing.id) return NextResponse.json({ error: 'That email is already associated with an account.' }, { status: 409 })
      upd.login_email = emailIn
    }
    // Slack email — settable once, then admin-only (Slack can't rename/merge).
    if (body.slack_email !== undefined) {
      const newVal = String(body.slack_email).trim().toLowerCase() || null
      const current = existing.slack_email ?? null
      if (newVal !== current) {
        if (current) return NextResponse.json({ error: 'Changing the Slack email requires an admin — contact info@placerrobotics.org.' }, { status: 400 })
        upd.slack_email = newVal
      }
    }
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
    communication_email: commIn ?? emailIn,
    slack_email: body.slack_email ? String(body.slack_email).trim().toLowerCase() || null : null,
    street_address: addr.street_address ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    zip_code: addr.zip_code ?? null,
    phone: phone || '',
    role: 'secondary',
    can_authenticate: false,
  })
  if (error) return NextResponse.json({ error: `Could not add second guardian: ${error.message}` }, { status: 500 })
  return NextResponse.json({ ok: true, created: true })
}
