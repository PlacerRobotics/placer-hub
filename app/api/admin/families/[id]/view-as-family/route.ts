import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRegAudit } from '@/lib/admin/reg-audit'

const SEASON = '2026-27'

// POST /api/admin/families/[id]/view-as-family — generates a magic link for the
// primary guardian and RETURNS it (does not send). The admin opens it to view
// the family's dashboard for support. NOTE: opening it sets the family session
// in that browser — open in an incognito window to avoid losing your admin login.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: familyId } = await params

  const db = createAdminClient()
  const { data: g } = await db.from('guardian').select('login_email').eq('family_id', familyId).order('created_at', { ascending: true }).limit(1)
  const email = g?.[0]?.login_email
  if (!email) return NextResponse.json({ error: 'No guardian email on file.' }, { status: 400 })

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  let actionLink = ''
  try {
    const { data, error } = await (db as any).auth.admin.generateLink({
      type: 'magiclink',
      email,
      // Land on /login, which consumes the implicit-flow tokens; /api/auth/callback
      // (server) can't read the URL hash, so the session wouldn't be set there.
      options: { redirectTo: `${site}/login?redirectTo=/dashboard` },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    actionLink = data?.properties?.action_link ?? ''
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Could not generate link.' }, { status: 500 })
  }
  if (!actionLink) return NextResponse.json({ error: 'No link returned (the guardian may not have an account yet).' }, { status: 400 })

  const { data: fs } = await db.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
  if (fs) await logRegAudit(db, { familySeasonId: fs.id, field: 'admin_view_as_family', oldValue: null, newValue: email, changedBy: admin.id, notes: 'admin generated view-as-family link' })

  return NextResponse.json({ ok: true, url: actionLink })
}
