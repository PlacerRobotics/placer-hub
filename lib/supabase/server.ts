import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } from '@/lib/env'

/**
 * Supabase client for use in Server Components and Route Handlers.
 * Reads auth token from cookies — respects RLS for the logged-in user.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies can't be set here.
            // Middleware handles session refresh.
          }
        },
      },
    }
  )
}
