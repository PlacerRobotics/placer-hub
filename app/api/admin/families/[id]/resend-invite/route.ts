import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createSupa } from '@supabase/supabase-js'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// POST /api/admin/families/[id]/resend-invite — sends a fresh magic link to the
// primary guardian's login email and marks family_season magic_link_sent.
// Uses signInWithOtp (Supabase sends the email); generateLink can't send.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: familyId } = await params

  const db = createAdminClient()
  const { data: g } = await db.from('guardian').select('id, login_email').eq('family_id', familyId).order('created_at', { ascending: true }).limit(1)
  const email = g?.[0]?.login_email
  if (!email) return NextResponse.json({ error: 'No guardian email on file.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const sender = createSupa(url, anon)
  const { error } = await sender.auth.signInWithOtp({ email, options: { emailRedirectTo: `${site}/api/auth/callback` } })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('family_season').update({ magic_link_sent: true }).eq('family_id', familyId)
  const { data: fs } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (fs) await logRegAudit(db, { familySeasonId: fs.id, field: 'magic_link_sent', oldValue: null, newValue: 'true', changedBy: admin.id, notes: `resent invite to ${email}` })

  return NextResponse.json({ ok: true })
}
