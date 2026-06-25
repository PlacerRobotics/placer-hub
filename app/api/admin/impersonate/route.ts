import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/roles'

// POST /api/admin/impersonate — super-admin generates a one-click sign-in link for
// ANY existing user (debugging / support). Returns the link; opening it signs you in
// AS that user IN THAT BROWSER, so open it in an incognito window to keep your admin
// session. The link lands on /login, which consumes the session and forwards on.
// body: { email, redirectTo? }
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await isSuperAdmin(db, admin.id))) return NextResponse.json({ error: 'Super admin only.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  const redirectTo = typeof body.redirectTo === 'string' && body.redirectTo.startsWith('/') ? body.redirectTo : '/dashboard'

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  try {
    const { data, error } = await (db as any).auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${site}/login?redirectTo=${encodeURIComponent(redirectTo)}` },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const url = data?.properties?.action_link
    if (!url) return NextResponse.json({ error: 'No account exists for that email.' }, { status: 404 })
    return NextResponse.json({ ok: true, url, email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Could not generate link.' }, { status: 500 })
  }
}
