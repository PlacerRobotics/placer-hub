import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { addGuardianEmailAlias } from '@/lib/guardian-lookup'
import { cleanEmail } from '@/lib/email-input'

// POST /api/admin/slack/confirm-alt-email — the confirmed half of the fuzzy
// name-match proposal on /admin/slack. Records a Slack member's email as a
// known alt address for the matched guardian or student, so future
// reconciliation passes recognize it and stop flagging them as not-joined.
// Never automatic — one admin-confirmed match at a time.
// body: { slackEmail, candidateId, candidateKind: 'guardian' | 'student' }
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const email = cleanEmail(body.slackEmail)
  const candidateId = String(body.candidateId ?? '').trim()
  const kind = body.candidateKind
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid Slack email is required.' }, { status: 400 })
  if (!candidateId) return NextResponse.json({ error: 'Missing candidateId.' }, { status: 400 })
  if (kind !== 'guardian' && kind !== 'student') return NextResponse.json({ error: 'candidateKind must be guardian or student.' }, { status: 400 })

  const db = createAdminClient()

  if (kind === 'guardian') {
    await addGuardianEmailAlias(db, candidateId, email, 'slack_fuzzy_match', admin.id)
    return NextResponse.json({ ok: true })
  }

  // Student: no alias table — slack_email is a single field. Only set it if
  // empty or already this value; a different existing value needs a human to
  // look at it directly rather than silently overwriting.
  const { data: student } = await db.from('student').select('id, slack_email').eq('id', candidateId).maybeSingle()
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })
  const existing = (student.slack_email ?? '').toLowerCase()
  if (existing && existing !== email) {
    return NextResponse.json({ error: `Student already has a different slack_email on file (${student.slack_email}). Update it directly if this is correct.` }, { status: 409 })
  }
  const { error } = await db.from('student').update({ slack_email: email }).eq('id', candidateId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
