import type { TeamVexStats } from '@/lib/vexStats'

const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 1.25rem', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }
const td: React.CSSProperties = { padding: '0.625rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }
const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }

/**
 * Competition Record — a team's VEX history (Worlds runs + banner/state/region
 * awards), from the vex_* Supabase tables (lib/vexStats.ts). Shared between
 * the coach dashboard and the admin Cavitt page.
 */
export function CompetitionRecord({ stats }: { stats: TeamVexStats }) {
  if (!stats.awards.length && !stats.worldsRuns.length) {
    return (
      <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        No VEX competition record synced yet.
      </p>
    )
  }

  return (
    <div>
      {stats.worldsRuns.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ ...subhead, padding: '0.5rem 1.25rem 0' }}>Worlds runs</div>
          {stats.worldsRuns.map((r, i) => (
            <div
              key={`${r.season}-${i}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 1.25rem', fontSize: '0.875rem',
                borderBottom: i < stats.worldsRuns.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <span>{r.season}</span>
              <span style={{ fontWeight: r.madeSemi ? 700 : 400 }}>
                {r.deepestStage ?? 'Qualified'}
                {r.madeSemi ? ' 🏆' : r.madeElim ? ' ✓' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {stats.awards.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Season</th>
              <th style={th}>Award</th>
              <th style={th}>Level</th>
            </tr>
          </thead>
          <tbody>
            {stats.awards.map((a, i) => {
              const level = a.isWorlds ? 'Worlds' : a.scope ?? (a.isBanner ? 'Banner' : '')
              const last = i === stats.awards.length - 1
              return (
                <tr key={`${a.season}-${a.title}-${i}`}>
                  <td style={{ ...td, ...(last ? { borderBottom: 'none' } : {}) }}>{a.season}</td>
                  <td style={{ ...td, fontWeight: a.isBanner ? 700 : 400, ...(last ? { borderBottom: 'none' } : {}) }}>
                    {a.title}
                  </td>
                  <td style={{ ...td, ...(last ? { borderBottom: 'none' } : {}) }}>
                    {level}{a.isBanner && a.scope ? ' 🚩' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
