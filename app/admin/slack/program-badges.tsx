// Shared display + filter vocabulary for program/team affiliation across the
// /admin/slack dashboard (dashboard.tsx, alt-email-matches.tsx,
// disposition-editor.tsx all use the same badges and filter semantics).

export type ProgramFilter = 'all' | 'vex_v5' | 'vex_iq' | 'combat' | 'volunteer'

export const PROGRAM_FILTERS: { value: ProgramFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vex_v5', label: 'V5' },
  { value: 'vex_iq', label: 'IQ' },
  { value: 'combat', label: 'Combat' },
  { value: 'volunteer', label: 'Volunteers' },
]

const PROGRAM_LABEL: Record<string, string> = { vex_v5: 'V5', vex_iq: 'IQ', combat: 'Combat' }
const PROGRAM_COLOR: Record<string, string> = { vex_v5: '#0E2558', vex_iq: '#6B46C1', combat: '#B91C1C' }

const programPill = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700,
  color: '#fff', backgroundColor: color, marginRight: 4, whiteSpace: 'nowrap',
})
const teamPill: React.CSSProperties = {
  display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600,
  color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', marginRight: 4, whiteSpace: 'nowrap',
}

// Inline badges shown next to a person's name: one per program affiliation,
// one per team number. Renders nothing when both are empty (e.g. a
// non-parent volunteer with no determinable program, or an unmatched
// stranger with no Hub record at all).
export function ProgramBadges({ programs, teamNumbers }: { programs?: string[]; teamNumbers?: string[] }) {
  if (!programs?.length && !teamNumbers?.length) return null
  return (
    <span style={{ marginLeft: 6 }}>
      {(programs ?? []).map((p) => <span key={p} style={programPill(PROGRAM_COLOR[p] ?? '#5f6b80')}>{PROGRAM_LABEL[p] ?? p}</span>)}
      {(teamNumbers ?? []).map((t) => <span key={t} style={teamPill}>{t}</span>)}
    </span>
  )
}

// True if a person (guardian/volunteer/student) matches the active pill.
// 'all' always matches; 'volunteer' matches by kind, not program (a
// volunteer's "program" is who they help, not a workspace-scoping signal);
// V5/IQ/Combat match against the person's own program affiliation list.
export function matchesProgramFilter(filter: ProgramFilter, kind: string, programs?: string[]): boolean {
  if (filter === 'all') return true
  if (filter === 'volunteer') return kind === 'volunteer'
  return (programs ?? []).includes(filter)
}

// True if a disposition-tagged "unexpected" stranger matches the active
// pill. These people have no Hub program data by definition (they're not
// matched to any record) — only the Volunteers pill can meaningfully apply,
// via their assigned tags.
export function matchesDispositionFilter(filter: ProgramFilter, tags: string[]): boolean {
  if (filter === 'all') return true
  if (filter === 'volunteer') return tags.includes('volunteer') || tags.includes('mentor')
  return false
}

export function matchesSearch(query: string, name: string, email: string | null | undefined): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return name.toLowerCase().includes(q) || (email ?? '').toLowerCase().includes(q)
}
