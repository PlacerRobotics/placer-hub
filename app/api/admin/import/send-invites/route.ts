import { NextResponse } from 'next/server'
import { sendMagicLinkEmail } from '@/lib/email'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

/**
 * Send season invite magic links — one per unique family email — ONLY to
 * families cleared_to_register that haven't been invited yet. The UI button is
 * disabled by default; enable it only after end-to-end testing.
 */
export async function POST() {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data: fseasons } = await db
    .from('family_season')
    .select('id, family:family_id ( primary_email )')
    .eq('season', SEASON)
    .eq('status', 'cleared_to_register')
    .eq('magic_link_sent', false)

  const rows = (fseasons ?? []) as any[]
  const sentEmails = new Set<string>()
  let sent = 0
  const failures: string[] = []
  for (const fs of rows) {
    const email = fs.family?.primary_email
    if (!email) continue
    if (!sentEmails.has(email)) {
      const r = await sendMagicLinkEmail({
        email,
        redirectPath: '/register',
        subject: 'You’re invited to register — Placer Robotics 2026-27',
        heading: 'You’re invited to register',
        intro: "You're cleared to register for the 2026-27 Placer Robotics season. Click below to sign in and complete your student's registration.",
        buttonLabel: 'Sign in to register →',
        preheader: 'Sign in to complete your Placer Robotics registration.',
      })
      if (!r.ok) {
        failures.push(`${email}: ${r.error ?? 'failed'}`)
        continue
      }
      sentEmails.add(email)
      sent++
    }
    await db.from('family_season').update({ magic_link_sent: true }).eq('id', fs.id)
  }

  return NextResponse.json({ ok: true, sent, failures })
}
