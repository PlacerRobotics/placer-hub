'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// The confirmed half of the D11 removal queue: each row is one flagged Slack
// account; the button kicks them from all known team channels after an explicit
// confirm. Workspace deactivation stays manual in Slack (no API on standard plan).
export type FlaggedRow = { slackUserId: string; email: string | null; name: string; reason: string }

export default function RemovalQueue({ rows }: { rows: FlaggedRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})

  async function remove(row: FlaggedRow) {
    if (!window.confirm(`Remove ${row.name} (${row.email ?? 'no email'}) from all team channels?\n\nThis does not deactivate their Slack account — do that in Slack admin if needed.`)) return
    setBusy(row.slackUserId)
    try {
      const res = await fetch('/api/admin/slack/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackUserId: row.slackUserId, email: row.email }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setMsg((m) => ({ ...m, [row.slackUserId]: d.error || 'Failed.' }))
      else {
        setMsg((m) => ({ ...m, [row.slackUserId]: `Removed from ${d.removed} channel${d.removed === 1 ? '' : 's'}${d.errors ? ` · ${d.errors} failed` : ''}` }))
        router.refresh()
      }
    } catch {
      setMsg((m) => ({ ...m, [row.slackUserId]: 'Network error.' }))
    } finally {
      setBusy(null)
    }
  }

  if (!rows.length) return <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Nothing queued.</p>

  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.slackUserId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
          <span style={{ fontSize: '0.875rem' }}>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> · {r.email ?? 'no email visible'} · {r.reason}</span>
            {msg[r.slackUserId] && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{msg[r.slackUserId]}</span>}
          </span>
          <button
            type="button"
            disabled={busy === r.slackUserId}
            onClick={() => remove(r)}
            style={{ padding: '6px 12px', background: 'var(--color-surface)', color: 'var(--color-error)', border: '1.5px solid var(--color-error)', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {busy === r.slackUserId ? 'Removing…' : 'Remove from channels'}
          </button>
        </div>
      ))}
    </div>
  )
}
