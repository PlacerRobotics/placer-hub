import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/roles'

// POST /api/admin/admins/revoke — super-admin revokes a role assignment
// (sets revoked_at). Guards against revoking the last super_admin / your own.
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await isSuperAdmin(db, admin.id))) return NextResponse.json({ error: 'Super admin only.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const assignmentId = String(body.assignment_id ?? '')
  if (!assignmentId) return NextResponse.json({ error: 'assignment_id is required.' }, { status: 400 })

  const { data: a } = await db.from('admin_role_assignment').select('id, admin_profile_id, role, revoked_at').eq('id', assignmentId).maybeSingle()
  if (!a) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  if (a.revoked_at) return NextResponse.json({ ok: true, alreadyRevoked: true })

  if (a.role === 'super_admin') {
    const { data: supers } = await db.from('admin_role_assignment').select('admin_profile_id').eq('role', 'super_admin').is('revoked_at', null)
    const all = supers ?? []
    if (all.length <= 1) return NextResponse.json({ error: "Can't revoke the last super admin." }, { status: 400 })
    // Block self-lockout only if this is your LAST super-admin row (duplicates are fine to trim).
    if (a.admin_profile_id === admin.id && all.filter((s: any) => s.admin_profile_id === admin.id).length <= 1) {
      return NextResponse.json({ error: "Can't revoke your own last super-admin role." }, { status: 400 })
    }
  }

  const { error } = await db.from('admin_role_assignment').update({ revoked_at: new Date().toISOString() }).eq('id', assignmentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
