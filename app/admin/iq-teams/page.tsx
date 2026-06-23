import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, EmptyState, StatusBadge } from '@/components/ui'

const SEASON = '2026-27'
const ORDER: Record<string, number> = { pending_payment: 0, pending_admin_confirmation: 1, active: 2 }
const STATUS: Record<string, [string, 'success' | 'warning' | 'info' | 'error' | 'neutral']> = {
  pending_payment: ['Pending payment', 'warning'],
  pending_admin_confirmation: ['Pending approval', 'info'],
  active: ['Active', 'success'],
  suspended: ['Suspended', 'error'],
}
const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }

export default async function IqTeamsPage() {
  const supabase = await createClient()
  const { data: teamData } = await supabase
    .from('team')
    .select('id, team_name, team_number, status, team_fee_status, created_at')
    .eq('season', SEASON).eq('program', 'vex_iq')
  const teams = (teamData ?? []) as any[]
  const teamIds = teams.map((t) => t.id)

  const coachMap: Record<string, string> = {}
  const countMap: Record<string, number> = {}
  const teamStudents: Record<string, string[]> = {}
  const signed = new Set<string>()
  if (teamIds.length) {
    const { data: coaches } = await supabase.from('team_member').select('team_id, guardian:guardian_id ( first_name, last_name )').in('team_id', teamIds).eq('team_role', 'coach').is('revoked_at', null)
    for (const c of (coaches ?? []) as any[]) {
      const g = Array.isArray(c.guardian) ? c.guardian[0] : c.guardian
      if (g) coachMap[c.team_id] = `${g.first_name} ${g.last_name}`.trim()
    }
    const { data: apps } = await supabase.from('student_application').select('triage_notes, student_id').eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
    for (const a of (apps ?? []) as any[]) {
      const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)
      if (m) { (teamStudents[m[1]] ??= []).push(a.student_id); countMap[m[1]] = (countMap[m[1]] ?? 0) + 1 }
    }
    const allSids = Object.values(teamStudents).flat()
    if (allSids.length) {
      const { data: sigs } = await supabase.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', allSids)
      for (const s of (sigs ?? []) as any[]) signed.add(s.student_id)
    }
  }
  teams.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(a.created_at).localeCompare(String(b.created_at)))

  const counts = (s: string) => teams.filter((t) => t.status === s).length

  return (
    <AdminShell>
      <PageHeader title="IQ Teams" subtitle={`${teams.length} teams · ${counts('pending_payment')} pending payment · ${counts('pending_admin_confirmation')} pending approval · ${counts('active')} active`} />
      {teams.length === 0 ? (
        <EmptyState title="No IQ teams yet" description="Teams appear here when a coach creates one at /iq/team." />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
            <thead><tr><th style={th}>Team</th><th style={th}>Coach</th><th style={th}>Students</th><th style={th}>Waivers</th><th style={th}>Status</th><th style={th}>Fee</th><th style={th}>Created</th><th style={th}></th></tr></thead>
            <tbody>
              {teams.map((t) => {
                const label = t.team_name || (coachMap[t.id] ? `${coachMap[t.id]}’s team` : 'IQ team')
                const [sl, sv] = STATUS[t.status] ?? ['—', 'neutral']
                return (
                  <tr key={t.id}>
                    <td style={cell}><Link href={`/admin/iq-teams/${t.id}`} style={{ fontWeight: 600, color: 'var(--color-navy-deep)' }}>{label}</Link>{t.team_number ? <span style={{ color: 'var(--color-text-muted)' }}> · {t.team_number}</span> : ''}</td>
                    <td style={cell}>{coachMap[t.id] || '—'}</td>
                    <td style={cell}>{countMap[t.id] ?? 0}</td>
                    <td style={cell}>{(teamStudents[t.id] ?? []).filter((sid) => signed.has(sid)).length}/{countMap[t.id] ?? 0}</td>
                    <td style={cell}><StatusBadge label={sl} variant={sv} /></td>
                    <td style={cell}><StatusBadge label={t.team_fee_status ?? 'unpaid'} variant={t.team_fee_status === 'paid' ? 'success' : 'warning'} /></td>
                    <td style={cell}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td style={cell}><Link href={`/admin/iq-teams/${t.id}`} style={{ fontWeight: 600, color: 'var(--color-navy-deep)' }}>Manage →</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
