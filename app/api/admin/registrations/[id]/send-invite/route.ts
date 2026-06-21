import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createSupa } from '@supabase/supabase-js'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

// POST /api/admin/registrations/[id]/send-invite — magic link to the family's
// guardian1 (primary) email; sets magic_link_sent = true. Uses signInWithOtp
// (Supabase sends the email); generateLink would require a custom email sender.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const db = createAdminClient()
  const { data: fs } = await db
    .from('family_season')
    .select('id, magic_link_sent, family:family_id ( primary_email )')
    .eq('id', id)
    .maybeSingle()
  if (!fs) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  const email = (fs as any).family?.primary_email
  if (!email) return NextResponse.json({ error: 'No guardian email on file.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const sender = createSupa(url, anon)
  const { error } = await sender.auth.signInWithOtp({ email, options: { emailRedirectTo: `${site}/api/auth/callback` } })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('family_season').update({ magic_link_sent: true }).eq('id', id)
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
