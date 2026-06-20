import { createBrowserClient } from '@supabase/ssr'
import { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } from '@/lib/env'

/**
 * Supabase client for use in client components ('use client').
 * Uses anon key only — all access gated by RLS.
 */
export function createClient() {
  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
