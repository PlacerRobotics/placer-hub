import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addIqMembers } from '@/lib/iq-team'

// POST /api/iq/team/[id]/members — the team's coach adds their own child and/or a set
// of roster members to an existing IQ team (the create-flow roster builder, reusable
// after the team already exists). If the team is active, new families are invited now.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Please sign in to your family account first.' }, { status: 401 })

  const db = createAdminClient()
  const { data: g } = await db.from('guardian').select('id, family_id, last_name').ilike('login_email', user.email).maybeSingle()
  if (!g) return NextResponse.json({ error: 'No account found for this email.' }, { status: 403 })
  const { data: tm } = await db.from('team_member').select('id').eq('team_id', id).eq('guardian_id', g.id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
  if (!tm) return NextResponse.json({ error: 'You are not the coach of this team.' }, { status: 403 })
  const { data: team } = await db.from('team').select('status, program').eq('id', id).maybeSingle()
  if (!team || team.program !== 'vex_iq') return NextResponse.json({ error: 'Team not found.' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const members = await addIqMembers(db, {
    teamId: id,
    teamStatus: team.status,
    coachFamilyId: g.family_id,
    coachEmail: user.email,
    coachLast: g.last_name ?? '',
    ownChild: body.own_child ?? null,
    roster: Array.isArray(body.roster) ? body.roster : [],
  })
  if (!members.length) return NextResponse.json({ error: 'Add at least one member (a name, grade, and parent email).' }, { status: 400 })
  return NextResponse.json({ ok: true, members })
}
