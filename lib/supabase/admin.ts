import { createClient } from '@supabase/supabase-js'
import { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/env'

/**
 * Supabase admin client — bypasses RLS.
 * Server-side only. Never import in client components.
 * Use only for:
 *   - Webhook handlers
 *   - Scheduled jobs
 *   - Admin bootstrap operations
 *   - Audit log writes (append-only, never via browser client)
 */
export function createAdminClient() {
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
