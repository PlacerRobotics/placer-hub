import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader } from '@/components/ui'
import RosterDownload from './roster-download'

const SEASON = '2026-27'

const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.125rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }

// Cross-program reports — combined exports that don't belong to any single
// program's registration page. Registration-specific views (V5/Combat vs IQ)
// live on their own pages; this is for the "give me everyone" case.
export default async function AdminReportsPage() {
  await requireSection('/admin/reports')

  return (
    <AdminShell activePath="/admin/reports">
      <PageHeader title="Reports" subtitle={`Cross-program exports for the ${SEASON} season.`} />
      <div style={panel}>
        <div>
          <h3 className="text-card-title" style={{ margin: '0 0 0.25rem' }}>Combined roster</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Every confirmed registration across all programs (V5, Combat, IQ) — name, grade, school, program, team, payment status.</p>
        </div>
        <RosterDownload />
      </div>
    </AdminShell>
  )
}
