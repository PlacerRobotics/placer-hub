import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { canAccessAdmin, adminHome, type RoleGrant } from '@/lib/auth/roles'

export type AdminAccess = { adminId: string; roles: string[]; grants: RoleGrant[]; isSuper: boolean }

// Current admin's profile id + non-revoked role grants (null if not an admin).
// grants keeps each role's program_scope so programScopeFor() can limit
// program-scoped roles; roles stays the flat list most checks use.
export async function getAdminAccess(): Promise<AdminAccess | null> {
  const admin = await getAdminProfile()
  if (!admin) return null
  const db = createAdminClient()
  const { data } = await db.from('admin_role_assignment').select('role, program_scope').eq('admin_profile_id', admin.id).is('revoked_at', null)
  const grants: RoleGrant[] = (data ?? []).map((r: any) => ({ role: r.role, programScope: r.program_scope ?? null }))
  const roles = [...new Set(grants.map((g) => g.role))]
  return { adminId: admin.id, roles, grants, isSuper: roles.includes('super_admin') }
}

// Page guard: non-admins → /dashboard; admins without access to this section → their
// admin home (so no infinite loop). Returns the access object on success.
export async function requireSection(href: string): Promise<AdminAccess> {
  const access = await getAdminAccess()
  if (!access) redirect('/dashboard')
  if (!canAccessAdmin(access.roles, access.isSuper, href)) {
    const home = adminHome(access.roles, access.isSuper)
    redirect(home === href ? '/dashboard' : home)
  }
  return access
}

// Same as requireSection, but passes if the admin can access ANY of the given
// hrefs — for a page shared by more than one list view (e.g.
// /admin/registrations/[id] is linked from both /admin/registrations and
// /admin/registrations-iq). Granting the detail page's own section list
// isn't right here — that would also expose the OTHER list's nav item/page.
export async function requireAnySection(hrefs: string[]): Promise<AdminAccess> {
  const access = await getAdminAccess()
  if (!access) redirect('/dashboard')
  if (!hrefs.some((href) => canAccessAdmin(access.roles, access.isSuper, href))) {
    const home = adminHome(access.roles, access.isSuper)
    redirect(hrefs.includes(home) ? '/dashboard' : home)
  }
  return access
}
