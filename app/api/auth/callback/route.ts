import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth callback — handles magic link confirmation.
 * Supabase redirects here after email link click.
 *
 * After confirming the session, redirects to:
 * - /dashboard (family users)
 * - /admin (admin users — role check in admin layout)
 * - ?redirectTo param if set
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'
  const next = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Record the login signal (read by admin views as "last logged in"). Uses the
      // service-role client since a guardian can't update their own row under RLS.
      // Best-effort — never block sign-in on it. No-ops for admins with no guardian row.
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          await createAdminClient()
            .from('guardian')
            .update({ last_login_at: new Date().toISOString() })
            .ilike('login_email', user.email)
        }
      } catch (e) {
        console.error('[auth/callback] last_login_at update failed:', e)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
