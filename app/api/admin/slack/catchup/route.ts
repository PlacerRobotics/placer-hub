import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, slackMsHsCatchUpHtml } from '@/lib/email'
import { NEXT_PUBLIC_SLACK_MAIN_INVITE, SLACK_MAIN_BOT_TOKEN } from '@/lib/env'
import { runSlackReconciliation } from '@/lib/slack-recon'

const SEASON = '2026-27'

// POST /api/admin/slack/catchup — one-time MS/HS "you're registered but not on
// Slack yet" campaign. Targets guardian-kind entries in the live reconciliation's
// notJoined bucket (already scoped to the main workspace's programs — vex_v5/combat,
// which in practice IS the MS/HS population here; VEX IQ is elementary-only and has
// its own separate workspace/invite). body: { mode: 'sample' | 'send' }.
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!SLACK_MAIN_BOT_TOKEN) return NextResponse.json({ error: 'Slack is not configured (SLACK_MAIN_BOT_TOKEN).' }, { status: 400 })
  if (!NEXT_PUBLIC_SLACK_MAIN_INVITE) return NextResponse.json({ error: 'NEXT_PUBLIC_SLACK_MAIN_INVITE is not set.' }, { status: 400 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const mode = body.mode === 'send' ? 'send' : 'sample'

  const db = createAdminClient()

  if (mode === 'sample') {
    const res = await sendEmail({
      to: ['kevin.miller@placerrobotics.org'],
      subject: `[SAMPLE] Join us on Slack — Placer Robotics ${SEASON}`,
      html: slackMsHsCatchUpHtml({
        name: 'Kevin', season: SEASON, inviteUrl: NEXT_PUBLIC_SLACK_MAIN_INVITE,
        joinEmail: 'kevin.miller@placerrobotics.org', programs: ['vex_v5', 'combat'],
      }),
    })
    if (!res.ok) return NextResponse.json({ error: res.error === 'no_api_key' ? "Email isn't configured yet." : 'Send failed.' }, { status: 500 })
    return NextResponse.json({ ok: true, sent: 1 })
  }

  // mode === 'send' — the real, one-time bulk send.
  const run = await runSlackReconciliation(db, SLACK_MAIN_BOT_TOKEN, SEASON, false)
  const targets = run.recon.notJoined.filter((p) => p.kind === 'guardian' && p.guardianId)
  const guardianIds = targets.map((p) => p.guardianId as string)
  if (!guardianIds.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: 0 })

  const { data: guardians } = await db.from('guardian').select('id, first_name, login_email, slack_email').in('id', guardianIds)
  const guardianById: Record<string, any> = Object.fromEntries((guardians ?? []).map((g: any) => [g.id, g]))

  let sent = 0, skipped = 0, errors = 0
  for (const p of targets) {
    const g = guardianById[p.guardianId as string]
    if (!g?.login_email) { skipped++; continue }
    const res = await sendEmail({
      to: [g.login_email],
      subject: `Join us on Slack — Placer Robotics ${SEASON}`,
      html: slackMsHsCatchUpHtml({
        name: g.first_name ?? '', season: SEASON, inviteUrl: NEXT_PUBLIC_SLACK_MAIN_INVITE,
        joinEmail: g.slack_email || g.login_email, programs: p.programs ?? [],
      }),
    })
    if (res.ok) {
      sent++
      await db.from('notification_log').insert({
        recipient_email: g.login_email, notification_type: 'slack_mshs_catchup_invite',
        subject: 'Slack catch-up invite', provider: 'resend', status: 'sent', sent_at: new Date().toISOString(),
      })
    } else errors++
  }

  return NextResponse.json({ ok: true, sent, skipped, errors, candidates: targets.length })
}
