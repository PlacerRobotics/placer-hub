import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { SLACK_MAIN_BOT_TOKEN } from '@/lib/env'
import { kickFromChannel } from '@/lib/slack'

const SEASON = '2026-27'

// POST /api/admin/slack/remove — the confirmed half of the D11 removal queue:
// kick one flagged Slack user out of every team channel the Hub knows about.
// Workspace-level deactivation isn't possible on the standard plan (no API) —
// that stays a manual admin step in Slack itself. body: { slackUserId, email }
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!SLACK_MAIN_BOT_TOKEN) return NextResponse.json({ error: 'Slack is not configured.' }, { status: 400 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const slackUserId = String(body.slackUserId ?? '')
  const email = String(body.email ?? '') || 'unknown'
  if (!slackUserId) return NextResponse.json({ error: 'Missing slackUserId.' }, { status: 400 })

  const db = createAdminClient()
  const { data: teams } = await db.from('team').select('id, slack_channel_id').eq('season', SEASON)
  const channels = [...new Set(((teams ?? []) as any[]).map((t) => t.slack_channel_id).filter(Boolean))] as string[]

  let removed = 0
  let errors = 0
  for (const channelId of channels) {
    const res = await kickFromChannel(SLACK_MAIN_BOT_TOKEN, channelId, slackUserId)
    if (res.ok) removed++
    else errors++
    await db.from('sync_log').insert({
      sync_type: 'slack_channel_invite',
      action: 'remove',
      email,
      slack_group: channelId,
      success: res.ok,
      error_message: res.ok ? null : res.error ?? 'unknown',
    })
  }

  return NextResponse.json({ ok: errors === 0, channelsProcessed: channels.length, removed, errors })
}
