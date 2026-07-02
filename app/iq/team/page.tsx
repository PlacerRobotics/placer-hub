import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PublicShell, InfoAlert } from '@/components/ui'
import IqTeamForm from './iq-team-form'

const SEASON = '2026-27'

// Coaches don't create IQ teams — the list is managed by the IQ Coordinator.
// Returning coaches are sent straight to the team they already coach; new coaches
// claim one of the season's teams that has no coach yet.
export default async function IqTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/iq/team')

  const db = createAdminClient()
  const email = (user.email ?? '').toLowerCase()

  const { data: g } = await db.from('guardian').select('id, first_name, last_name, phone').ilike('login_email', email).maybeSingle()
  if (g) {
    const { data: myCoach } = await db.from('team_member').select('team_id, team:team_id ( program, season )').eq('guardian_id', g.id).eq('team_role', 'coach').is('revoked_at', null)
    const mine = (myCoach ?? []).filter((r: any) => { const t = Array.isArray(r.team) ? r.team[0] : r.team; return t && t.program === 'vex_iq' && t.season === SEASON })
    if (mine.length) redirect(`/iq/team/${mine[0].team_id}`) // returning coach → their team
  }

  const [{ data: schools }, { data: cfg }, { data: allIq }] = await Promise.all([
    supabase.from('school').select('id, name, grade_min, grade_max').order('name'),
    supabase.from('season_config').select('zeffy_iq_team_url, iq_team_fee').eq('season', SEASON).maybeSingle(),
    db.from('team').select('id, team_number, team_name').eq('program', 'vex_iq').eq('season', SEASON),
  ])
  const teamIds = (allIq ?? []).map((t: any) => t.id)
  const { data: coachRows } = teamIds.length ? await db.from('team_member').select('team_id').eq('team_role', 'coach').is('revoked_at', null).in('team_id', teamIds) : { data: [] as any[] }
  const coached = new Set((coachRows ?? []).map((r: any) => r.team_id))
  const available = (allIq ?? [])
    .filter((t: any) => !coached.has(t.id))
    .map((t: any) => ({ id: t.id, label: t.team_number || t.team_name || 'Team' }))
    .sort((a: any, b: any) => a.label.localeCompare(b.label, undefined, { numeric: true }))

  if (!available.length) {
    return (
      <PublicShell maxWidth="sm">
        <h1 className="text-page-title">IQ team setup</h1>
        <div style={{ marginTop: '1.5rem' }}>
          <InfoAlert title="No teams available to claim">
            Every VEX IQ team already has a coach. If you should be coaching a team, contact the IQ Coordinator at <a href="mailto:registrar@placerrobotics.org">registrar@placerrobotics.org</a> and they&apos;ll assign you.
          </InfoAlert>
        </div>
        <div style={{ marginTop: '1.25rem' }}><Link href="/dashboard" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>← Back to dashboard</Link></div>
      </PublicShell>
    )
  }

  return (
    <PublicShell maxWidth="md">
      <IqTeamForm
        email={user.email ?? ''}
        coach={{ first_name: g?.first_name ?? '', last_name: g?.last_name ?? '', phone: g?.phone ?? '' }}
        schools={schools ?? []}
        zeffyUrl={cfg?.zeffy_iq_team_url ?? null}
        fee={Number(cfg?.iq_team_fee ?? 1200)}
        availableTeams={available}
      />
    </PublicShell>
  )
}
