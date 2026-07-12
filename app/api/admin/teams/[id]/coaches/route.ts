import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanEmail } from '@/lib/email-input'

const SEASON = '2026-27'
const COACH_ROLES = new Set(['coach', 'assistant_coach', 'mentor'])

/**
 * Team coaches.
 * POST   — add a coach: insert a team_member (guardian-based, role in coach set).
 *          program is taken from the team (team_member.program is NOT NULL).
 * DELETE  — remove a coach: set revoked_at = now() on the team_member (?member_id=).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: teamId } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  let guardianId = String(body.guardian_id ?? '').trim()
  const teamRole = String(body.team_role ?? '').trim()
  if (!COACH_ROLES.has(teamRole)) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })

  const db = createAdminClient()

  // Create a new (coach-only) guardian inline when no existing one was picked.
  if (!guardianId && body.new_guardian) {
    const ng = body.new_guardian
    const email = cleanEmail(ng?.email)
    const first = String(ng?.first_name ?? '').trim()
    const last = String(ng?.last_name ?? '').trim()
    const phone = String(ng?.phone ?? '').trim()
    if (!email || !first || !last) return NextResponse.json({ error: 'New coach needs a first name, last name, and email.' }, { status: 400 })

    // Reuse a guardian with this email if one exists; otherwise create a coach-only family + guardian.
    const { data: existing } = await db.from('guardian').select('id').ilike('login_email', email).maybeSingle()
    if (existing) {
      guardianId = existing.id
    } else {
      const { data: fam, error: famErr } = await db.from('family').insert({ primary_email: email, display_name: `${last} (coach)` }).select('id').single()
      if (famErr) return NextResponse.json({ error: famErr.message }, { status: 500 })
      const { data: g, error: gErr } = await db.from('guardian').insert({
        family_id: fam.id, first_name: first, last_name: last, login_email: email, phone: phone || '', role: 'other',
      }).select('id').single()
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
      guardianId = g.id
    }
  }

  if (!guardianId) return NextResponse.json({ error: 'A guardian is required.' }, { status: 400 })

  // team_member.program is NOT NULL — inherit it from the team.
  const { data: team, error: teamErr } = await db.from('team').select('program').eq('id', teamId).maybeSingle()
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 })
  if (!team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 })

  const { error } = await db.from('team_member').insert({
    team_id: teamId,
    guardian_id: guardianId,
    season: SEASON,
    team_role: teamRole,
    program: team.program,
    revoked_at: null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await params // team id is implied by the membership row; not needed for the update

  const memberId = (request.nextUrl.searchParams.get('member_id') ?? '').trim()
  if (!memberId) return NextResponse.json({ error: 'member_id is required.' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('id', memberId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
