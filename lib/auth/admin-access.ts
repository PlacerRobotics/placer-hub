import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { canAccessAdmin, adminHome } from '@/lib/auth/roles'

export type AdminAccess = { adminId: string; roles: string[]; isSuper: boolean }

// Current admin's profile id + non-revoked role values (null if not an admin).
export async function getAdminAccess(): Promise<AdminAccess | null> {
  const admin = await getAdminProfile()
  if (!admin) return null
  const db = createAdminClient()
  const { data } = await db.from('admin_role_assignment').select('role').eq('admin_profile_id', admin.id).is('revoked_at', null)
  const roles = [...new Set((data ?? []).map((r: any) => r.role))] as string[]
  return { adminId: admin.id, roles, isSuper: roles.includes('super_admin') }
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
