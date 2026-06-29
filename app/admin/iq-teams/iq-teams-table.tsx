'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

type Variant = 'success' | 'warning' | 'info' | 'error' | 'neutral'
export type IqRow = {
  id: string; label: string; teamNumber: string; kit: string; coach: string; coachEmail: string; coachLoggedIn: boolean; students: number; waivers: string
  status: string; statusLabel: string; statusVariant: Variant; fee: string; feeState: string; feeAmount: number; feeTotal: number; feeSource: string
  events: boolean; created: string; createdRaw: string
}

const FEE_BADGE: Record<string, { label: string; variant: Variant }> = {
  paid: { label: 'paid', variant: 'success' },
  partial: { label: 'partial', variant: 'info' },
  unpaid: { label: 'unpaid', variant: 'warning' },
  not_applicable: { label: 'n/a', variant: 'neutral' },
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All statuses' },
  { key: 'pending_payment', label: 'Pending payment' },
  { key: 'pending_admin_confirmation', label: 'Pending approval' },
  { key: 'active', label: 'Active' },
]
const feeSourceLabel = (s: string) => (s === 'zeffy' ? 'Zeffy' : s === 'manual' ? 'manual' : s)

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }
const linkStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--color-navy-deep)' }

type Col = { key: string; label: string; get: (r: IqRow) => string | number; sortable?: boolean }
const COLS: Col[] = [
  { key: 'teamNumber', label: 'Team #', get: (r) => r.teamNumber, sortable: true },
  { key: 'kit', label: 'Kit #', get: (r) => r.kit, sortable: true },
  { key: 'label', label: 'Team', get: (r) => r.label.toLowerCase(), sortable: true },
  { key: 'coach', label: 'Coach', get: (r) => r.coach.toLowerCase(), sortable: true },
  { key: 'students', label: 'Students', get: (r) => r.students, sortable: true },
  { key: 'waivers', label: 'Waivers', get: (r) => r.waivers, sortable: false },
  { key: 'statusLabel', label: 'Status', get: (r) => r.statusLabel, sortable: true },
  { key: 'fee', label: 'Fee', get: (r) => r.feeState, sortable: true },
  { key: 'events', label: 'events.vex', get: (r) => (r.events ? 1 : 0), sortable: true },
]

export default function IqTeamsTable({ rows, canAct }: { rows: IqRow[]; canAct: boolean }) {
  const router = useRouter()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [sortKey, setSortKey] = useState('teamNumber')
  const [dir, setDir] = useState<1 | -1>(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [inviteBusy, setInviteBusy] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({})

  async function inviteCoach(r: IqRow) {
    if (inviteBusy) return
    if (!confirm(`Send a sign-in invite to ${r.coach} (${r.coachEmail})?`)) return
    setInviteBusy(r.id)
    try {
      const res = await fetch(`/api/admin/iq-teams/${r.id}/invite-coach`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      setInviteMsg((m) => ({ ...m, [r.id]: res.ok ? 'Invite sent ✓' : (d.error || 'Failed') }))
    } catch { setInviteMsg((m) => ({ ...m, [r.id]: 'Network error' })) }
    finally { setInviteBusy(null) }
  }

  function sortBy(key: string) {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setDir(1) }
  }
  const col = COLS.find((c) => c.key === sortKey) ?? COLS[0]
  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)
  const sorted = [...filtered].sort((a, b) => {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '7px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', backgroundColor: 'var(--color-surface)' }}>
          {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{sorted.length} team{sorted.length === 1 ? '' : 's'}</span>
      </div>
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
                <td style={cell}>{r.kit || '—'}</td>
                <td style={cell}><Link href={`/admin/iq-teams/${r.id}`} style={linkStyle}>{r.label}</Link></td>
                <td style={cell}>{r.coach}</td>
                <td style={cell}>{r.students}</td>
                <td style={cell}>{r.waivers}</td>
                <td style={cell}><StatusBadge label={r.statusLabel} variant={r.statusVariant} /></td>
                <td style={cell}>
                  {(() => { const b = FEE_BADGE[r.feeState] ?? FEE_BADGE.unpaid; return <StatusBadge label={b.label} variant={b.variant} /> })()}
                  {r.feeState === 'paid' && (r.feeAmount > 0 || r.feeSource) && (
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {r.feeAmount > 0 ? `$${r.feeAmount.toLocaleString()}` : ''}{r.feeAmount > 0 && r.feeSource ? ' · ' : ''}{r.feeSource ? feeSourceLabel(r.feeSource) : ''}
                    </div>
                  )}
                  {r.feeState === 'partial' && (
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      ${r.feeAmount.toLocaleString()} of ${r.feeTotal.toLocaleString()}{r.feeSource ? ` · ${feeSourceLabel(r.feeSource)}` : ''}
                    </div>
                  )}
                </td>
                <td style={cell}>{r.events ? '✓' : '—'}</td>
                <td style={cell}>
                  <span style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href={`/admin/iq-teams/${r.id}`} style={linkStyle}>Manage →</Link>
                    {canAct && r.coachEmail && (
                      inviteMsg[r.id]
                        ? <span style={{ fontSize: '0.75rem', color: inviteMsg[r.id].includes('✓') ? 'var(--color-success)' : 'var(--color-error)' }}>{inviteMsg[r.id]}</span>
                        : <button type="button" disabled={inviteBusy === r.id} onClick={() => inviteCoach(r)} title={`Invite ${r.coachEmail}`} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit' }}>{inviteBusy === r.id ? 'Sending…' : r.coachLoggedIn ? 'Resend invite' : 'Send invite'}</button>
                    )}
                    {canAct && r.coachLoggedIn && <span title="Coach has signed in" style={{ fontSize: '0.6875rem', color: 'var(--color-success)' }}>✓ signed in</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
