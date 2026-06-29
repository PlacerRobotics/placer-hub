import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMagicLinkEmail } from '@/lib/email'

const ROLES = ['iq_coordinator', 'super_admin', 'payment_admin', 'registration_admin']

// POST /api/admin/iq-teams/[id]/invite-coach
// Emails the team's coach a magic-link invite to sign in and set up their team.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await hasAnyRole(db, admin.id, ROLES))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data: team } = await db.from('team').select('id, team_name, team_number, program').eq('id', id).maybeSingle()
  if (!team || team.program !== 'vex_iq') return NextResponse.json({ error: 'IQ team not found.' }, { status: 404 })

  const { data: tm } = await db.from('team_member').select('guardian:guardian_id ( first_name, login_email )').eq('team_id', id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
  const g: any = tm ? (Array.isArray((tm as any).guardian) ? (tm as any).guardian[0] : (tm as any).guardian) : null
  if (!g?.login_email) return NextResponse.json({ error: 'This team has no coach with an email on file.' }, { status: 400 })

  const teamLabel = team.team_name || (team.team_number ? `team ${team.team_number}` : 'your VEX IQ team')
  const r = await sendMagicLinkEmail({
    email: g.login_email,
    redirectPath: '/dashboard',
    subject: 'Set up your VEX IQ team — Placer Robotics',
    heading: 'Welcome — set up your VEX IQ team',
    intro: `You've been added as the coach of ${teamLabel}. Click below to sign in and finish setting up your team — add your roster and complete the steps to get your team registered for the 2026-27 season.`,
    buttonLabel: 'Sign in to set up my team →',
    preheader: 'Sign in to set up your VEX IQ team.',
  })
  if (!r.ok && r.error === 'no_api_key') return NextResponse.json({ error: "Email isn't configured yet." }, { status: 503 })
  if (!r.ok) return NextResponse.json({ error: 'Could not send the invite. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true, email: g.login_email })
}
