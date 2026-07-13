import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/slack/search-people?q=... — name search across ALL guardians
// and students (not season-scoped — an admin manually linking a Slack account
// they recognize needs to find anyone, not just this season's registrants),
// for the "link to a person" fallback when the automated fuzzy match on
// /admin/slack doesn't suggest anything (different-looking names, e.g. a
// nickname the algorithm can't bridge).
export async function GET(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const db = createAdminClient()
  const like = `%${q}%`

  const [{ data: guardians }, { data: students }] = await Promise.all([
    db.from('guardian').select('id, family_id, first_name, last_name, login_email')
      .or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(15),
    db.from('student').select('id, family_id, first_name, last_name, communication_email')
      .or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(15),
  ])

  const results = [
    ...((guardians ?? []) as any[]).map((g) => ({
      id: g.id, kind: 'guardian' as const, name: `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim(), email: g.login_email ?? '',
    })),
    ...((students ?? []) as any[]).map((s) => ({
      id: s.id, kind: 'student' as const, name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(), email: s.communication_email ?? '',
    })),
  ]

  return NextResponse.json({ results })
}
