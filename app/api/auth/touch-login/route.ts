import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/touch-login — stamps guardian.last_login_at for the signed-in user.
// Magic-link sign-ins land on /login (client setSession) and bypass /api/auth/callback,
// so the login-status signal is recorded here instead.
export async function POST() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ ok: false }, { status: 401 })
  const db = createAdminClient()
  await db.from('guardian').update({ last_login_at: new Date().toISOString() }).ilike('login_email', user.email)
  return NextResponse.json({ ok: true })
}
