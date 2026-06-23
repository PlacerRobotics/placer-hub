import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_VALUES, isSuperAdmin } from '@/lib/auth/roles'

// POST /api/admin/admins/grant — super-admin grants a role to an admin (by
// admin_profile_id, or by email — creating the admin_profile if the person has
// an auth account). body: { admin_profile_id?, email?, role, program_scope? }
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await isSuperAdmin(db, admin.id))) return NextResponse.json({ error: 'Super admin only.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const role = String(body.role ?? '')
  if (!ROLE_VALUES.has(role)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 })
  const programScope = body.program_scope ? String(body.program_scope) : null

  // Resolve the target admin_profile.
  let profileId: string | null = body.admin_profile_id ? String(body.admin_profile_id) : null
  if (!profileId) {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Provide an admin or an email.' }, { status: 400 })
    const { data: existing } = await db.from('admin_profile').select('id').ilike('email', email).maybeSingle()
    if (existing) profileId = existing.id
    else {
      // Find the auth user (they must have signed in at least once).
      let authUserId: string | null = null
      try {
        for (let page = 1; page <= 10; page++) {
          const { data, error } = await (db as any).auth.admin.listUsers({ page, perPage: 1000 })
          if (error || !data?.users?.length) break
          const u = data.users.find((x: any) => (x.email ?? '').toLowerCase() === email)
          if (u) { authUserId = u.id; break }
          if (data.users.length < 1000) break
        }
      } catch (e: any) { return NextResponse.json({ error: `Auth lookup failed: ${e?.message}` }, { status: 500 }) }
      if (!authUserId) return NextResponse.json({ error: 'No account for that email yet. Ask them to sign in once, then grant the role.' }, { status: 404 })
      const { data: created, error: cErr } = await db.from('admin_profile').insert({ auth_user_id: authUserId, email }).select('id').single()
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
      profileId = created.id
    }
  }

  // Skip if an identical active role already exists.
  const { data: dupe } = await db.from('admin_role_assignment').select('id').eq('admin_profile_id', profileId).eq('role', role).is('revoked_at', null).limit(1)
  if ((dupe ?? []).length) return NextResponse.json({ ok: true, alreadyHad: true })

  const { error } = await db.from('admin_role_assignment').insert({ admin_profile_id: profileId, role, program_scope: programScope, granted_by: admin.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
