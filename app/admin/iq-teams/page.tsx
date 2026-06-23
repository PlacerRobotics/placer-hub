import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { AdminShell, PageHeader, EmptyState } from '@/components/ui'
import IqApproveButton from './iq-approve-button'

const SEASON = '2026-27'

export default async function IqTeamsPage() {
  const supabase = await createClient()
  const admin = await getAdminProfile()
  const canApprove = admin ? await hasAnyRole(createAdminClient(), admin.id, ['iq_coordinator', 'super_admin']) : false

  const { data: teamData } = await supabase
    .from('team')
    .select('id, team_name, team_number, status, active, notes, created_at')
    .eq('season', SEASON)
    .eq('program', 'vex_iq')
    .order('active', { ascending: true })
    .order('created_at', { ascending: true })
  const teams = (teamData ?? []) as any[]
  const teamIds = teams.map((t) => t.id)

  const coachMap: Record<string, string> = {}
  const countMap: Record<string, number> = {}
  if (teamIds.length) {
    const { data: coaches } = await supabase
      .from('team_member')
      .select('team_id, guardian:guardian_id(first_name, last_name)')
      .in('team_id', teamIds)
      .eq('team_role', 'coach')
      .is('revoked_at', null)
    for (const c of (coaches ?? []) as any[]) {
      const g = Array.isArray(c.guardian) ? c.guardian[0] : c.guardian
      if (g) coachMap[c.team_id] = `${g.first_name} ${g.last_name}`.trim()
    }
    const { data: apps } = await supabase.from('student_application').select('triage_notes').eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
    for (const a of (apps ?? []) as any[]) {
      const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)
      if (m) countMap[m[1]] = (countMap[m[1]] ?? 0) + 1
    }
  }

  const pending = teams.filter((t) => !t.active)
  const approved = teams.filter((t) => t.active)

  return (
    <AdminShell>
      <PageHeader title="IQ Teams" subtitle="Coach-submitted VEX IQ teams. Approving sends parents their registration magic links." />
      {teams.length === 0 ? (
        <EmptyState title="No IQ teams yet" description="Teams appear here when a coach submits one at /iq/team." />
      ) : (
        <>
          <Section label={`Pending approval (${pending.length})`} teams={pending} coachMap={coachMap} countMap={countMap} canApprove={canApprove} showApprove />
          <Section label={`Approved (${approved.length})`} teams={approved} coachMap={coachMap} countMap={countMap} canApprove={canApprove} />
        </>
      )}
    </AdminShell>
  )
}

function Section({ label, teams, coachMap, countMap, canApprove, showApprove }: { label: string; teams: any[]; coachMap: Record<string, string>; countMap: Record<string, number>; canApprove: boolean; showApprove?: boolean }) {
  if (!teams.length) return null
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>{label}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {teams.map((t) => (
          <div key={t.id} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.team_name || 'Unnamed team'} {t.team_number ? <span style={{ color: 'var(--color-text-muted)' }}>· {t.team_number}</span> : <span style={{ color: 'var(--color-text-muted)' }}>· (number TBD)</span>}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Coach: {coachMap[t.id] || '—'} · {countMap[t.id] ?? 0} member{(countMap[t.id] ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
              {showApprove ? <IqApproveButton teamId={t.id} canApprove={canApprove} /> : <span style={{ fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600 }}>Active</span>}
            </div>
            {t.notes && <pre style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{t.notes}</pre>}
          </div>
        ))}
      </div>
    </div>
  )
}
