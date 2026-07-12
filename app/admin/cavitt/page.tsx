import { requireSection } from '@/lib/auth/admin-access'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, EmptyState, CompetitionRecord } from '@/components/ui'
import { getCavittTeams, getTeamVexStats, getCategoryStats } from '@/lib/vexStats'

const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-navy-deep)' }}>{value}</div>
    </div>
  )
}

// The Cyber Cowboys (Willma Cavitt Junior High) — a SEPARATE program, not a
// PART team. Deliberately its own section: never blended into PART's own
// roster or published totals (vex_team.is_part = false, category='cyber9537').
export default async function CavittPage() {
  await requireSection('/admin/cavitt')
  const supabase = await createClient()

  const [teams, categoryStats] = await Promise.all([
    getCavittTeams(supabase),
    getCategoryStats(supabase, 'cyber9537'),
  ])
  const teamStats = await Promise.all(teams.map((t) => getTeamVexStats(supabase, t.teamNumber)))

  return (
    <AdminShell activePath="/admin/cavitt">
      <PageHeader
        title="Cavitt / 9537 — Cyber Cowboys"
        subtitle="Willma Cavitt Junior High's own VEX program — a separate partner program, never blended into PART's own totals."
      />

      {categoryStats && (
        <div style={{ ...panel, padding: '1.25rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <Stat label="Seasons" value={categoryStats.firstSeason && categoryStats.lastSeason ? `${categoryStats.firstSeason} – ${categoryStats.lastSeason}` : '—'} />
          <Stat label="Worlds qualifications" value={categoryStats.worldsQualByTeam} />
          <Stat label="Banner awards" value={categoryStats.bannerAwards} />
          <Stat label="State/Region awards" value={categoryStats.stateChampAwards + categoryStats.regionChampAwards} />
        </div>
      )}

      {teams.length === 0 ? (
        <EmptyState
          title="No Cavitt/9537 data synced yet"
          description="Run a full backfill sync (scripts/part_vex_history.py --backfill --to supabase --live) to populate this section."
        />
      ) : (
        teams.map((team, i) => {
          const stats = teamStats[i]
          return (
            <section key={team.teamNumber} style={{ marginBottom: '1.5rem' }}>
              <h2 className="text-section-title" style={{ margin: '0 0 0.25rem' }}>{team.teamNumber}</h2>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                {team.orgName ?? 'Willma Cavitt Junior High'} · {team.gradeLevel ?? 'Middle School'}
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
