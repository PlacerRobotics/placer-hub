import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_TAGS = new Set(['volunteer', 'mentor', 'employee', 'board', 'alumni', 'departing', 'dropped', 'pending_registration'])

// POST /api/admin/slack/disposition — record (or update) a standing decision
// for one Slack account that doesn't match any known Hub person: is this an
// alumni parent, a volunteer, staff, someone leaving, someone to remove?
// Upserted by slack_user_id so re-tagging just updates the same row.
// body: { slackUserId, email?, slackName?, tags: string[], notes?: string }
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const slackUserId = String(body.slackUserId ?? '').trim()
  if (!slackUserId) return NextResponse.json({ error: 'Missing slackUserId.' }, { status: 400 })
  const tags = Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : []
  const unknown = tags.filter((t: string) => !VALID_TAGS.has(t))
  if (unknown.length) return NextResponse.json({ error: `Unknown tag(s): ${unknown.join(', ')}` }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('slack_member_disposition').upsert(
    {
      slack_user_id: slackUserId,
      email: body.email ? String(body.email).trim().toLowerCase() : null,
      slack_name: body.slackName ? String(body.slackName).trim() : null,
      tags,
      notes: body.notes ? String(body.notes).trim() : null,
      created_by: admin.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slack_user_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
