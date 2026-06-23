'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

type Variant = 'success' | 'warning' | 'info' | 'error' | 'neutral'
export type IqRow = {
  id: string; label: string; coach: string; students: number; waivers: string
  statusLabel: string; statusVariant: Variant; fee: string; events: boolean; created: string
}

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }
const linkStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--color-navy-deep)' }

export default function IqTeamsTable({ rows, canAct }: { rows: IqRow[]; canAct: boolean }) {
  const router = useRouter()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  async function bulkEvents(value: boolean) {
    if (!sel.size || busy) return
    setBusy(true)
    await fetch('/api/admin/iq-teams/bulk-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamIds: [...sel], value }) }).catch(() => {})
    setBusy(false); setSel(new Set()); router.refresh()
  }

  return (
    <>
      {canAct && sel.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.5rem 0.875rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{sel.size} selected</span>
          <button type="button" onClick={() => bulkEvents(true)} disabled={busy} style={{ padding: '6px 12px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Saving…' : 'Mark events.vex.com registered'}</button>
          <button type="button" onClick={() => bulkEvents(false)} disabled={busy} style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}>Unmark</button>
        </div>
      )}
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr>{canAct && <th style={th}></th>}<th style={th}>Team</th><th style={th}>Coach</th><th style={th}>Students</th><th style={th}>Waivers</th><th style={th}>Status</th><th style={th}>Fee</th><th style={th}>events.vex</th><th style={th}>Created</th><th style={th}></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canAct && <td style={cell}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td style={cell}><Link href={`/admin/iq-teams/${r.id}`} style={linkStyle}>{r.label}</Link></td>
                <td style={cell}>{r.coach}</td>
                <td style={cell}>{r.students}</td>
                <td style={cell}>{r.waivers}</td>
                <td style={cell}><StatusBadge label={r.statusLabel} variant={r.statusVariant} /></td>
                <td style={cell}><StatusBadge label={r.fee} variant={r.fee === 'paid' ? 'success' : 'warning'} /></td>
                <td style={cell}>{r.events ? '✓' : '—'}</td>
                <td style={cell}>{r.created}</td>
                <td style={cell}><Link href={`/admin/iq-teams/${r.id}`} style={linkStyle}>Manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
