import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { SLACK_MAIN_BOT_TOKEN } from '@/lib/env'
import { runSlackReconciliation } from '@/lib/slack-recon'

const SEASON = '2026-27'

// GET /api/cron/slack-reconcile — nightly (task 1.6 / D11). Reconciles the main
// Slack workspace against the Hub: records matches on guardian rows, performs
// ADDITIVE team-channel placement via the bot, and reports the drift buckets
// (not-joined / departed / under-13-present / unexpected). Never removes anyone —
// removals are confirmed one-by-one on /admin/slack. Vercel cron authenticates
// via CRON_SECRET; an admin can also trigger it manually.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  if (!isCron && !(await getAdminProfile())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  if (!SLACK_MAIN_BOT_TOKEN) {
    return NextResponse.json({ ok: true, skipped: 'SLACK_MAIN_BOT_TOKEN not configured' })
  }

  const db = createAdminClient()
  try {
    const run = await runSlackReconciliation(db, SLACK_MAIN_BOT_TOKEN, SEASON, true)
    return NextResponse.json({
      ok: true,
      expected: run.expectedCount,
      matched: run.recon.matched.length,
      matchedRecorded: run.matchedRecorded,
      notJoined: run.recon.notJoined.length,
      departed: run.recon.departed.length,
      under13Present: run.recon.under13Present.length,
      unexpected: run.recon.unexpected.length,
      channelInvitesSent: run.invitesSent,
      channelInviteErrors: run.inviteErrors,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Slack reconciliation failed.' }, { status: 500 })
  }
}
