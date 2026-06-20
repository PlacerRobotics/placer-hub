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
