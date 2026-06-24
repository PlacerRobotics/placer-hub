import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/roles'
import { sendMagicLinkEmail } from '@/lib/email'

// POST /api/admin/admins/send-link — super-admin sends an admin a branded sign-in
// link (via Resend) so they can onboard. body: { admin_profile_id } or { email }
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await isSuperAdmin(db, admin.id))) return NextResponse.json({ error: 'Super admin only.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  let email = String(body.email ?? '').trim().toLowerCase()
  if (!email && body.admin_profile_id) {
    const { data } = await db.from('admin_profile').select('email').eq('id', String(body.admin_profile_id)).maybeSingle()
    email = (data?.email ?? '').toLowerCase()
  }
  if (!email.includes('@')) return NextResponse.json({ error: 'No email on file for that admin.' }, { status: 400 })

  const r = await sendMagicLinkEmail({
    email,
    redirectPath: '/admin',
    subject: 'Your Placer Robotics Hub admin sign-in link',
    heading: 'Sign in to the admin hub',
    intro: 'You’ve been given admin access to the Placer Robotics Hub. Click below to sign in — no password needed.',
    buttonLabel: 'Sign in to the admin hub →',
    preheader: 'Your admin sign-in link for the Placer Robotics Hub.',
  })
  if (!r.ok) return NextResponse.json({ error: r.error === 'no_api_key' ? "Email isn't configured yet." : 'Could not send the link.' }, { status: 500 })
  await db.from('admin_profile').update({ invite_sent_at: new Date().toISOString() }).ilike('email', email)
  return NextResponse.json({ ok: true })
}
