import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sendMagicLinkEmail } from '@/lib/email'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// POST /api/admin/families/[id]/resend-invite — sends a fresh magic link to the
// primary guardian's login email and marks family_season magic_link_sent.
// Branded magic link via Resend (sendMagicLinkEmail) — no Supabase SMTP dependency.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: familyId } = await params

  const db = createAdminClient()
  const { data: g } = await db.from('guardian').select('id, login_email').eq('family_id', familyId).order('created_at', { ascending: true }).limit(1)
  const email = g?.[0]?.login_email
  if (!email) return NextResponse.json({ error: 'No guardian email on file.' }, { status: 400 })

  const r = await sendMagicLinkEmail({
    email,
    redirectPath: '/dashboard',
    subject: 'Your sign-in link — Placer Robotics Hub',
    heading: 'Your sign-in link',
    intro: 'Click below to securely sign in to the Placer Robotics Hub. No password needed.',
    buttonLabel: 'Sign in to the Hub →',
    preheader: 'Your secure sign-in link for the Placer Robotics Hub.',
  })
  if (!r.ok) return NextResponse.json({ error: r.error === 'no_api_key' ? "Email isn't configured yet." : 'Could not send the invite.' }, { status: 500 })

  await db.from('family_season').update({ magic_link_sent: true }).eq('family_id', familyId)
  const { data: fs } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (fs) await logRegAudit(db, { familySeasonId: fs.id, field: 'magic_link_sent', oldValue: null, newValue: 'true', changedBy: admin.id, notes: `resent invite to ${email}` })

  return NextResponse.json({ ok: true })
}
