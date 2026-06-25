import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sendMagicLinkEmail } from '@/lib/email'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { familyInviteDetails } from '@/lib/invite-summary'
import { logRegAudit } from '@/lib/admin/reg-audit'

// POST /api/admin/registrations/[id]/send-invite — magic link to the family's
// guardian1 (primary) email; sets magic_link_sent = true. Branded magic link via
// Resend (sendMagicLinkEmail) — no dependency on Supabase SMTP.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const db = createAdminClient()
  const { data: fs } = await db
    .from('family_season')
    .select('id, family_id, magic_link_sent, family:family_id ( primary_email )')
    .eq('id', id)
    .maybeSingle()
  if (!fs) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  const email = (fs as any).family?.primary_email
  if (!email) return NextResponse.json({ error: 'No guardian email on file.' }, { status: 400 })

  const details = await familyInviteDetails(db, (fs as any).family_id, '2026-27')
  const r = await sendMagicLinkEmail({
    email,
    redirectPath: '/register',
    subject: 'You’re invited to register — Placer Robotics 2026-27',
    heading: 'You’re invited to register',
    intro: "You're cleared to register for the 2026-27 Placer Robotics season. Click below to sign in and complete your student's registration.",
    buttonLabel: 'Sign in to register →',
    preheader: 'Sign in to complete your Placer Robotics registration.',
    details,
  })
  if (!r.ok) return NextResponse.json({ error: r.error === 'no_api_key' ? "Email isn't configured yet." : 'Could not send the invite.' }, { status: 500 })

  await db.from('family_season').update({ magic_link_sent: true, updated_at: new Date().toISOString() }).eq('id', id)
  await logRegAudit(db, {
    familySeasonId: id,
    field: 'magic_link_sent',
    oldValue: String((fs as any).magic_link_sent),
    newValue: 'true',
    changedBy: admin.id,
    notes: `invite sent to ${email}`,
  })
  return NextResponse.json({ ok: true })
}
