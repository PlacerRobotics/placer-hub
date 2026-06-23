import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// POST /api/admin/families/[id]/change-email — change a guardian's LOGIN email.
// Updates guardian.login_email AND the auth.users email. Since guardian has no
// auth_user_id and auth.users isn't queryable via PostgREST, we find the auth
// user by the current email via auth.admin.listUsers.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: familyId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const newEmail = String(body.new_email ?? '').trim().toLowerCase()
  if (!newEmail || !newEmail.includes('@')) return NextResponse.json({ error: 'A valid new email is required.' }, { status: 400 })

  const db = createAdminClient()
  let g: any
  if (body.guardian_id) {
    const { data } = await db.from('guardian').select('id, family_id, login_email').eq('id', body.guardian_id).maybeSingle()
    if (!data || data.family_id !== familyId) return NextResponse.json({ error: 'Guardian not in this family.' }, { status: 403 })
    g = data
  } else {
    const { data } = await db.from('guardian').select('id, family_id, login_email').eq('family_id', familyId).order('created_at', { ascending: true }).limit(1)
    g = data?.[0]
  }
  if (!g) return NextResponse.json({ error: 'Guardian not found.' }, { status: 404 })
  const oldEmail = String(g.login_email).toLowerCase()
  if (oldEmail === newEmail) return NextResponse.json({ ok: true, unchanged: true })

  // Guard against collisions with another guardian.
  const { data: clash } = await db.from('guardian').select('id').ilike('login_email', newEmail).maybeSingle()
  if (clash) return NextResponse.json({ error: 'That email is already associated with another account.' }, { status: 409 })

  const { error: gErr } = await db.from('guardian').update({ login_email: newEmail }).eq('id', g.id)
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // Update the auth user, if one exists for the old email.
  let authUpdated = false
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await (db as any).auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      const u = data.users.find((x: any) => (x.email ?? '').toLowerCase() === oldEmail)
      if (u) {
        await (db as any).auth.admin.updateUserById(u.id, { email: newEmail })
        authUpdated = true
        break
      }
      if (data.users.length < 1000) break
    }
  } catch (e: any) {
    console.error('[change-email] auth update failed:', e?.message)
  }

  const { data: fs } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (fs) await logRegAudit(db, { familySeasonId: fs.id, field: 'login_email', oldValue: oldEmail, newValue: newEmail, changedBy: admin.id, notes: authUpdated ? 'auth user updated' : 'guardian record only (no auth user found)' })

  return NextResponse.json({ ok: true, authUpdated })
}
