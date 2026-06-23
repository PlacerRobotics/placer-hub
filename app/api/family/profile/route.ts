import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/family/profile — the family's contact info. NOTE: `family` has no
// address/phone columns in this schema; that lives on the guardian. So this
// updates the logged-in (primary) guardian's address + phone.
export async function PATCH(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createAdminClient()
  const { data: guardian } = await db.from('guardian').select('id, phone').ilike('login_email', user.email).maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family found.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  const upd: Record<string, unknown> = {}
  if (body.street_address !== undefined) upd.street_address = String(body.street_address).trim() || null
  if (body.city !== undefined) upd.city = String(body.city).trim() || null
  if (body.state !== undefined) upd.state = String(body.state).trim() || null
  if (body.zip_code !== undefined) upd.zip_code = String(body.zip_code).trim() || null
  if (body.phone !== undefined) upd.phone = String(body.phone).trim() || guardian.phone // phone is NOT NULL

  if (Object.keys(upd).length === 0) return NextResponse.json({ ok: true })
  const { error } = await db.from('guardian').update(upd).eq('id', guardian.id)
  if (error) return NextResponse.json({ error: `Could not save contact info: ${error.message}` }, { status: 500 })
  return NextResponse.json({ ok: true })
}
