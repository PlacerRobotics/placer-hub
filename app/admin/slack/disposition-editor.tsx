'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type UnexpectedRow = { slackUserId: string; email: string | null; name: string }
export type Disposition = { tags: string[]; notes: string | null }
type SearchResult = { id: string; kind: 'guardian' | 'student'; name: string; email: string }

const TAG_OPTIONS: { value: string; label: string }[] = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'employee', label: 'Employee' },
  { value: 'board', label: 'Board' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'departing', label: 'Departing' },
  { value: 'pending_registration', label: 'Pending registration' },
  { value: 'dropped', label: 'Dropped' },
]
const TAG_LABEL: Record<string, string> = Object.fromEntries(TAG_OPTIONS.map((t) => [t.value, t.label]))

const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: '1.25rem' }
const listRow: React.CSSProperties = { padding: '0.75rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }
const tagBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: active ? '1px solid var(--color-navy-deep)' : '1px solid var(--color-border)',
  background: active ? 'var(--color-navy-deep)' : 'var(--color-surface)',
  color: active ? '#fff' : 'var(--color-text-muted)',
})
const smallBtn: React.CSSProperties = { padding: '5px 10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }

// "Link to a person" — for cases the automated fuzzy match on this same page
// doesn't suggest (a nickname, a very different display name) but an admin
// recognizes by hand ("this is so-and-so's parent"). Searches ALL guardians
// and students by name, then confirms via the same
// /api/admin/slack/confirm-alt-email route the auto-suggested matches use.
function LinkPerson({ row, onDone }: { row: UnexpectedRow; onDone: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function search(q: string) {
    setQuery(q); setSelected(null)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/slack/search-people?q=${encodeURIComponent(q.trim())}`)
      const d = await res.json().catch(() => ({ results: [] }))
      setResults(d.results ?? [])
    } finally { setSearching(false) }
  }

  async function confirm() {
    if (!selected || !row.email) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/slack/confirm-alt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackEmail: row.email, candidateId: selected.id, candidateKind: selected.kind }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setMsg(d.error || 'Failed.')
      else onDone()
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid var(--color-border)' }}>
      {!row.email ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>No email visible for this Slack account — can&apos;t link it.</p>
      ) : (
        <>
          <input
            value={query} onChange={(e) => search(e.target.value)} placeholder="Search guardians and students by name…"
            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          />
          {searching && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Searching…</div>}
          {results.length > 0 && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: '0.5rem', maxHeight: 180, overflowY: 'auto' }}>
              {results.map((r) => (
                <button key={`${r.kind}-${r.id}`} type="button" onClick={() => setSelected(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--color-border)',
                    background: selected?.id === r.id ? 'var(--color-bg-light)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem',
                  }}>
                  <strong>{r.name}</strong> <span style={{ color: 'var(--color-text-muted)' }}>· {r.kind} · {r.email || 'no email on file'}</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem' }}>Link <strong>{row.name}</strong> ({row.email}) to <strong>{selected.name}</strong> ({selected.kind})?</span>
              <button type="button" disabled={busy} onClick={confirm}
                style={{ padding: '5px 12px', background: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                {busy ? 'Linking…' : 'Confirm'}
              </button>
            </div>
          )}
        </>
      )}
      {msg && <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--color-error)' }}>{msg}</div>}
    </div>
  )
}

function Row({ row, disposition }: { row: UnexpectedRow; disposition?: Disposition }) {
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'tag' | 'link'>('none')
  const [tags, setTags] = useState<string[]>(disposition?.tags ?? [])
  const [notes, setNotes] = useState(disposition?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [msg, setMsg] = useState('')

  function toggleTag(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))
  }

  async function save() {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/slack/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackUserId: row.slackUserId, email: row.email, slackName: row.name, tags, notes }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setMsg(d.error || 'Failed.')
      else { setMode('none'); router.refresh() }
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  async function removeFromChannels() {
    if (!window.confirm(`Remove ${row.name} (${row.email ?? 'no email'}) from all team channels?`)) return
    setRemoving(true)
    try {
      const res = await fetch('/api/admin/slack/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackUserId: row.slackUserId, email: row.email }),
      })
      const d = await res.json().catch(() => ({}))
      setMsg(res.ok ? `Removed from ${d.removed} channel${d.removed === 1 ? '' : 's'}` : d.error || 'Failed.')
    } catch { setMsg('Network error.') } finally { setRemoving(false) }
  }

  return (
    <div style={listRow}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <span>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> · {row.email ?? 'email not visible'}</span>
          {mode === 'none' && disposition?.tags.length ? (
            <span style={{ marginLeft: '0.5rem' }}>
              {disposition.tags.map((t) => <span key={t} style={{ ...tagBtn(true), marginRight: 4, cursor: 'default' }}>{TAG_LABEL[t] ?? t}</span>)}
            </span>
          ) : null}
          {mode === 'none' && disposition?.notes && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}> — {disposition.notes}</span>}
        </span>
        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          {disposition?.tags.includes('dropped') && (
            <button type="button" disabled={removing} onClick={removeFromChannels}
              style={{ padding: '5px 10px', background: 'var(--color-surface)', color: 'var(--color-error)', border: '1.5px solid var(--color-error)', borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {removing ? 'Removing…' : 'Remove from channels'}
            </button>
          )}
          <button type="button" onClick={() => setMode((m) => (m === 'link' ? 'none' : 'link'))} style={smallBtn}>
            {mode === 'link' ? 'Cancel' : 'Link to person'}
          </button>
          <button type="button" onClick={() => setMode((m) => (m === 'tag' ? 'none' : 'tag'))} style={smallBtn}>
            {mode === 'tag' ? 'Cancel' : disposition?.tags.length ? 'Edit tags' : 'Tag'}
          </button>
        </span>
      </div>
      {mode === 'tag' && (
        <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {TAG_OPTIONS.map((t) => (
              <button key={t.value} type="button" onClick={() => toggleTag(t.value)} style={tagBtn(tags.includes(t.value))}>{t.label}</button>
            ))}
          </div>
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (e.g. links to which family/guardian)"
            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          />
          <button type="button" disabled={busy} onClick={save}
            style={{ padding: '6px 14px', background: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
      {mode === 'link' && <LinkPerson row={row} onDone={() => { setMode('none'); router.refresh() }} />}
      {msg && <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{msg}</div>}
    </div>
  )
}

// "In Slack but not expected" — split into what still needs a human look vs.
// what's already been triaged, so a recurring sync doesn't re-surface the
// same alumni/volunteers/staff every time. See migration 0055.
export default function SlackDispositionList({ rows, dispositions }: { rows: UnexpectedRow[]; dispositions: Record<string, Disposition> }) {
  const [showCategorized, setShowCategorized] = useState(false)
  const needsReview = rows.filter((r) => !dispositions[r.slackUserId]?.tags.length)
  const categorized = rows.filter((r) => dispositions[r.slackUserId]?.tags.length)

  return (
    <div>
      <div style={panel}>
        {needsReview.length === 0 ? (
          <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Nothing new to review.</p>
        ) : (
          needsReview.map((r) => <Row key={r.slackUserId} row={r} disposition={dispositions[r.slackUserId]} />)
        )}
      </div>
      {categorized.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" onClick={() => setShowCategorized((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--color-navy-deep)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            {showCategorized ? 'Hide' : 'Show'} {categorized.length} already categorized →
          </button>
          {showCategorized && (
            <div style={{ ...panel, marginTop: '0.625rem' }}>
              {categorized.map((r) => <Row key={r.slackUserId} row={r} disposition={dispositions[r.slackUserId]} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
