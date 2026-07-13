'use client'

import { useState } from 'react'
import RemovalQueue, { type FlaggedRow } from './removal-queue'
import AltEmailMatches, { type MatchRow } from './alt-email-matches'
import SlackDispositionList, { type UnexpectedRow, type Disposition } from './disposition-editor'
import { ProgramBadges, PROGRAM_FILTERS, matchesProgramFilter, matchesDispositionFilter, matchesSearch, type ProgramFilter } from './program-badges'

type PersonLike = { email: string; name: string; kind: string; programs?: string[]; teamNumbers?: string[] }

const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: '1.25rem' }
const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }
const listRow: React.CSSProperties = { padding: '0.625rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }
const empty: React.CSSProperties = { margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }

function PersonList({ people }: { people: PersonLike[] }) {
  if (!people.length) return <p style={empty}>Nothing here right now.</p>
  return (
    <div>
      {people.map((p, i) => (
        <div key={`${p.email}-${i}`} style={{ ...listRow, borderBottom: i < people.length - 1 ? listRow.borderBottom : 'none' }}>
          <span style={{ fontWeight: 600 }}>{p.name}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> · {p.email} · {p.kind}</span>
          <ProgramBadges programs={p.programs} teamNumbers={p.teamNumbers} />
        </div>
      ))}
    </div>
  )
}

export default function SlackDashboard({
  removalRows,
  notJoined,
  departed,
  fuzzyMatches,
  unexpectedRows,
  dispositions,
}: {
  removalRows: FlaggedRow[]
  notJoined: PersonLike[]
  departed: { person: PersonLike; slackUserId: string }[]
  fuzzyMatches: MatchRow[]
  unexpectedRows: UnexpectedRow[]
  dispositions: Record<string, Disposition>
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ProgramFilter>('all')

  const filteredNotJoined = notJoined.filter((p) => matchesSearch(query, p.name, p.email) && matchesProgramFilter(filter, p.kind, p.programs))
  const filteredDeparted = departed.filter((d) => matchesSearch(query, d.person.name, d.person.email) && matchesProgramFilter(filter, d.person.kind, d.person.programs))
  const filteredFuzzy = fuzzyMatches.filter((m) =>
    matchesSearch(query, m.slackName, m.slackEmail) && matchesProgramFilter(filter, m.candidateKind, m.candidatePrograms))
  const filteredUnexpected = unexpectedRows.filter((r) =>
    matchesSearch(query, r.name, r.email) && matchesDispositionFilter(filter, dispositions[r.slackUserId]?.tags ?? []))
  // Removal queue is a safety feature (under-13 in the workspace) — always
  // shown regardless of the program pill, search still applies.
  const filteredRemoval = removalRows.filter((r) => matchesSearch(query, r.name, r.email))

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          style={{ flex: '1 1 240px', padding: '8px 12px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {PROGRAM_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: filter === f.value ? '1px solid var(--color-navy-deep)' : '1px solid var(--color-border)',
                background: filter === f.value ? 'var(--color-navy-deep)' : 'var(--color-surface)',
                color: filter === f.value ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={subhead}>Removal queue — confirm each (never automatic)</div>
      <div style={panel}>
        <RemovalQueue rows={filteredRemoval} />
      </div>

      <div style={subhead}>Not joined — expected members without a Slack account ({filteredNotJoined.length})</div>
      <div style={panel}>
        <PersonList people={filteredNotJoined} />
      </div>

      <div style={subhead}>Departed — expected members whose Slack account is deactivated ({filteredDeparted.length})</div>
      <div style={panel}>
        {filteredDeparted.length === 0 ? (
          <p style={empty}>None.</p>
        ) : (
          <PersonList people={filteredDeparted.map((d) => d.person)} />
        )}
      </div>

      <div style={subhead}>Possible matches — same person, different email ({filteredFuzzy.length})</div>
      <div style={panel}>
        <AltEmailMatches rows={filteredFuzzy} />
      </div>

      <div style={subhead}>In Slack but not expected — tag once, never re-review ({filteredUnexpected.length})</div>
      {filteredUnexpected.length === 0 ? (
        <div style={panel}>
          <p style={empty}>None match the current search/filter.</p>
        </div>
      ) : (
        <SlackDispositionList rows={filteredUnexpected} dispositions={dispositions} />
      )}

      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
        "Unexpected" includes alumni, board members, and helpers who are fine to keep — flag, don't purge.
        Tag Dropped to surface a one-click channel removal; workspace-level deactivation still has no API
        on the standard plan, so that step stays manual in Slack admin.
      </p>
    </div>
  )
}
