'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

type Variant = 'success' | 'warning' | 'info' | 'error' | 'neutral'
export type IqRow = {
  id: string; label: string; teamNumber: string; coach: string; students: number; waivers: string
  statusLabel: string; statusVariant: Variant; fee: string; events: boolean; created: string; createdRaw: string
}

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }
const linkStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--color-navy-deep)' }

type Col = { key: string; label: string; get: (r: IqRow) => string | number; sortable?: boolean }
const COLS: Col[] = [
  { key: 'teamNumber', label: 'Team #', get: (r) => r.teamNumber, sortable: true },
  { key: 'label', label: 'Team', get: (r) => r.label.toLowerCase(), sortable: true },
  { key: 'coach', label: 'Coach', get: (r) => r.coach.toLowerCase(), sortable: true },
  { key: 'students', label: 'Students', get: (r) => r.students, sortable: true },
  { key: 'waivers', label: 'Waivers', get: (r) => r.waivers, sortable: false },
  { key: 'statusLabel', label: 'Status', get: (r) => r.statusLabel, sortable: true },
  { key: 'fee', label: 'Fee', get: (r) => r.fee, sortable: true },
  { key: 'events', label: 'events.vex', get: (r) => (r.events ? 1 : 0), sortable: true },
  { key: 'createdRaw', label: 'Created', get: (r) => r.createdRaw, sortable: true },
]

export default function IqTeamsTable({ rows, canAct }: { rows: IqRow[]; canAct: boolean }) {
  const router = useRouter()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [sortKey, setSortKey] = useState('teamNumber')
  const [dir, setDir] = useState<1 | -1>(1)

  function sortBy(key: string) {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setDir(1) }
  }
  const col = COLS.find((c) => c.key === sortKey) ?? COLS[0]
  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'teamNumber') { const ae = !a.teamNumber, be = !b.teamNumber; if (ae && !be) return 1; if (!ae && be) return -1 }
    const av = col.get(a), bv = col.get(b)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  function toggle(id: string) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
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
          <thead><tr>
            {canAct && <th style={{ ...th, cursor: 'default' }}></th>}
            {COLS.map((c) => (
              <th key={c.key} style={c.sortable ? th : { ...th, cursor: 'default' }} onClick={c.sortable ? () => sortBy(c.key) : undefined}>
                {c.label}{c.sortable && sortKey === c.key ? (dir === 1 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
            <th style={{ ...th, cursor: 'default' }}>Actions</th>
          </tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                {canAct && <td style={cell}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td style={cell}>{r.teamNumber || '—'}</td>
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
