import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in client components ('use client').
 * Uses anon key only — all access gated by RLS.
 *
 * NOTE: reads the public env vars directly from process.env rather than from
 * '@/lib/env'. Next.js inlines NEXT_PUBLIC_* values into the client bundle, so
 * this works in the browser. Importing '@/lib/env' here would pull its eager
 * server-only secret validation (SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_ADMIN_EMAIL)
 * into the client bundle, which throws on page load in the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
