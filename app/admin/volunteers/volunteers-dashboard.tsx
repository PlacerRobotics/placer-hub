'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

export type VolRow = {
  id: string; name: string; email: string; status: string
  doj: boolean; aps: 'valid' | 'expiring' | 'expired' | 'none'; apsExpiry: string | null
  rc: boolean; yp: boolean; waiver: boolean
}

const GREEN = 'var(--color-success)', RED = 'var(--color-error)', YELLOW = '#C9971B', BLUE = 'var(--color-info)', GREY = 'var(--color-text-muted)'
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = { cleared: 'success', in_progress: 'info', pending: 'warning', expired: 'error', suspended: 'error', withdrawn: 'neutral' }

function dotColor(r: VolRow): string {
  if (r.status === 'suspended' || r.status === 'expired' || r.aps === 'expired') return RED
  if (r.status === 'cleared' && r.aps === 'valid' && r.waiver && r.rc && r.yp && r.doj) return GREEN
  if (r.aps === 'expiring') return YELLOW
  if (r.status === 'pending') return BLUE
  return YELLOW
}
const matchTab = (r: VolRow, t: string) => {
  switch (t) {
    case 'all': return true
    case 'pending': return r.status === 'pending'
    case 'in_progress': return r.status === 'in_progress'
    case 'cleared': return r.status === 'cleared'
    case 'expiring': return r.aps === 'expiring'
    case 'expired': return r.status === 'expired' || r.aps === 'expired'
    case 'suspended': return r.status === 'suspended'
    case 'waiver_missing': return (r.status === 'cleared' || r.status === 'in_progress') && !r.waiver
    default: return true
  }
}

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }
const card = (active: boolean, accent: string): React.CSSProperties => ({ border: `1px solid ${active ? accent : 'var(--color-border)'}`, borderLeft: `4px solid ${accent}`, borderRadius: 8, padding: '0.625rem 0.875rem', minWidth: 120, cursor: 'pointer', background: active ? 'var(--color-surface)' : 'transparent' })
const flag = (ok: boolean) => <span style={{ color: ok ? GREEN : RED, fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>

export default function VolunteersDashboard({ rows }: { rows: VolRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState('all')

  const count = (t: string) => rows.filter((r) => matchTab(r, t)).length
  const filtered = rows.filter((r) => matchTab(r, tab))

  const STATS: [string, string, string][] = [
    ['all', 'Total', GREY],
    ['pending', 'New / pending', BLUE],
    ['in_progress', 'In progress', YELLOW],
    ['cleared', 'Cleared', GREEN],
    ['expiring', 'APS expiring', YELLOW],
    ['expired', 'Expired', RED],
    ['waiver_missing', 'Waiver unsigned', RED],
    ['suspended', 'Suspended', RED],
  ]

  function aps(r: VolRow) {
    const d = r.apsExpiry ? new Date(r.apsExpiry).toLocaleDateString() : ''
    if (r.aps === 'valid') return <span style={{ color: GREEN, fontWeight: 600 }}>✓ {d}</span>
    if (r.aps === 'expiring') return <span style={{ color: YELLOW, fontWeight: 600 }}>⚠ {d}</span>
    if (r.aps === 'expired') return <span style={{ color: RED, fontWeight: 600 }}>✗ exp {d}</span>
    return <span style={{ color: RED, fontWeight: 600 }}>✗ none</span>
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {STATS.map(([t, label, accent]) => (
          <div key={t} style={card(tab === t, accent)} onClick={() => setTab(t)}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy-deep)' }}>{count(t)}</div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>
        Showing {filtered.length} {tab === 'all' ? 'volunteers' : `· ${tab.replace(/_/g, ' ')}`} · APS must be valid through the season end (5/31/2027)
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr><th style={th}></th><th style={th}>Volunteer</th><th style={th}>Status</th><th style={th}>DOJ</th><th style={th}>APS</th><th style={th}>RC quiz</th><th style={th}>YP quiz</th><th style={th}>Waiver</th><th style={th}></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td style={cell} colSpan={9}>No volunteers in this view.</td></tr> : filtered.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/volunteers/${r.id}`)}>
                <td style={cell}><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: dotColor(r) }} /></td>
                <td style={cell}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.email}</div></td>
                <td style={cell}><StatusBadge label={r.status.replace(/_/g, ' ')} variant={STATUS_VARIANT[r.status] ?? 'neutral'} /></td>
                <td style={cell}>{flag(r.doj)}</td>
                <td style={cell}>{aps(r)}</td>
                <td style={cell}>{flag(r.rc)}</td>
                <td style={cell}>{flag(r.yp)}</td>
                <td style={cell}>{flag(r.waiver)}</td>
                <td style={cell}><span style={{ fontWeight: 600, color: 'var(--color-navy-deep)' }}>Review →</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
