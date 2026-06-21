import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'
import { TeamCoaches, type Coach } from './team-coaches'

const SEASON = '2026-27'
const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5 Robotics', vex_iq: 'VEX IQ Robotics', combat: 'Combat Robotics' }

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: team } = await supabase
    .from('team')
    .select('id, team_number, team_name, program, division, season, school_org, active, notes')
    .eq('id', id)
    .maybeSingle()

  if (!team) {
    return (
      <AdminShell activePath="/admin/teams">
        <PageHeader title="Team not found" breadcrumb={[{ label: 'Teams', href: '/admin/teams' }, { label: 'Not found' }]} />
      </AdminShell>
    )
  }

  const { data: coachRows } = await supabase
    .from('team_member')
    .select('id, team_role, guardian:guardian_id ( first_name, last_name, login_email )')
    .eq('team_id', id)
    .in('team_role', ['coach', 'assistant_coach', 'mentor'])
    .eq('season', SEASON)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })

  const coaches = (coachRows ?? []) as unknown as Coach[]
  const title = team.team_name || team.team_number || 'Unnamed team'

  const fields = [
    { label: 'Team number', value: team.team_number ?? '—' },
    { label: 'Team name', value: team.team_name ?? '—' },
    { label: 'Program', value: PROGRAM_LABELS[team.program] ?? team.program },
    { label: 'Division', value: team.division },
    { label: 'Season', value: team.season },
    { label: 'School / org', value: team.school_org },
    { label: 'Status', value: <StatusBadge label={team.active ? 'active' : 'inactive'} variant={team.active ? 'success' : 'neutral'} /> },
    { label: 'Notes', value: team.notes ? <span style={{ whiteSpace: 'pre-wrap' }}>{team.notes}</span> : '—' },
  ]

  return (
    <AdminShell activePath="/admin/teams">
      <PageHeader
        title={title}
        subtitle={`${PROGRAM_LABELS[team.program] ?? team.program} · ${team.division}`}
        breadcrumb={[{ label: 'Teams', href: '/admin/teams' }, { label: title }]}
      />

      <AdminDetailPanel title="Team details" fields={fields}>
        <Link href="/admin/teams" style={{ fontSize: '0.875rem' }}>← Back to all teams</Link>
      </AdminDetailPanel>

      <div style={{ marginTop: '1.5rem' }}>
        <TeamCoaches teamId={team.id} coaches={coaches} />
      </div>
    </AdminShell>
  )
}
