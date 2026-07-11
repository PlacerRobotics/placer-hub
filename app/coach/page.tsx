import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, StatusBadge, WarningAlert } from '@/components/ui'
import { APS_VALID_THROUGH } from '@/lib/volunteer'
import { getCoachTeams, type CoachTeamView } from '@/lib/coach'
import type { CoachClearance } from '@/lib/volunteer-buckets'

const SEASON = '2026-27'

const DIVISION_LABELS: Record<string, string> = { ES: 'Elementary', MS: 'Middle school', HS: 'High school' }
const ROLE_LABELS: Record<string, string> = { coach: 'Coach', assistant_coach: 'Assistant coach', mentor: 'Mentor' }
const CLEARANCE_VARIANT: Record<CoachClearance, 'success' | 'warning' | 'error' | 'neutral'> = {
  Cleared: 'success',
  'Expiring soon': 'warning',
  'Not cleared': 'error',
  Restricted: 'neutral',
}

export default async function CoachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardian')
    .select('id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()
  if (!guardian) redirect('/dashboard')

  // Coach team_member rows have student_id NULL (hidden from parts of the family
  // RLS surface) and roster students belong to OTHER families — so all reads go
  // through the service-role client, scoped inside getCoachTeams to the team IDs
  // derived from this guardian's active coach memberships.
  const adb = createAdminClient()
  const teams = await getCoachTeams(adb, { guardianId: guardian.id, season: SEASON, validThrough: APS_VALID_THROUGH })
  if (!teams || !teams.length) redirect('/dashboard')

  const familyLabel = guardian.last_name ? `${guardian.last_name} Family` : (user.email ?? '')

  const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }
  const smallLink: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }
  const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }
  const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 1.25rem', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }
  const td: React.CSSProperties = { padding: '0.625rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }

  return (
    <FamilyShell familyName={familyLabel} maxWidth="lg">
      <div style={{ marginBottom: '0.5rem' }}>
        <Link href="/dashboard" style={smallLink}>← Back to dashboard</Link>
      </div>
      <PageHeader title="Coach Dashboard" subtitle={`${SEASON} season · ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`} />

      {teams.map((team: CoachTeamView) => (
        <section key={team.teamId} style={{ marginTop: '1.5rem' }}>
          <h2 className="text-section-title" style={{ margin: '0 0 0.25rem' }}>{team.label}</h2>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            {team.programLabel} · {DIVISION_LABELS[team.division] ?? team.division} · {team.roster.length} {team.roster.length === 1 ? 'student' : 'students'}
          </div>

          {team.alerts.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <WarningAlert title="Team alerts">
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {team.alerts.map((a, i) => <li key={i} style={{ marginTop: i ? '0.25rem' : 0 }}>{a.text}</li>)}
                </ul>
              </WarningAlert>
            </div>
          )}

          <div style={subhead}>Roster</div>
          <div style={{ ...panel, marginBottom: '1rem' }}>
            {team.roster.length === 0 ? (
              <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No students assigned yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Student</th>
                    <th style={th}>Grade</th>
                    <th style={th}>Registration</th>
                    <th style={th}>Agreements</th>
                  </tr>
                </thead>
                <tbody>
                  {team.roster.map((s, i) => {
                    const last = i === team.roster.length - 1
                    return (
                      <tr key={s.studentId}>
                        <td style={{ ...td, fontWeight: 600, ...(last ? { borderBottom: 'none' } : {}) }}>
                          {s.name}{s.preferredName ? <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · goes by {s.preferredName}</span> : null}
                        </td>
                        <td style={{ ...td, ...(last ? { borderBottom: 'none' } : {}) }}>{s.grade ?? '—'}</td>
                        <td style={{ ...td, ...(last ? { borderBottom: 'none' } : {}) }}>
                          {s.registered
                            ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Registered</span>
                            : <span style={{ color: '#C9971B', fontWeight: 600 }}>Incomplete — registrar following up</span>}
                        </td>
                        <td style={{ ...td, ...(last ? { borderBottom: 'none' } : {}) }}>
                          {s.agreementSigned
                            ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Signed</span>
                            : s.registered
                            ? <span style={{ color: '#C9971B', fontWeight: 600 }}>Not signed</span>
                            : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={subhead}>Coaches &amp; clearance</div>
          <div style={panel}>
            {team.staff.map((c, i) => (
              <div key={`${c.guardianId}-${c.role}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: i < team.staff.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span style={{ fontSize: '0.875rem' }}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> · {ROLE_LABELS[c.role] ?? c.role}</span>
                </span>
                <StatusBadge label={c.clearance} variant={CLEARANCE_VARIANT[c.clearance]} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <p style={{ marginTop: '1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        Coaches see registration progress only. Family contact details, payments, and financial-aid
        questions are handled by the registrar — email{' '}
        <a href="mailto:info@placerrobotics.org" style={{ color: 'var(--color-navy-deep)' }}>info@placerrobotics.org</a>.
      </p>
    </FamilyShell>
  )
}
