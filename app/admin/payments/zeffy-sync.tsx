'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Result = {
  itemId: string
  studentName: string
  guardianEmail: string
  program: string
  status: 'matched' | 'unmatched' | 'already_recorded'
  reason?: string
}
type Summary = { matched: number; unmatched: number; alreadyRecorded: number; applied: number }

const btn: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const STATUS_COLOR: Record<string, string> = {
  matched: 'var(--color-success)',
  unmatched: 'var(--color-error)',
  already_recorded: 'var(--color-text-muted)',
}

export default function ZeffySync() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [results, setResults] = useState<Result[] | null>(null)

  async function run(apply: boolean) {
    if (busy) return
    if (apply && !confirm('Record all matched Zeffy payments and mark those registration fees paid?')) return
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/payments/zeffy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(d.error || 'Sync failed.')
        return
      }
      setSummary(d.summary)
      setResults(d.results ?? [])
      setMsg(
        apply
          ? `Applied ${d.summary.applied} payment(s). ${d.summary.alreadyRecorded} were already recorded.`
          : `Preview of ${d.fetched} Zeffy payment(s): ${d.summary.matched} match, ${d.summary.unmatched} unmatched, ${d.summary.alreadyRecorded} already recorded.`
      )
      if (apply) router.refresh()
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', margin: '0 0 0.875rem', lineHeight: 1.6 }}>
        Pull paid registrations from the Zeffy campaign and match them to enrollments by guardian email + student name +
        program. Preview first; applying records each payment and marks its registration fee paid.
      </p>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(false)}
          style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          {busy ? 'Working…' : 'Preview Zeffy sync'}
        </button>
        <button
          type="button"
          disabled={busy || !summary || summary.matched === 0}
          onClick={() => run(true)}
          style={{
            ...btn,
            backgroundColor: !summary || summary.matched === 0 ? 'var(--color-border)' : 'var(--color-gold)',
            color: 'var(--color-navy-darker)',
          }}
        >
          Apply matched
        </button>
      </div>
      {msg && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>{msg}</p>}
      {results && results.length > 0 && (
        <div style={{ marginTop: '0.875rem', maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {['Student', 'Program', 'Guardian email', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.03em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.itemId}>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>{r.studentName || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>{r.program || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>{r.guardianEmail || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', color: STATUS_COLOR[r.status], fontWeight: 600 }}>
                    {r.status === 'matched' ? 'Matched' : r.status === 'already_recorded' ? 'Already recorded' : `Unmatched${r.reason ? ` — ${r.reason}` : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
