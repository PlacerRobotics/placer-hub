import { requireSection } from '@/lib/auth/admin-access'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, EmptyState, CompetitionRecord } from '@/components/ui'
import { getPartTeams, getTeamVexStats, getCategoryStats } from '@/lib/vexStats'

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', vex_iq: 'VEX IQ' }
const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-navy-deep)' }}>{value}</div>
    </div>
  )
}

function CategoryBlock({ title, stats }: { title: string; stats: Awaited<ReturnType<typeof getCategoryStats>> }) {
  if (!stats) return null
  return (
    <div style={{ ...panel, padding: '1.25rem', marginBottom: '1.5rem' }}>
      <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <Stat label="Seasons" value={stats.firstSeason && stats.lastSeason ? `${stats.firstSeason} – ${stats.lastSeason}` : '—'} />
        <Stat label="Worlds qualifications" value={stats.worldsQualByTeam} />
        <Stat label="Banner awards" value={stats.bannerAwards} />
        <Stat label="State/Region awards" value={stats.stateChampAwards + stats.regionChampAwards} />
      </div>
    </div>
  )
}

// Read-only viewer for PART's own synced VEX competition record (vex_team /
// vex_award / vex_worlds_run — see lib/vexStats.ts). Data is owned by the
// sync pipeline (scripts/part_vex_history.py via the Sync VEX Stats GitHub
// Action); there is no edit UI here on purpose — fixing a wrong award means
// fixing it at the source (RobotEvents) or, for a one-off correction, writing
// a source='manual' row directly (the sync job never overwrites those).
export default async function VexStatsAdminPage() {
  await requireSection('/admin/vex-stats')
  const supabase = await createClient()

  const [teams, v5Stats, iqStats] = await Promise.all([
    getPartTeams(supabase),
    getCategoryStats(supabase, 'v5rc'),
    getCategoryStats(supabase, 'viqrc'),
  ])
  const teamStats = await Promise.all(teams.map((t) => getTeamVexStats(supabase, t.teamNumber, t.program)))

  return (
    <AdminShell activePath="/admin/vex-stats">
      <PageHeader
        title="VEX Competition Record"
        subtitle="PART's synced V5 + IQ history (Worlds quals, banners, elim depth, State/Region titles). Synced from RobotEvents — see scripts/part_vex_history.py."
      />

      <CategoryBlock title="VEX V5" stats={v5Stats} />
      <CategoryBlock title="VEX IQ" stats={iqStats} />

      <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>Teams ({teams.length})</h2>
      {teams.length === 0 ? (
        <EmptyState
          title="No VEX data synced yet"
          description="Run a full backfill sync (scripts/part_vex_history.py --backfill --to supabase --live) to populate this section."
        />
      ) : (
        teams.map((team, i) => {
          const stats = teamStats[i]
          return (
            <section key={`${team.teamNumber}-${team.program}`} style={{ marginBottom: '1.5rem' }}>
              <h3 className="text-card-title" style={{ margin: '0 0 0.25rem' }}>
                {team.teamNumber} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· {PROGRAM_LABELS[team.program] ?? team.program}</span>
              </h3>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                {team.orgName ?? 'PART'}
                {team.firstSeason && team.lastSeason ? ` · ${team.firstSeason} – ${team.lastSeason}` : ''}
              </div>
              <div style={panel}>
                {stats ? (
                  <CompetitionRecord stats={stats} />
                ) : (
                  <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    No record synced yet.
                  </p>
                )}
              </div>
            </section>
          )
        })
      )}
    </AdminShell>
  )
}
