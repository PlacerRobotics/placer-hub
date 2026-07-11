import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_VALUES, isSuperAdmin, PROGRAM_SCOPED_ROLES, PROGRAM_SCOPE_VALUES } from '@/lib/auth/roles'

const nameFromEmail = (e: string) =>
  e.split('@')[0].split(/[._-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(' ')

// POST /api/admin/admins/grant — super-admin grants a role to an admin (by
// admin_profile_id, or by email — creating the auth account + admin_profile if the
// person doesn't have one yet). body: { admin_profile_id?, email?, role, program_scope? }
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await isSuperAdmin(db, admin.id))) return NextResponse.json({ error: 'Super admin only.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const role = String(body.role ?? '')
  if (!ROLE_VALUES.has(role)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 })
  // A scope only means something on program-scoped roles (D5); drop it elsewhere.
  const programScope = PROGRAM_SCOPED_ROLES.has(role) && body.program_scope ? String(body.program_scope) : null
  if (programScope && !PROGRAM_SCOPE_VALUES.has(programScope)) return NextResponse.json({ error: 'Unknown program scope.' }, { status: 400 })

  // Resolve the target admin_profile.
  let profileId: string | null = body.admin_profile_id ? String(body.admin_profile_id) : null
  if (!profileId) {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Provide an admin or an email.' }, { status: 400 })
    const { data: existing } = await db.from('admin_profile').select('id').ilike('email', email).maybeSingle()
    if (existing) profileId = existing.id
    else {
      // Find the auth user; if they've never signed in, create the account so you can
      // add an admin without waiting for them to log in first.
      let authUserId: string | null = null
      try {
        for (let page = 1; page <= 10; page++) {
          const { data, error } = await (db as any).auth.admin.listUsers({ page, perPage: 1000 })
          if (error || !data?.users?.length) break
          const u = data.users.find((x: any) => (x.email ?? '').toLowerCase() === email)
          if (u) { authUserId = u.id; break }
          if (data.users.length < 1000) break
        }
        if (!authUserId) {
          const { data: newUser, error: cuErr } = await (db as any).auth.admin.createUser({ email, email_confirm: true })
          if (cuErr || !newUser?.user) return NextResponse.json({ error: `Could not create account: ${cuErr?.message ?? 'unknown'}` }, { status: 500 })
          authUserId = newUser.user.id
        }
      } catch (e: any) { return NextResponse.json({ error: `Auth lookup/create failed: ${e?.message}` }, { status: 500 }) }
      const { data: prof, error: cErr } = await db.from('admin_profile').insert({ auth_user_id: authUserId, email, display_name: nameFromEmail(email) }).select('id').single()
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
      profileId = prof.id
    }
  }

  // Skip if an identical active grant exists — same role AND same scope (a lead
  // can legitimately hold e.g. vex_v5 + combat as two grants).
  let dq = db.from('admin_role_assignment').select('id').eq('admin_profile_id', profileId).eq('role', role).is('revoked_at', null)
  dq = programScope ? dq.eq('program_scope', programScope) : dq.is('program_scope', null)
  const { data: dupe } = await dq.limit(1)
  if ((dupe ?? []).length) return NextResponse.json({ ok: true, alreadyHad: true })

  const { error } = await db.from('admin_role_assignment').insert({ admin_profile_id: profileId, role, program_scope: programScope, granted_by: admin.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
