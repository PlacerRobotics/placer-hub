import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns the current session user's admin_profile { id } if they hold a
 * non-revoked admin role, otherwise null. Use to authorize admin API routes.
 */
export async function getAdminProfile(): Promise<{ id: string } | null> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return null

  const db = createAdminClient()
  const { data: profile } = await db
    .from('admin_profile')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return null

  const { data: roles } = await db
    .from('admin_role_assignment')
    .select('id')
    .eq('admin_profile_id', profile.id)
    .is('revoked_at', null)
    .limit(1)
  if (!roles || roles.length === 0) return null

  return { id: profile.id }
}

// Roles that may READ the admin area but must never perform a write. Keep in sync
// with lib/auth/roles.ts (read_only_admin). A profile whose ONLY non-revoked role is
// read-only is treated as having no write capability.
const READ_ONLY_ROLES = new Set(['read_only_admin'])

/**
 * Like getAdminProfile(), but additionally requires at least one WRITE-capable role.
 * getAdminProfile() authorizes any non-revoked role — sufficient for GET/read routes
 * only. Every mutating admin route (POST/PATCH/PUT/DELETE) must use this instead, or a
 * read_only_admin could drive writes via a direct API call (page guards don't cover
 * the API layer). Returns { id } for a write-capable admin, otherwise null.
 */
export async function requireWriteAdmin(): Promise<{ id: string } | null> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return null

  const db = createAdminClient()
  const { data: profile } = await db
    .from('admin_profile')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return null

  const { data: roles } = await db
    .from('admin_role_assignment')
    .select('role')
    .eq('admin_profile_id', profile.id)
    .is('revoked_at', null)
  const hasWriteRole = (roles ?? []).some((r: { role: string }) => !READ_ONLY_ROLES.has(r.role))
  if (!hasWriteRole) return null

  return { id: profile.id }
}
