import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sendMagicLinkEmail } from '@/lib/email'
import { cleanEmail } from '@/lib/email-input'

// POST /api/auth/magic-link — send a branded sign-in link via Resend (not Supabase SMTP).
// body: { email, redirectTo? }
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const email = cleanEmail(body.email)
  const redirectTo = typeof body.redirectTo === 'string' && body.redirectTo.startsWith('/') ? body.redirectTo : '/dashboard'
  if (!email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })

  const r = await sendMagicLinkEmail({
    email,
    redirectPath: redirectTo,
    subject: 'Your sign-in link — Placer Robotics Hub',
    heading: 'Your sign-in link',
    intro: 'Click below to securely sign in to the Placer Robotics Hub. No password needed.',
    buttonLabel: 'Sign in to the Hub →',
    preheader: 'Your secure sign-in link for the Placer Robotics Hub.',
  })
  if (!r.ok && r.error === 'no_api_key') return NextResponse.json({ error: "Email isn't configured yet — contact registrar@placerrobotics.org." }, { status: 503 })
  if (!r.ok) return NextResponse.json({ error: 'Could not send the sign-in link. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
